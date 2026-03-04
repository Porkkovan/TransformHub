import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { buildXLSX } from "@/lib/export/xlsx";
import { renderFutureStatePDF } from "@/lib/export/pdf";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const productId = searchParams.get("productId") || undefined;
    const format = searchParams.get("format") || "xlsx";

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    // Get latest future_state_vision execution
    const execution = await prisma.agentExecution.findFirst({
      where: { organizationId: orgId, agentType: "future_state_vision", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    const output = execution?.output as Record<string, unknown> | null;
    const rawCaps: unknown[] = Array.isArray(output?.capabilities) ? (output.capabilities as unknown[]) : [];
    const rawStreams: unknown[] = Array.isArray(output?.future_value_streams) ? (output.future_value_streams as unknown[]) : [];
    const visionReport: string = typeof output?.vision_report === "string" ? output.vision_report : "";

    // Filter by product if needed
    const products = await prisma.digitalProduct.findMany({
      where: {
        repository: { organizationId: orgId },
        ...(productId ? { id: productId } : {}),
      },
      include: {
        digitalCapabilities: { select: { name: true, category: true } },
      },
      orderBy: { name: "asc" },
    });

    const productNameFilter = productId ? products[0]?.name?.toLowerCase() : null;

    type Cap = {
      name: string;
      category: string;
      description: string;
      businessImpact: string;
      complexity: string;
      product_name: string;
      estimated_roi_pct: number | null;
    };

    const caps: Cap[] = rawCaps
      .filter((c: unknown): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .filter((c) => {
        if (!productNameFilter) return true;
        const pn = String(c.product_name ?? "").toLowerCase();
        return pn.includes(productNameFilter) || productNameFilter.includes(pn);
      })
      .map((c) => ({
        name: String(c.name ?? ""),
        category: String(c.category ?? ""),
        description: String(c.description ?? ""),
        businessImpact: String(c.businessImpact ?? c.business_impact ?? "MEDIUM"),
        complexity: String(c.complexity ?? c.implementation_complexity ?? "MEDIUM"),
        product_name: String(c.product_name ?? ""),
        estimated_roi_pct: typeof c.estimated_roi_pct === "number" ? c.estimated_roi_pct : null,
      }));

    type Stream = {
      product_name: string;
      efficiency_gain_pct: number;
      headcount_impact: string;
      customer_experience_improvement: string;
      future_steps: { name: string; type: string; duration_hours: number }[];
    };

    const streams: Stream[] = rawStreams
      .filter((s: unknown): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        product_name: String(s.product_name ?? ""),
        efficiency_gain_pct: typeof s.efficiency_gain_pct === "number" ? s.efficiency_gain_pct : 0,
        headcount_impact: String(s.headcount_impact ?? ""),
        customer_experience_improvement: String(s.customer_experience_improvement ?? ""),
        future_steps: Array.isArray(s.future_steps)
          ? (s.future_steps as Record<string, unknown>[]).map((step) => ({
              name: String(step.name ?? ""),
              type: String(step.type ?? ""),
              duration_hours: typeof step.duration_hours === "number" ? step.duration_hours : 0,
            }))
          : [],
      }));

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `transformhub-future-state-${ts}`;
    const productName = productId ? products[0]?.name || "product" : "All Products";

    if (format === "pdf") {
      const buffer = await renderFutureStatePDF({
        orgName: org.name,
        productName,
        futureCaps: caps.map((c) => ({ ...c, estimatedRoiPct: c.estimated_roi_pct })),
        futureValueStreams: streams,
      });
      return new NextResponse(Uint8Array.from(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    // ── XLSX ────────────────────────────────────────────────────────────────
    // Sheet 1: Products & Vision
    const productRows = products.map((p) => {
      const productCaps = caps.filter((c) => {
        const pn = c.product_name.toLowerCase();
        const prodName = p.name.toLowerCase();
        return pn.includes(prodName) || prodName.includes(pn);
      });
      return [
        p.name,
        p.businessSegment || "",
        p.digitalCapabilities.length,
        productCaps.length,
        p.digitalCapabilities.map((c) => c.name).join("; ").slice(0, 200),
      ];
    });

    // Sheet 2: Future Capabilities
    const capRows = caps.map((c) => [
      c.product_name,
      c.name,
      c.category.replace(/_/g, " "),
      c.description,
      c.businessImpact,
      c.complexity,
      c.estimated_roi_pct != null ? c.estimated_roi_pct : "",
    ]);

    // Sheet 3: Value Streams
    const streamRows = streams.flatMap((v) =>
      v.future_steps.map((step) => [
        v.product_name,
        step.name,
        step.type,
        step.duration_hours,
        `${v.efficiency_gain_pct.toFixed(0)}%`,
        v.headcount_impact,
        v.customer_experience_improvement,
      ])
    );

    // Sheet 4: Vision Report excerpt
    const reportRows = visionReport
      ? visionReport
          .split("\n")
          .filter((line) => line.trim())
          .slice(0, 200)
          .map((line) => [line])
      : [["No vision report available. Run the Future State Vision agent first."]];

    const buffer = buildXLSX([
      {
        name: "Products & Vision",
        headers: ["Product", "Segment", "Current Capabilities", "Future Capabilities (AI)", "Current Capabilities List"],
        rows: productRows,
        colWidths: [30, 20, 22, 24, 80],
      },
      {
        name: "Future Capabilities",
        headers: ["Product", "Capability Name", "Category", "Description", "Business Impact", "Complexity", "Est. ROI %"],
        rows: capRows,
        colWidths: [26, 30, 22, 60, 16, 14, 12],
      },
      {
        name: "Future Value Streams",
        headers: ["Product", "Step Name", "Step Type", "Duration (h)", "Efficiency Gain", "Headcount Impact", "CX Improvement"],
        rows: streamRows,
        colWidths: [24, 30, 18, 12, 16, 30, 40],
      },
      {
        name: "Vision Report",
        headers: ["Vision Report Content"],
        rows: reportRows,
        colWidths: [120],
      },
    ]);

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Future state export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
