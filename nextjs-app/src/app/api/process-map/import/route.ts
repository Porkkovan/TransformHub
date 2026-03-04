import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const normalized = candidates.map(normalizeHeader);
  // 1. Exact normalized match
  const exact = headers.find((h) => normalized.includes(normalizeHeader(h)));
  if (exact) return exact;
  // 2. Prefix match: "Step Name (hrs)" matches candidate "Step Name"
  const prefix = headers.find((h) => {
    const nh = normalizeHeader(h);
    return normalized.some((nc) => nc.length >= 4 && nh.startsWith(nc));
  });
  if (prefix) return prefix;
  // 3. Contains match: "Active Process Time" matches candidate "Process Time"
  //    Only for candidates ≥ 6 chars to avoid false positives.
  return headers.find((h) => {
    const nh = normalizeHeader(h);
    return normalized.some((nc) => nc.length >= 6 && nh.includes(nc));
  });
}

type TimeUnit = "hours" | "minutes" | "days" | "weeks";

/**
 * Infer the time unit from a column header name.
 * e.g. "Process Time (min)" → "minutes", "Wait Time (days)" → "days"
 */
function detectColumnUnit(header: string | undefined): TimeUnit {
  if (!header) return "hours";
  const h = normalizeHeader(header);
  if (h.includes("min")) return "minutes";
  if (h.includes("day")) return "days";
  if (h.includes("week") || h.includes("wk")) return "weeks";
  return "hours"; // default (hrs, hours, h, or no unit in header)
}

/**
 * Infer the time unit from the actual cell values when the header gives no clue.
 *
 * Heuristic (based on what makes sense per process step):
 *   median > 60  → almost certainly minutes  (60h/step would be 7.5 work-days)
 *   median > 16  → probably minutes           (16h/step = 2 full work-days, unusual)
 *   median ≤ 2   → could be days if WT col   (but we can't distinguish here, caller decides)
 *   otherwise    → treat as hours
 */
function detectColumnUnitFromValues(rawValues: number[]): TimeUnit {
  const nonZero = rawValues.filter((v) => v > 0);
  if (nonZero.length === 0) return "hours";
  const sorted = [...nonZero].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median > 16) return "minutes";
  return "hours";
}

/**
 * Like detectColumnUnitFromValues but also considers "days" for wait-time columns.
 * Wait times tend to be larger (days of queue) while process times are shorter (minutes of work).
 * If median ≤ 8 AND the values look like whole numbers → likely days.
 */
function detectWtUnitFromValues(rawValues: number[]): TimeUnit {
  const nonZero = rawValues.filter((v) => v > 0);
  if (nonZero.length === 0) return "hours";
  const sorted = [...nonZero].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  if (median > 16) return "minutes";
  // Values look like day counts: median ≤ 30, max ≤ 365, mostly integers
  const intRatio = nonZero.filter((v) => Number.isInteger(v)).length / nonZero.length;
  if (median <= 30 && max <= 365 && intRatio >= 0.7) return "days";
  return "hours";
}

/**
 * Convert a raw cell value to hours.
 * Handles:
 *   - Numeric:   plain numbers treated with the given column unit
 *   - Strings:   "30 min", "2h", "1.5 days", bare numbers, etc.
 *                A unit suffix in the cell always overrides the column-level unit.
 *
 * NOTE: We intentionally do NOT attempt to auto-detect Excel HH:MM time fractions
 * (values < 1) — that heuristic is unreliable when valid fractional hours like 0.5
 * appear in the data. Instead the user specifies the UOM via the import modal.
 */
