import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { buildXLSX } from "@/lib/export/xlsx";
import { renderDiscoveryPDF } from "@/lib/export/pdf";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const segment = searchParams.get("segment") || undefined;
    const format = searchParams.get("format") || "xlsx";

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const products = await prisma.digitalProduct.findMany({
      where: {
        repository: { organizationId: orgId },
        ...(segment ? { businessSegment: segment } : {}),
      },
      include: {
        digitalCapabilities: {
          include: {
            functionalities: { include: { personaMappings: true } },
            vsmMetrics: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `transformhub-discovery-${ts}`;

    if (format === "pdf") {
      const buffer = await renderDiscoveryPDF({
        orgName: org.name,
        products: products.map((p) => ({
          name: p.name,
          segment: p.businessSegment || "",
          capabilities: p.digitalCapabilities.map((c) => ({
            name: c.name,
            category: c.category || "",
            functionalities: c.functionalities,
            vsmMetrics: c.vsmMetrics,
          })),
        })),
      });
      return new NextResponse(Uint8Array.from(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    // ── XLSX ────────────────────────────────────────────────────────────────
    // Sheet 1: Products Overview
    const overviewRows = products.map((p) => {
      const allVsm = p.digitalCapabilities.flatMap((c) => c.vsmMetrics);
      const avgFE =
        allVsm.length > 0
          ? allVsm.reduce((s, v) => s + v.flowEfficiency, 0) / allVsm.length
          : null;
      const totalFuncs = p.digitalCapabilities.reduce(
        (s, c) => s + c.functionalities.length,
        0
      );
      return [
        p.name,
        p.businessSegment || "",
        p.digitalCapabilities.length,
        totalFuncs,
        avgFE != null ? `${(avgFE * 100).toFixed(1)}%` : "—",
        p.currentState || "",
      ];
    });

    // Sheet 2: Capabilities
    const capRows = products.flatMap((p) =>
      p.digitalCapabilities.map((c) => {
        const vsm = c.vsmMetrics[0];
        return [
          p.name,
          p.businessSegment || "",
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
          p.businessSegment || "",
          c.name,
          c.category || "",
          f.name,
          f.description || "",
          f.sourceFiles.length,
          f.personaMappings.map((pm) => pm.personaName).join(", "),
        ])
      )
    );

    const buffer = buildXLSX([
      {
        name: "Products Overview",
        headers: ["Product", "Segment", "Capabilities", "Functionalities", "Avg Flow Efficiency", "Current State"],
        rows: overviewRows,
        colWidths: [30, 20, 14, 16, 18, 50],
      },
      {
        name: "Capabilities",
        headers: ["Product", "Segment", "Capability", "Category", "Funcs", "Process Time (h)", "Wait Time (h)", "Lead Time (h)", "Flow Efficiency"],
        rows: capRows,
        colWidths: [28, 18, 30, 20, 8, 16, 14, 14, 16],
      },
      {
        name: "Functionalities",
        headers: ["Product", "Segment", "Capability", "Category", "Functionality", "Description", "Source Files", "Personas"],
        rows: funcRows,
        colWidths: [24, 16, 26, 18, 30, 40, 12, 30],
      },
    ]);

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Discovery export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
