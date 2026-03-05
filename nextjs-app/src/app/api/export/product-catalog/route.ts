import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { buildXLSX } from "@/lib/export/xlsx";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const segment = searchParams.get("segment") || undefined;
    const appIdsParam = searchParams.get("appIds") || "";

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    // Build repo filter
    const repoIds = appIdsParam ? appIdsParam.split(",").filter(Boolean) : [];

    const products = await prisma.digitalProduct.findMany({
      where: {
        repository: {
          organizationId: orgId,
          ...(repoIds.length > 0 ? { id: { in: repoIds } } : {}),
        },
        ...(segment ? { businessSegment: segment } : {}),
      },
      include: {
        repository: { select: { id: true, name: true, url: true } },
        digitalCapabilities: {
          include: {
            functionalities: {
              include: { personaMappings: true },
              orderBy: { name: "asc" },
            },
            vsmMetrics: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { name: "asc" },
        },
        productGroups: {
          include: {
            valueStreamSteps: { orderBy: { stepOrder: "asc" } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: [{ businessSegment: "asc" }, { name: "asc" }],
    });

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `transformhub-product-catalog-${ts}`;

    // ── Sheet 1: Product Catalog (flat, one row per functionality) ─────────
    // Columns: Segment | Application | Product (L1) | Capability (L2) | Functionality (L3) | Description | Personas
    const catalogRows: (string | number | null)[][] = [];

    for (const prod of products) {
      const seg = prod.businessSegment || "—";
      const appName = prod.repository?.name || "—";
      const prodName = prod.name;

      if (prod.digitalCapabilities.length === 0) {
        // Product exists but has no capabilities yet — include as a stub row
        catalogRows.push([seg, appName, prodName, "—", "—", prod.description || "", ""]);
        continue;
      }

      for (const cap of prod.digitalCapabilities) {
        const capName = cap.name;

        if (cap.functionalities.length === 0) {
          catalogRows.push([seg, appName, prodName, capName, "—", cap.description || "", ""]);
          continue;
        }

        for (const func of cap.functionalities) {
          const personas = func.personaMappings.map((pm) => pm.personaName).join(", ");
          catalogRows.push([seg, appName, prodName, capName, func.name, func.description || "", personas]);
        }
      }
    }

    // ── Sheet 2: Summary (one row per product with counts) ────────────────
    const summaryRows = products.map((prod) => {
      const totalFuncs = prod.digitalCapabilities.reduce(
        (s, c) => s + c.functionalities.length,
        0
      );
      const allVsm = prod.digitalCapabilities.flatMap((c) => c.vsmMetrics);
      const avgFE =
        allVsm.length > 0
          ? ((allVsm.reduce((s, v) => s + v.flowEfficiency, 0) / allVsm.length) * 100).toFixed(1) + "%"
          : "—";
      return [
        prod.businessSegment || "—",
        prod.repository?.name || "—",
        prod.name,
        prod.description || "",
        prod.digitalCapabilities.length,
        totalFuncs,
        avgFE,
        prod.currentState || "—",
      ];
    });

    // ── Sheet 3: Value Stream Groups (product_groups → value stream steps) ──
    const vsmRows: (string | number | null)[][] = [];
    for (const prod of products) {
      for (const group of prod.productGroups) {
        if (group.valueStreamSteps.length === 0) {
          vsmRows.push([
            prod.businessSegment || "—",
            prod.repository?.name || "—",
            prod.name,
            group.name,
            group.description || "",
            "—",
            "—",
            "—",
          ]);
        }
        for (const step of group.valueStreamSteps) {
          vsmRows.push([
            prod.businessSegment || "—",
            prod.repository?.name || "—",
            prod.name,
            group.name,
            group.description || "",
            step.stepOrder,
            step.name,
            step.stepType,
          ]);
        }
      }
    }

    const sheets = [
      {
        name: "Product Catalog",
        headers: ["Business Segment", "Application", "Product (L1)", "Capability (L2)", "Functionality (L3)", "Description", "Personas"],
        rows: catalogRows,
        colWidths: [22, 28, 30, 32, 36, 50, 30],
      },
      {
        name: "Summary",
        headers: ["Business Segment", "Application", "Product", "Description", "Capabilities", "Functionalities", "Avg Flow Efficiency", "Current State"],
        rows: summaryRows,
        colWidths: [22, 28, 30, 45, 14, 17, 20, 40],
      },
    ];

    if (vsmRows.length > 0) {
      sheets.push({
        name: "Value Stream Groups",
        headers: ["Business Segment", "Application", "Product", "Group (L0)", "Group Description", "Step Order", "Step Name", "Step Type"],
        rows: vsmRows,
        colWidths: [22, 26, 28, 28, 40, 12, 30, 16],
      });
    }

    const buffer = buildXLSX(sheets);

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Product catalog export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