function toNumber(val: unknown, unit: TimeUnit = "hours"): number {
  // ── Numeric value ─────────────────────────────────────────────────────────
  if (typeof val === "number") {
    if (!isFinite(val) || val < 0) return 0;
    return applyUnit(val, unit);
  }

  // ── String value ──────────────────────────────────────────────────────────
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (!s || s === "-" || s === "n/a" || s === "na" || s === "tbd") return 0;

    // Extract leading numeric part (supports comma-thousands like "1,234.5")
    const numMatch = s.match(/^([\d,]+\.?\d*|\.\d+)/);
    if (!numMatch) return 0;
    const raw = parseFloat(numMatch[1].replace(/,/g, ""));
    if (isNaN(raw) || raw < 0) return 0;

    // Check for an explicit unit in the cell value (overrides column-level unit)
    const cellUnit = s.slice(numMatch[0].length).trim();
    if (/^(days?|d)$/.test(cellUnit))        return Math.round(raw * 8    * 100) / 100; // 8 h/day
    if (/^(weeks?|wks?|w)$/.test(cellUnit))  return Math.round(raw * 40   * 100) / 100; // 40 h/week
    if (/^(min(ute)?s?|m)$/.test(cellUnit))  return Math.round((raw / 60) * 1000) / 1000;
    if (/^(h(ou)?r?s?|h)$/.test(cellUnit))   return raw; // explicit hours → ignore column unit

    // No cell-level unit → fall back to column-level unit
    return applyUnit(raw, unit);
  }

  return 0;
}

function applyUnit(n: number, unit: TimeUnit): number {
  switch (unit) {
    case "minutes": return Math.round((n / 60) * 1000) / 1000;
    case "days":    return Math.round(n * 8    * 100) / 100;
    case "weeks":   return Math.round(n * 40   * 100) / 100;
    default:        return n; // hours
  }
}

function inferClassification(
  processTime: number,
  waitTime: number
): "value-adding" | "bottleneck" | "waste" {
  if (waitTime === 0 && processTime > 0) return "value-adding";
  if (waitTime > 0 && processTime === 0) return "waste";
  if (waitTime > processTime * 3) return "bottleneck";
  return "value-adding";
}

function parseClassification(raw: string): "value-adding" | "bottleneck" | "waste" | null {
  const s = raw.toLowerCase().trim();
  if (s.includes("value") || s === "va" || s === "value adding") return "value-adding";
  if (s.includes("bottle") || s.includes("delay")) return "bottleneck";
  if (s.includes("waste") || s === "nva" || s === "non-value") return "waste";
  return null;
}

function sanitizeId(name: string, index: number): string {
  return `S${index}_${name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)}`;
}

