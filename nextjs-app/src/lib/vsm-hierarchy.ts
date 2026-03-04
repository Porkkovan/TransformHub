/**
 * VSM Hierarchy — 3-level BPMN process model
 *
 * L1  Digital Product   → capabilities as process nodes (rollup metrics)
 * L2  Capability        → functionalities as process nodes (with PT/WT)
 * L3  Functionality     → granular steps (existing mermaidSource from import)
 *
 * Functionality.description stores timing as JSON when created by process map import:
 *   { pt: number, wt: number, classification: "value-adding"|"bottleneck"|"waste" }
 * Discovery-created functionalities have plain-text descriptions — no timing data.
 */

export type BpmnClassification = "value-adding" | "bottleneck" | "waste";

export interface FunctionalityTiming {
  pt: number;
  wt: number;
  classification: BpmnClassification;
}

// ─── Timing helpers ──────────────────────────────────────────────────────────

/**
 * Parse timing JSON from Functionality.description.
 * Returns null for Discovery-created functionalities (plain text).
 */
export function parseFunctionalityTiming(
  description: string | null | undefined
): FunctionalityTiming | null {
  if (!description) return null;
  try {
    const obj = JSON.parse(description);
    if (typeof obj.pt === "number" && typeof obj.wt === "number") {
      return {
        pt: obj.pt,
        wt: obj.wt,
        classification: (obj.classification as BpmnClassification) ?? "value-adding",
      };
    }
  } catch {
    // Plain text description — Discovery-created functionality
  }
  return null;
}

/** Rollup PT/WT/FE for a set of functionalities that have timing JSON. */
export function computeCapabilityRollup(
  functionalities: Array<{ description?: string | null }>
): { pt: number; wt: number; lt: number; fe: number } | null {
  let pt = 0, wt = 0, hasData = false;
  for (const f of functionalities) {
    const t = parseFunctionalityTiming(f.description);
    if (t) { pt += t.pt; wt += t.wt; hasData = true; }
  }
  if (!hasData) return null;
  const lt = pt + wt || 1;
  return { pt, wt, lt, fe: (pt / lt) * 100 };
}

/** Classify a flow-efficiency value as a BPMN colour class. */
function feClass(fe: number): string {
  if (fe >= 40) return "value";
  if (fe >= 20) return "bottleneck";
  return "waste";
}

function sanitize(name: string, prefix: string, idx: number): string {
  // Include idx to prevent collisions when step names share the same first N chars
  return `${prefix}${idx}_${name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)}`;
}

// ─── L1 Mermaid ──────────────────────────────────────────────────────────────

/**
 * Generate an L1 Mermaid diagram: one node per capability.
 * Node colour = flow-efficiency class (green/amber/red) or grey when no data.
 * Label includes PT / WT / FE when vsmMetrics are available.
 */
