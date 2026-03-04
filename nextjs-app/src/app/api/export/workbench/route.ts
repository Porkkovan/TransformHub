import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { buildXLSX } from "@/lib/export/xlsx";
import { renderWorkbenchPDF } from "@/lib/export/pdf";

function computeReadiness(caps: { vsmMetrics: { flowEfficiency: number }[]; functionalities: unknown[] }[]) {
  const vsmCaps = caps.filter((c) => c.vsmMetrics.length > 0);
  const vsmCoverage = caps.length > 0 ? vsmCaps.length / caps.length : 0;
  const avgFE = vsmCaps.length > 0
    ? vsmCaps.reduce((s, c) => s + c.vsmMetrics[0].flowEfficiency, 0) / vsmCaps.length
    : 0;
  const depthScore = caps.length > 0
    ? Math.min(caps.reduce((s, c) => s + c.functionalities.length, 0) / caps.length / 5, 1)
    : 0;
  return (vsmCoverage * 3.5 + avgFE * 2.5 + depthScore * 1.5 + 0.7 * 2.5) * 10 / 10;
}

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

    const products = await prisma.digitalProduct.findMany({
      where: {
        repository: { organizationId: orgId },
        ...(productId ? { id: productId } : {}),
      },
      include: {
        digitalCapabilities: {
          include: {
            functionalities: true,
            vsmMetrics: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { name: "asc" },
        },
        repository: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `transformhub-workbench-${ts}`;
    const productLabel = productId ? products[0]?.name || "product" : "all-products";

    if (format === "pdf") {
      const product = products[0];
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      const readinessScore = computeReadiness(product.digitalCapabilities);
      const buffer = await renderWorkbenchPDF({
        orgName: org.name,
        product: {
          name: product.name,
          segment: product.businessSegment || "",
          currentState: product.currentState,
          capabilities: product.digitalCapabilities.map((c) => ({
            name: c.name,
            category: c.category || "",
            functionalities: c.functionalities,
            vsmMetrics: c.vsmMetrics,
          })),
        },
        readinessScore,
      });
      return new NextResponse(Uint8Array.from(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}-${productLabel}.pdf"`,
        },
      });
    }

    // ── XLSX ────────────────────────────────────────────────────────────────
    // Sheet 1: Products
    const productRows = products.map((p) => {
      const caps = p.digitalCapabilities;
      const vsmCaps = caps.filter((c) => c.vsmMetrics.length > 0);
      const avgFE = vsmCaps.length > 0
        ? vsmCaps.reduce((s, c) => s + c.vsmMetrics[0].flowEfficiency, 0) / vsmCaps.length
        : null;
      const totalFuncs = caps.reduce((s, c) => s + c.functionalities.length, 0);
      const score = computeReadiness(caps);
      return [
        p.name,
        p.businessSegment || "",
        p.repository?.name || "",
        score.toFixed(1),
        `${caps.length > 0 ? ((vsmCaps.length / caps.length) * 100).toFixed(0) : 0}%`,
        avgFE != null ? `${(avgFE * 100).toFixed(1)}%` : "—",
        caps.length,
        totalFuncs,
        p.currentState || "",
      ];
    });

    // Sheet 2: Capabilities
    const capRows = products.flatMap((p) =>
      p.digitalCapabilities.map((c) => {
        const vsm = c.vsmMetrics[0];
        return [
          p.name,
          c.name,
          c.category || "",
          c.functionalities.length,
          vsm ? vsm.processTime : null,
          vsm ? vsm.waitTime : null,
          vsm ? vsm.leadTime : null,
          vsm ? `${(vsm.flowEfficiency * 100).toFixed(1)}%` : "—",
        ];
      })
    );

    // Sheet 3: Functionalities
    const funcRows = products.flatMap((p) =>
      p.digitalCapabilities.flatMap((c) =>
        c.functionalities.map((f) => [
          p.name,
          c.name,
          c.category || "",
          f.name,
          f.description || "",
          f.sourceFiles.length,
        ])
      )
    );

    const buffer = buildXLSX([
      {
        name: "Products",
        headers: ["Product", "Segment", "Repository", "Readiness Score", "VSM Coverage", "Avg Flow Efficiency", "Capabilities", "Functionalities", "Current State"],
        rows: productRows,
        colWidths: [30, 20, 20, 15, 14, 18, 13, 15, 50],
      },
      {
        name: "Capabilities",
        headers: ["Product", "Capability", "Category", "Funcs", "Process Time (h)", "Wait Time (h)", "Lead Time (h)", "Flow Efficiency"],
        rows: capRows,
        colWidths: [28, 30, 20, 8, 16, 14, 14, 16],
      },
      {
        name: "Functionalities",
        headers: ["Product", "Capability", "Category", "Functionality", "Description", "Source Files"],
        rows: funcRows,
        colWidths: [24, 28, 18, 30, 50, 12],
      },
    ]);

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Workbench export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
