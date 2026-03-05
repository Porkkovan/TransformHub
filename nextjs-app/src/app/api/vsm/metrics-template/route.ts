import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

/**
 * GET /api/vsm/metrics-template?productId=X
 *
 * Returns an XLSX file pre-filled with the product's capability names
 * and existing PT/WT/LT values (or blanks if none yet).
 * User fills in / edits the numbers, saves, and uploads via /api/vsm/metrics-update.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }

    const product = await prisma.digitalProduct.findUnique({
      where: { id: productId },
      select: {
        name: true,
        digitalCapabilities: {
          orderBy: { createdAt: "asc" },
          select: {
            name: true,
            vsmMetrics: {
              take: 1,
              select: { processTime: true, waitTime: true, leadTime: true, flowEfficiency: true },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // ── Build worksheet rows ───────────────────────────────────────────────
    type Row = {
      Capability: string;
      Process_Time_hrs: number | string;
      Wait_Time_hrs: number | string;
      Lead_Time_hrs: number | string;
      Flow_Efficiency_pct: number | string;
      Notes: string;
    };

    const dataRows: Row[] = product.digitalCapabilities.map((cap) => {
      const m = cap.vsmMetrics[0];
      return {
        Capability: cap.name,
        Process_Time_hrs: m ? +m.processTime.toFixed(2) : "",
        Wait_Time_hrs: m ? +m.waitTime.toFixed(2) : "",
        Lead_Time_hrs: m ? +m.leadTime.toFixed(2) : "",
        Flow_Efficiency_pct: m ? +m.flowEfficiency.toFixed(1) : "",
        Notes: "",
      };
    });

    // ── Instructions row at top ────────────────────────────────────────────
    const instructionRows = [
      {
        Capability: "# INSTRUCTIONS",
        Process_Time_hrs: "Fill in PT & WT columns (hours). Lead_Time = PT + WT (auto-calculated on upload). Delete this row before uploading.",
        Wait_Time_hrs: "",
        Lead_Time_hrs: "",
        Flow_Efficiency_pct: "",
        Notes: "",
      },
    ];

    const allRows = [...instructionRows, ...dataRows];

    const ws = XLSX.utils.json_to_sheet(allRows);

    // Column widths
    ws["!cols"] = [
      { wch: 30 }, // Capability
      { wch: 18 }, // PT
      { wch: 16 }, // WT
      { wch: 16 }, // LT
      { wch: 20 }, // FE
      { wch: 40 }, // Notes
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VSM Metrics");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const safeName = product.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    return new NextResponse(xlsxBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="vsm_metrics_${safeName}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("vsm/metrics-template error:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