export function generateL1Mermaid(
  capabilities: Array<{
    id: string;
    name: string;
    vsmMetrics?: Array<{ processTime: number; waitTime: number; flowEfficiency: number }> | null;
    functionalities?: Array<{ description?: string | null }> | null;
  }>
): string {
  if (capabilities.length === 0) return "";

  const lines = [
    "graph LR",
    "  classDef value fill:#22c55e,stroke:#16a34a,color:#fff",
    "  classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff",
    "  classDef waste fill:#ef4444,stroke:#dc2626,color:#fff",
    "  classDef nodata fill:#1e293b,stroke:#475569,color:#94a3b8",
  ];

  const ids: string[] = [];

  for (const [i, cap] of capabilities.entries()) {
    const id = sanitize(cap.name, "L1", i);
    ids.push(id);

    let pt = 0, wt = 0, fe = 0, hasData = false;

    if (cap.vsmMetrics && cap.vsmMetrics.length > 0) {
      const m = cap.vsmMetrics[0];
      pt = m.processTime; wt = m.waitTime; fe = m.flowEfficiency;
      hasData = true;
    } else if (cap.functionalities && cap.functionalities.length > 0) {
      const rollup = computeCapabilityRollup(cap.functionalities);
      if (rollup) { pt = rollup.pt; wt = rollup.wt; fe = rollup.fe; hasData = true; }
    }

    const escaped = cap.name.replace(/"/g, "'").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
    const label = hasData
      ? `${escaped}<br/>PT ${pt.toFixed(1)}h - WT ${wt.toFixed(1)}h - FE ${fe.toFixed(0)}%`
      : escaped;
    const cls = hasData ? feClass(fe) : "nodata";
    lines.push(`  ${id}["${label}"]:::${cls}`);
  }

  for (let i = 0; i < ids.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }

  return lines.join("\n");
}

// ─── L2 Mermaid ──────────────────────────────────────────────────────────────

/**
 * Generate an L2 Mermaid diagram: one node per functionality.
 * Nodes with timing JSON get colour + PT/WT label; others are grey.
 */
export function generateL2Mermaid(
  functionalities: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>
): string {
  if (functionalities.length === 0) return "";

  const lines = [
    "graph LR",
    "  classDef value fill:#22c55e,stroke:#16a34a,color:#fff",
    "  classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff",
    "  classDef waste fill:#ef4444,stroke:#dc2626,color:#fff",
    "  classDef nodata fill:#1e293b,stroke:#475569,color:#94a3b8",
  ];

  const ids: string[] = [];

  for (const [i, func] of functionalities.entries()) {
    const id = sanitize(func.name, "L2", i);
    ids.push(id);
    const timing = parseFunctionalityTiming(func.description);
    const escaped = func.name.replace(/"/g, "'").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

    if (timing) {
      const clsMap: Record<BpmnClassification, string> = {
        "value-adding": "value",
        bottleneck: "bottleneck",
        waste: "waste",
      };
      const label = `${escaped}<br/>PT ${timing.pt.toFixed(1)}h - WT ${timing.wt.toFixed(1)}h`;
      lines.push(`  ${id}["${label}"]:::${clsMap[timing.classification]}`);
    } else {
      lines.push(`  ${id}["${escaped}"]:::nodata`);
    }
  }

  for (let i = 0; i < ids.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }

  return lines.join("\n");
}

// ─── Step classification helpers ─────────────────────────────────────────────

export interface HierarchyStep {
  name: string;
  classification: BpmnClassification;
  duration: number;
  processTime: number;
  waitTime: number;
  percentOfLeadTime: number;
}

/** Build StepClassificationPanel data for L1 (capabilities). */
export function buildL1Steps(
  capabilities: Array<{
    name: string;
    vsmMetrics?: Array<{ processTime: number; waitTime: number; flowEfficiency: number; leadTime: number }> | null;
    functionalities?: Array<{ description?: string | null }> | null;
  }>
): HierarchyStep[] {
  const steps: Omit<HierarchyStep, "percentOfLeadTime">[] = [];

  for (const cap of capabilities) {
    let pt = 0, wt = 0;
    if (cap.vsmMetrics && cap.vsmMetrics.length > 0) {
      pt = cap.vsmMetrics[0].processTime;
      wt = cap.vsmMetrics[0].waitTime;
    } else if (cap.functionalities) {
      const r = computeCapabilityRollup(cap.functionalities);
      if (r) { pt = r.pt; wt = r.wt; }
    }
    const fe = (pt + wt) > 0 ? (pt / (pt + wt)) * 100 : 0;
    const cls: BpmnClassification = fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste";
    steps.push({ name: cap.name, classification: cls, duration: pt + wt, processTime: pt, waitTime: wt });
  }

  const totalLT = steps.reduce((s, x) => s + x.duration, 0) || 1;
  return steps.map((s) => ({
    ...s,
    percentOfLeadTime: Math.round((s.duration / totalLT) * 100),
  }));
}

// ─── Segment-level (L1) Mermaid ──────────────────────────────────────────────

/**
 * Generate a segment-level Mermaid diagram: one node per digital product.
 * Node colour reflects flow-efficiency rollup across the product's capabilities.
 */
export function generateProductsMermaid(
  products: Array<{
    name: string;
    digitalCapabilities?: Array<{
      vsmMetrics?: Array<{ processTime: number; waitTime: number; flowEfficiency: number }> | null;
      functionalities?: Array<{ description?: string | null }> | null;
    }> | null;
  }>
): string {
  if (products.length === 0) return "";

  const lines = [
    "graph LR",
    "  classDef value fill:#22c55e,stroke:#16a34a,color:#fff",
    "  classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff",
    "  classDef waste fill:#ef4444,stroke:#dc2626,color:#fff",
    "  classDef nodata fill:#1e293b,stroke:#475569,color:#94a3b8",
  ];

  const ids: string[] = [];
  for (const [i, product] of products.entries()) {
    const caps = product.digitalCapabilities ?? [];
    let pt = 0, wt = 0, hasData = false;
    const withMetrics = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
    if (withMetrics.length > 0) {
      pt = withMetrics.reduce((s, c) => s + c.vsmMetrics![0].processTime, 0);
      wt = withMetrics.reduce((s, c) => s + c.vsmMetrics![0].waitTime, 0);
      hasData = true;
    } else {
      for (const cap of caps) {
        const r = computeCapabilityRollup(cap.functionalities ?? []);
        if (r) { pt += r.pt; wt += r.wt; hasData = true; }
      }
    }
    const lt = pt + wt || 1;
    const fe = (pt / lt) * 100;
    const id = sanitize(product.name, "P", i);
    ids.push(id);
    const escaped = product.name.replace(/"/g, "'").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
    const label = hasData
      ? `${escaped}<br/>PT ${pt.toFixed(1)}h - FE ${fe.toFixed(0)}%`
      : escaped;
    const cls = hasData ? feClass(fe) : "nodata";
    lines.push(`  ${id}["${label}"]:::${cls}`);
  }

  for (let i = 0; i < ids.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }

  return lines.join("\n");
}

/** Build StepClassificationPanel data for Segment Level (one entry per product). */
export function buildProductSteps(
  products: Array<{
    name: string;
    digitalCapabilities?: Array<{
      vsmMetrics?: Array<{ processTime: number; waitTime: number; flowEfficiency: number }> | null;
      functionalities?: Array<{ description?: string | null }> | null;
    }> | null;
  }>
): HierarchyStep[] {
  const steps: Omit<HierarchyStep, "percentOfLeadTime">[] = [];

  for (const product of products) {
    const caps = product.digitalCapabilities ?? [];
    let pt = 0, wt = 0;
    const withMetrics = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
    if (withMetrics.length > 0) {
      pt = withMetrics.reduce((s, c) => s + c.vsmMetrics![0].processTime, 0);
      wt = withMetrics.reduce((s, c) => s + c.vsmMetrics![0].waitTime, 0);
    } else {
      for (const cap of caps) {
        const r = computeCapabilityRollup(cap.functionalities ?? []);
        if (r) { pt += r.pt; wt += r.wt; }
      }
    }
    const fe = (pt + wt) > 0 ? (pt / (pt + wt)) * 100 : 0;
    const cls: BpmnClassification = fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste";
    steps.push({ name: product.name, classification: cls, duration: pt + wt, processTime: pt, waitTime: wt });
  }

  const totalLT = steps.reduce((s, x) => s + x.duration, 0) || 1;
  return steps.map((s) => ({
    ...s,
    duration: Math.round(s.duration * 10) / 10,
    processTime: Math.round(s.processTime * 10) / 10,
    waitTime: Math.round(s.waitTime * 10) / 10,
    percentOfLeadTime: Math.round((s.duration / totalLT) * 100),
  }));
}

/** Build StepClassificationPanel data for L2 (functionalities). */
export function buildL2Steps(
  functionalities: Array<{ name: string; description?: string | null }>
): HierarchyStep[] {
  const steps: Omit<HierarchyStep, "percentOfLeadTime">[] = [];

  for (const func of functionalities) {
    const t = parseFunctionalityTiming(func.description);
    if (t) {
      steps.push({
        name: func.name,
        classification: t.classification,
        duration: t.pt + t.wt,
        processTime: t.pt,
        waitTime: t.wt,
      });
    } else {
      steps.push({ name: func.name, classification: "value-adding", duration: 0, processTime: 0, waitTime: 0 });
    }
  }

  const totalLT = steps.reduce((s, x) => s + x.duration, 0) || 1;
  return steps.map((s) => ({
    ...s,
    percentOfLeadTime: Math.round((s.duration / totalLT) * 100),
  }));
}
