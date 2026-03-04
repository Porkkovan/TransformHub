import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { buildXLSX } from "@/lib/export/xlsx";
import { renderRoadmapPDF } from "@/lib/export/pdf";

const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];

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

    const items = await prisma.roadmapItem.findMany({
      where: {
        organizationId: orgId,
        ...(productId ? { digitalProductId: productId } : {}),
      },
      include: {
        digitalProduct: { select: { name: true, businessSegment: true } },
        digitalCapability: { select: { name: true } },
      },
      orderBy: [{ quarter: "asc" }, { riceScore: "desc" }],
    });

    const ts = new Date().toISOString().slice(0, 10);
    const filename = `transformhub-roadmap-${ts}`;
    const productName = productId
      ? items[0]?.digitalProduct?.name || "product"
      : "All Products";

    if (format === "pdf") {
      const buffer = await renderRoadmapPDF({
        orgName: org.name,
        productName,
        items: items.map((i) => ({
          capabilityName: i.capabilityName,
          category: i.category,
          description: i.description,
          quarter: i.quarter,
          status: i.status,
          approvalStatus: i.approvalStatus,
          riceScore: i.riceScore,
          itemType: i.itemType,
          digitalProduct: i.digitalProduct,
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
    // Sheet 1: Timeline Overview
    const summaryRows = QUARTERS.map((q) => {
      const qi = items.filter((i) => i.quarter === q);
      const caps = qi.filter((i) => i.itemType === "capability");
      const funcs = qi.filter((i) => i.itemType === "functionality");
      const approved = qi.filter((i) => i.approvalStatus === "APPROVED").length;
      const avgRice = qi.length > 0 ? qi.reduce((s, i) => s + i.riceScore, 0) / qi.length : null;
      return [
        q,
        qi.length,
        caps.length,
        funcs.length,
        avgRice != null ? avgRice.toFixed(1) : "—",
        qi.length > 0 ? `${((approved / qi.length) * 100).toFixed(0)}%` : "—",
      ];
    });

    // Sheet 2: All Items (capabilities)
    const capItems = items.filter((i) => i.itemType === "capability");
    const capRows = capItems.map((i) => [
      i.quarter,
      i.digitalProduct?.name || "",
      i.digitalProduct?.businessSegment || "",
      i.category.replace(/_/g, " "),
      i.capabilityName,
      i.description || "",
      i.status,
      i.approvalStatus,
      i.riceScore.toFixed(1),
      i.reach,
      i.impact,
      i.confidence,
      i.effort,
      i.initiative || "",
    ]);

    // Sheet 3: Functionality Items
    const funcItems = items.filter((i) => i.itemType === "functionality");
    const funcRows = funcItems.map((i) => [
      i.quarter,
      i.digitalProduct?.name || "",
      i.digitalCapability?.name || "",
      i.category.replace(/_/g, " "),
      i.capabilityName,
      i.description || "",
      i.status,
      i.approvalStatus,
      i.riceScore.toFixed(1),
      i.reach,
      i.impact,
      i.confidence,
      i.effort,
    ]);

    // Sheet 4: By Strategy
    const modernCats = ["RPA_AUTOMATION", "AI_ML_INTEGRATION", "ADVANCED_ANALYTICS"];
    const agentCats = ["AGENT_BASED", "CONVERSATIONAL_AI"];
    const strategyRows = [
      ["Modernization", ...modernCats.map((cat) => {
        const ci = items.filter((i) => i.category === cat);
        return `${cat.replace(/_/g, " ")}: ${ci.length} items`;
      })].flat(),
      ["Agentification", ...agentCats.map((cat) => {
        const ci = items.filter((i) => i.category === cat);
        return `${cat.replace(/_/g, " ")}: ${ci.length} items`;
      })].flat(),
    ];

    // flatten strategy to per-row format
    const allStratRows = items.map((i) => [
      modernCats.includes(i.category) ? "Modernization" : "Agentification",
      i.quarter,
      i.digitalProduct?.name || "",
      i.category.replace(/_/g, " "),
      i.capabilityName,
      i.itemType,
      i.status,
      i.approvalStatus,
      i.riceScore.toFixed(1),
    ]);

    const buffer = buildXLSX([
      {
        name: "Timeline Overview",
        headers: ["Quarter", "Total Items", "Capabilities", "Functionalities", "Avg RICE Score", "% Approved"],
        rows: summaryRows,
        colWidths: [12, 12, 14, 16, 14, 12],
      },
      {
        name: "Capabilities",
        headers: ["Quarter", "Product", "Segment", "Category", "Capability", "Description", "Status", "Approval", "RICE", "Reach", "Impact", "Confidence", "Effort", "Initiative"],
        rows: capRows,
        colWidths: [10, 24, 16, 20, 32, 50, 12, 10, 8, 8, 8, 10, 8, 20],
      },
      {
        name: "Functionalities",
        headers: ["Quarter", "Product", "Parent Capability", "Category", "Functionality", "Description", "Status", "Approval", "RICE", "Reach", "Impact", "Confidence", "Effort"],
        rows: funcRows.length > 0 ? funcRows : [["No functionality items"]],
        colWidths: [10, 24, 26, 20, 30, 50, 12, 10, 8, 8, 8, 10, 8],
      },
      {
        name: "By Strategy",
        headers: ["Strategy", "Quarter", "Product", "Category", "Item", "Type", "Status", "Approval", "RICE"],
        rows: allStratRows,
        colWidths: [16, 10, 24, 20, 32, 14, 12, 10, 8],
      },
    ]);

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Roadmap export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
