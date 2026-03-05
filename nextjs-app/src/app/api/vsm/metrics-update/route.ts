import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

/**
 * POST /api/vsm/metrics-update
 * FormData: { productId: string, file: CSV or XLSX }
 *
 * Reads rows with columns:
 *   Capability | Process_Time_hrs | Wait_Time_hrs | Lead_Time_hrs (optional)
 *
 * Fuzzy column matching — accepts many header variants.
 * For each matched capability, deletes old vsm_metrics and inserts new ones.
 *
 * Returns:
 *   { updated: [{name, pt, wt, lt, fe}], unmatched: string[], total: number }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const form = await request.formData();
    const productId = form.get("productId") as string | null;
    const file = form.get("file") as File | null;

    if (!productId || !file) {
      return NextResponse.json({ error: "productId and file are required" }, { status: 400 });
    }

    // ── 1. Parse file ──────────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty or unreadable" }, { status: 400 });
    }

    const headers = Object.keys(rows[0]);

    // ── 2. Find columns (fuzzy) ────────────────────────────────────────────
    function findCol(candidates: string[]): string | null {
      for (const h of headers) {
        const norm = h.toLowerCase().replace(/[\s_\-()/]/g, "");
        for (const c of candidates) {
          if (norm === c || norm.includes(c)) return h;
        }
      }
      return null;
    }

    const capCol = findCol(["capability", "capabilityname", "name", "step", "process", "activity", "feature"]);
    const ptCol  = findCol(["processtime", "pt", "processingtime", "process", "valuetime", "pthr", "pthrs"]);
    const wtCol  = findCol(["waittime", "wt", "queuetime", "deltime", "waithr", "waithrs"]);
    const ltCol  = findCol(["leadtime", "lt", "totaltime", "cycletime", "lthr", "lthrs"]);

    if (!capCol) {
      return NextResponse.json({
        error: `Could not find a capability name column. Headers found: ${headers.join(", ")}. Expected a column named "Capability" or "Name".`,
      }, { status: 400 });
    }
    if (!ptCol || !wtCol) {
      return NextResponse.json({
        error: `Could not find PT/WT columns. Headers found: ${headers.join(", ")}. Expected "Process_Time_hrs" and "Wait_Time_hrs".`,
      }, { status: 400 });
    }

    // ── 3. Load capabilities for this product ─────────────────────────────
    const product = await prisma.digitalProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        digitalCapabilities: {
          select: { id: true, name: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const capByName = new Map(
      product.digitalCapabilities.map((c) => [c.name.toLowerCase().trim(), c])
    );

    // ── 4. Process rows ────────────────────────────────────────────────────
    function toNum(val: unknown): number {
      if (typeof val === "number") return isNaN(val) ? 0 : val;
      const s = String(val ?? "").replace(/[^0-9.]/g, "");
      return parseFloat(s) || 0;
    }

    const updated: { name: string; pt: number; wt: number; lt: number; fe: number }[] = [];
    const unmatched: string[] = [];

    for (const row of rows) {
      const capName = String(row[capCol] ?? "").trim();
      if (!capName) continue;

      const cap = capByName.get(capName.toLowerCase().trim());
      if (!cap) {
        unmatched.push(capName);
        continue;
      }

      const pt = toNum(row[ptCol]);
      const wt = toNum(row[wtCol]);
      const lt = ltCol ? toNum(row[ltCol]) : pt + wt;
      const fe = (pt + wt) > 0 ? (pt / (pt + wt)) * 100 : 0;

      // Delete existing metrics then insert fresh
      await prisma.vsmMetrics.deleteMany({ where: { digitalCapabilityId: cap.id } });
      await prisma.vsmMetrics.create({
        data: {
          digitalCapabilityId: cap.id,
          processTime: pt,
          waitTime: wt,
          leadTime: lt,
          flowEfficiency: fe,
        },
      });

      updated.push({ name: cap.name, pt, wt, lt, fe: Math.round(fe * 10) / 10 });
    }

    return NextResponse.json({
      updated,
      unmatched,
      total: product.digitalCapabilities.length,
      message: `Updated ${updated.length} of ${product.digitalCapabilities.length} capabilities`,
    });
  } catch (error) {
    console.error("vsm/metrics-update error:", error);
    return NextResponse.json({ error: "Failed to update VSM metrics" }, { status: 500 });
  }
}