function generateMermaid(steps: { name: string; classification: string; processTime: number; waitTime: number }[]): string {
  // Embed per-step timing as a metadata comment so the UI can show accurate step-level data
  const meta = steps.map(s => ({ n: s.name, c: s.classification, pt: s.processTime, wt: s.waitTime }));
  const lines = [
    `%%steps:${JSON.stringify(meta)}`,
    "graph LR",
    "  classDef value fill:#22c55e,stroke:#16a34a,color:#fff",
    "  classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff",
    "  classDef waste fill:#ef4444,stroke:#dc2626,color:#fff",
  ];
  const ids = steps.map((s, i) => sanitizeId(s.name, i));
  for (let i = 0; i < steps.length; i++) {
    const cls =
      steps[i].classification === "value-adding"
        ? "value"
        : steps[i].classification;
    // Escape double-quotes in step names
    const label = steps[i].name.replace(/"/g, "'");
    lines.push(`  ${ids[i]}["${label}"]:::${cls}`);
  }
  for (let i = 0; i < ids.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }
  return lines.join("\n");
}

// ── Logical capability naming ────────────────────────────────────────────────

/**
 * Derive a human-readable capability name from the first step in a group.
 * Converts action verbs to noun-phrase form so capabilities sound like
 * business domains rather than numbered phases.
 *
 * Examples:
 *   "Collect Customer Documents"  → "Documents Collection"
 *   "Verify Customer Identity"    → "Identity Verification"
 *   "Conduct AML Screening"       → "AML Screening"
 *   "Approve Loan Application"    → "Loan Application Approval"
 */
const VERB_TO_NOUN: Record<string, string> = {
  receive: "Intake", collect: "Collection", gather: "Collection",
  verify: "Verification", validate: "Validation",
  review: "Review", assess: "Assessment", evaluate: "Evaluation",
  approve: "Approval", sign: "Sign-off", authorize: "Authorisation",
  process: "Processing", complete: "Completion",
  finalize: "Finalisation", finalise: "Finalisation",
  generate: "Generation", create: "Creation",
  send: "Dispatch", notify: "Notification",
  setup: "Setup", activate: "Activation",
  submit: "Submission", prepare: "Preparation",
  open: "Opening", close: "Closure", issue: "Issuance",
  initiate: "Initiation", manage: "Management",
  check: "Checking", screen: "Screening", scan: "Scanning",
  register: "Registration", enroll: "Enrolment", enrol: "Enrolment",
  record: "Recording", enter: "Data Entry",
  schedule: "Scheduling", assign: "Assignment",
  confirm: "Confirmation", monitor: "Monitoring",
};

const SKIP_SUBJECTS = new Set([
  "customer", "client", "user", "applicant", "the", "a", "an",
  "new", "existing", "all", "any", "each",
]);

function deriveCapabilityName(steps: Array<{ name: string }>, groupIndex: number): string {
  if (steps.length === 0) return `Phase ${groupIndex + 1}`;
  const firstStep = steps[0].name.trim();
  const words = firstStep.split(/\s+/);
  const verb = words[0]?.toLowerCase() ?? "";
  const nounForm = VERB_TO_NOUN[verb];
  const subjectWords = words.slice(1).filter((w) => !SKIP_SUBJECTS.has(w.toLowerCase())).slice(0, 3);
  if (nounForm && subjectWords.length > 0) return `${subjectWords.join(" ")} ${nounForm}`;
  if (nounForm) return nounForm;
  // No verb mapping: remaining words ARE the meaningful phrase (e.g. "AML Screening")
  if (subjectWords.length > 0) return subjectWords.slice(0, 3).join(" ");
  return words.slice(0, 4).join(" ");
}

// ── POST /api/process-map/import ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const productName =
      ((formData.get("productName") as string) || "").trim() ||
      "Client Onboarding Management";
    const organizationId = ((formData.get("organizationId") as string) || "").trim();
    const businessSegment =
      ((formData.get("businessSegment") as string) || "").trim() || null;
    const capabilityGroupsOverride = parseInt((formData.get("capabilityGroups") as string) || "0", 10) || 0;
    // User-specified units for time columns (override header-based detection)
    const ptUnitOverride = ((formData.get("ptUnit") as string) || "").trim() as TimeUnit | "";
    const wtUnitOverride = ((formData.get("wtUnit") as string) || "").trim() as TimeUnit | "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // ── Parse file ──────────────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Auto-detect header row: probe each of the first 20 rows as a candidate
    // header row using the same findColumn() logic. This reliably handles Excel
    // templates with title rows, blank rows, merged cells, or metadata rows
    // above the actual column headers.
    const STEP_COL_CANDIDATES = [
      "Step Name", "Step", "Process Step", "Activity",
      "Task", "Process", "Name", "Description",
    ];
    let headerRowOffset = 0;
    for (let tryRow = 0; tryRow < 20; tryRow++) {
      const probe = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        range: tryRow,
      });
      const probeHeaders = Object.keys(probe[0] ?? {});
      if (probeHeaders.length > 0 && findColumn(probeHeaders, STEP_COL_CANDIDATES)) {
        headerRowOffset = tryRow;
        break;
      }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      range: headerRowOffset,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Excel file has no data rows" },
        { status: 400 }
      );
    }

    const headers = Object.keys(rows[0]);

    // ── Detect columns ──────────────────────────────────────────────────────
    const stepCol = findColumn(headers, [
      "Step Name", "Step", "Process Step", "Activity",
      "Task", "Process", "Name", "Description",
    ]);
    const ptCol = findColumn(headers, [
      "Process Time", "PT", "Active Process Time", "Active Time",
      "Process Time (hrs)", "PT (hrs)", "Process Time (Hours)",
      "Value Adding Time", "VA Time", "Value Time",
      "Processing Time", "Activity Time", "Cycle Time",
      "Task Time", "Touch Time", "Handling Time",
    ]);
    const wtCol = findColumn(headers, [
      "Wait Time", "WT", "Wait Time (hrs)", "WT (hrs)",
      "Wait Time (Hours)", "Non-Value Time", "NVA Time",
      "Delay Time", "Queue Time",
    ]);
    const classCol = findColumn(headers, [
      "Classification", "Type", "Class", "Category",
      "Step Type", "Step Classification", "Value",
    ]);
    const phaseCol = findColumn(headers, [
      "Phase", "Group", "Module", "Stage", "Section", "Area",
    ]);

    if (!stepCol) {
      const detected = headers.slice(0, 8).join(", ") || "(none)";
      return NextResponse.json(
        {
          error:
            `Could not detect the Step Name column. Columns detected: ${detected}. ` +
            `Please ensure your Excel has a column named 'Step', 'Step Name', 'Process Step', 'Activity', or 'Task'.`,
        },
        { status: 400 }
      );
    }

    // ── Parse rows ──────────────────────────────────────────────────────────
    interface ParsedStep {
      name: string;
      processTime: number;
      waitTime: number;
      classification: "value-adding" | "bottleneck" | "waste";
      phase: string;
    }

    // UOM resolution:
    //  1. User explicitly selected a unit in the modal → use it (highest priority)
    //  2. Column header names a unit (e.g. "Process Time (min)") → use that
    //  3. Analyse raw numeric values: if median > 16 it's almost certainly minutes
    const headerPtUnit = detectColumnUnit(ptCol);
    const headerWtUnit = detectColumnUnit(wtCol);

    // Collect raw numeric values for value-based fallback (only when header gives no unit)
    let ptUnit: TimeUnit;
    let wtUnit: TimeUnit;
    if (ptUnitOverride) {
      ptUnit = ptUnitOverride;
    } else if (headerPtUnit !== "hours") {
      ptUnit = headerPtUnit;
    } else {
      // Sample raw values (treat as plain numbers, no unit conversion yet)
      const rawPtVals = ptCol
        ? rows.map((r) => (typeof r[ptCol] === "number" ? (r[ptCol] as number) : parseFloat(String(r[ptCol] ?? "")) || 0))
        : [];
      ptUnit = detectColumnUnitFromValues(rawPtVals);
    }

    if (wtUnitOverride) {
      wtUnit = wtUnitOverride;
    } else if (headerWtUnit !== "hours") {
      wtUnit = headerWtUnit;
    } else {
      const rawWtVals = wtCol
        ? rows.map((r) => (typeof r[wtCol] === "number" ? (r[wtCol] as number) : parseFloat(String(r[wtCol] ?? "")) || 0))
        : [];
      wtUnit = detectWtUnitFromValues(rawWtVals);
    }

    // Capture first 5 raw cell values for debug output
    const rawPtSample = ptCol ? rows.slice(0, 5).map((r) => r[ptCol]) : [];
    const rawWtSample = wtCol ? rows.slice(0, 5).map((r) => r[wtCol]) : [];
    console.log(`[import] ptUnitOverride="${ptUnitOverride}" wtUnitOverride="${wtUnitOverride}" → ptUnit="${ptUnit}" wtUnit="${wtUnit}"`);
    console.log(`[import] columns: step="${stepCol}" pt="${ptCol}" wt="${wtCol}"`);
    console.log(`[import] raw PT sample:`, rawPtSample);
    console.log(`[import] raw WT sample:`, rawWtSample);

    const steps: ParsedStep[] = [];
    for (const row of rows) {
      const name = String(row[stepCol] ?? "").trim();
      if (!name) continue;

      const processTime = ptCol ? toNumber(row[ptCol], ptUnit) : 0;
      const waitTime = wtCol ? toNumber(row[wtCol], wtUnit) : 0;

      let classification: "value-adding" | "bottleneck" | "waste";
      if (classCol && String(row[classCol]).trim()) {
        classification =
          parseClassification(String(row[classCol])) ??
          inferClassification(processTime, waitTime);
      } else {
        classification = inferClassification(processTime, waitTime);
      }

      const phase = phaseCol ? String(row[phaseCol] ?? "").trim() : "";
      steps.push({ name, processTime, waitTime, classification, phase });
    }

    if (steps.length === 0) {
      return NextResponse.json(
        { error: "No valid process steps found in the file" },
        { status: 400 }
      );
    }

    // ── Group steps into capability groups ──────────────────────────────────
    interface CapabilityGroup {
      name: string;
      steps: ParsedStep[];
    }

    const distinctPhases = phaseCol
      ? [...new Set(steps.map((s) => s.phase).filter(Boolean))]
      : [];

    let capabilityGroups: CapabilityGroup[];
    if (distinctPhases.length > 1) {
      // Use Phase column grouping
      capabilityGroups = distinctPhases.map((phase) => ({
        name: phase,
        steps: steps.filter((s) => s.phase === phase),
      }));
      const ungrouped = steps.filter((s) => !s.phase);
      if (ungrouped.length > 0) {
        capabilityGroups.push({ name: "General", steps: ungrouped });
      }
    } else if (capabilityGroupsOverride > 1) {
      // User specified N groups — split steps evenly, name each from first step
      const groupSize = Math.ceil(steps.length / capabilityGroupsOverride);
      capabilityGroups = [];
      for (let g = 0; g < capabilityGroupsOverride; g++) {
        const chunk = steps.slice(g * groupSize, (g + 1) * groupSize);
        if (chunk.length > 0) {
          capabilityGroups.push({ name: deriveCapabilityName(chunk, g), steps: chunk });
        }
      }
    } else if (steps.length > 10) {
      // No phase column and no override: auto-split into logical groups of ~6 steps.
      // Name each group based on its first step rather than generic "Phase N" labels.
      const groupCount = Math.max(3, Math.ceil(steps.length / 6));
      const groupSize = Math.ceil(steps.length / groupCount);
      capabilityGroups = [];
      for (let g = 0; g < groupCount; g++) {
        const chunk = steps.slice(g * groupSize, (g + 1) * groupSize);
        if (chunk.length > 0) {
          capabilityGroups.push({ name: deriveCapabilityName(chunk, g), steps: chunk });
        }
      }
    } else {
      // Small process (≤10 steps): one capability is appropriate
      capabilityGroups = [{ name: `${productName} Process`, steps }];
    }

    // ── Find or create Repository for org ───────────────────────────────────
    let repository = await prisma.repository.findFirst({
      where: { organizationId },
    });
    if (!repository) {
      repository = await prisma.repository.create({
        data: {
          name: `${productName} Repository`,
          description: `Auto-created for ${productName} process map import`,
          organizationId,
        },
      });
    }

    // ── Find or create DigitalProduct ────────────────────────────────────────
    let product = await prisma.digitalProduct.findFirst({
      where: { name: productName, repository: { organizationId } },
    });
    if (!product) {
      product = await prisma.digitalProduct.create({
        data: {
          name: productName,
          description: `Imported from process map: ${file.name}`,
          currentState: `${steps.length} process steps across ${capabilityGroups.length} capability area${capabilityGroups.length > 1 ? "s" : ""}`,
          businessSegment,
          repositoryId: repository.id,
        },
      });
    } else if (businessSegment && !product.businessSegment) {
      product = await prisma.digitalProduct.update({
        where: { id: product.id },
        data: { businessSegment },
      });
    }

    // ── Create/replace Capabilities + VsmMetrics ─────────────────────────────
    // On re-import, wipe ALL PROCESS_MAP capabilities (and older null-category ones that have
    // vsmMetrics) so stale data from previous imports is never left behind.
    const oldProcessMapCaps = await prisma.digitalCapability.findMany({
      where: {
        digitalProductId: product.id,
        OR: [
          { category: "PROCESS_MAP" },
          { category: null, vsmMetrics: { some: {} } },
        ],
      },
      select: { id: true },
    });
    if (oldProcessMapCaps.length > 0) {
      const oldIds = oldProcessMapCaps.map((c) => c.id);
      // RoadmapItem has non-cascade FKs — null them before deleting capabilities
      const oldFuncs = await prisma.functionality.findMany({
        where: { digitalCapabilityId: { in: oldIds } },
        select: { id: true },
      });
      const oldFuncIds = oldFuncs.map((f) => f.id);
      if (oldFuncIds.length > 0) {
        await prisma.roadmapItem.updateMany({
          where: { functionalityId: { in: oldFuncIds } },
          data: { functionalityId: null },
        });
      }
      await prisma.roadmapItem.updateMany({
        where: { digitalCapabilityId: { in: oldIds } },
        data: { digitalCapabilityId: null },
      });
      await prisma.vsmMetrics.deleteMany({ where: { digitalCapabilityId: { in: oldIds } } });
      await prisma.digitalCapability.deleteMany({ where: { id: { in: oldIds } } });
    }

    const createdCapabilities: {
      id: string;
      name: string;
      steps: number;
      processTime: number;
      waitTime: number;
      flowEfficiency: number;
    }[] = [];

    for (const group of capabilityGroups) {
      if (group.steps.length === 0) continue;

      const totalPT = group.steps.reduce((s, r) => s + r.processTime, 0);
      const totalWT = group.steps.reduce((s, r) => s + r.waitTime, 0);
      const totalLT = totalPT + totalWT || 1; // avoid div/0
      const flowEfficiency = (totalPT / totalLT) * 100;

      const capability = await prisma.digitalCapability.create({
        data: {
          name: group.name,
          description: `${group.steps.length} steps — PT: ${totalPT.toFixed(1)}h, WT: ${totalWT.toFixed(1)}h, FE: ${flowEfficiency.toFixed(1)}%`,
          category: "PROCESS_MAP",
          digitalProductId: product.id,
        },
      });

      await prisma.vsmMetrics.create({
        data: {
          processTime: Math.round(totalPT * 10) / 10,
          leadTime: Math.round(totalLT * 10) / 10,
          waitTime: Math.round(totalWT * 10) / 10,
          flowEfficiency: Math.round(flowEfficiency * 10) / 10,
          mermaidSource: generateMermaid(group.steps),
          digitalCapabilityId: capability.id,
        },
      });

      // ── Create Functionality records for each step (L2/L3 BPMN hierarchy) ──
      // Timing is stored as JSON in description so the VSM page can render L2 flows
      // without a schema migration. Discovery-created functionalities have plain text.
      for (const step of group.steps) {
        await prisma.functionality.create({
          data: {
            name: step.name,
            description: JSON.stringify({
              pt: Math.round(step.processTime * 1000) / 1000,
              wt: Math.round(step.waitTime * 1000) / 1000,
              classification: step.classification,
            }),
            digitalCapabilityId: capability.id,
          },
        });
      }

      createdCapabilities.push({
        id: capability.id,
        name: group.name,
        steps: group.steps.length,
        processTime: Math.round(totalPT * 10) / 10,
        waitTime: Math.round(totalWT * 10) / 10,
        flowEfficiency: Math.round(flowEfficiency * 10) / 10,
      });
    }

    // Register the uploaded file in Context Hub so it appears there too
    await prisma.contextDocument.create({
      data: {
        organizationId,
        fileName: file.name,
        fileType: file.name.toLowerCase().endsWith(".csv")
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileSize: file.size,
        filePath: `process-map-imports/${file.name}`,
        category: "CURRENT_STATE",
        subCategory: "Process Map",
        status: "PROCESSED",
        chunkCount: steps.length,
        metadata: {
          productId: product.id,
          productName: product.name,
          totalSteps: steps.length,
          capabilities: createdCapabilities.map((c) => c.name),
        },
      },
    });

    return NextResponse.json({
      productId: product.id,
      productName: product.name,
      capabilities: createdCapabilities,
      totalSteps: steps.length,
      detectedUnits: { pt: ptUnit, wt: wtUnit },
      debug: {
        columns: { step: stepCol ?? null, pt: ptCol ?? null, wt: wtCol ?? null },
        allHeaders: headers,
        rawSample: {
          pt: rawPtSample,
          wt: rawWtSample,
        },
        parsedSample: steps.slice(0, 5).map((s) => ({
          name: s.name,
          processTime: s.processTime,
          waitTime: s.waitTime,
        })),
      },
    });
  } catch (error) {
    console.error("Process map import error:", error);
    return NextResponse.json(
      { error: "Failed to import process map" },
      { status: 500 }
    );
  }
}
