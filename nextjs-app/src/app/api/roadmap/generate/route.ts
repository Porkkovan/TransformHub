import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json().catch(() => ({}));
    const organizationId = body.organizationId || user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "User has no organization assigned" }, { status: 400 });
    }
    // When called with a product selected, AI caps are tagged to it
    const requestedProductId: string | null = body.digitalProductId || null;

    // Get the latest future_state_vision agent execution for this org
    const execution = await prisma.agentExecution.findFirst({
      where: {
        agentType: "future_state_vision",
        status: "COMPLETED",
        organizationId,
      },
      orderBy: { completedAt: "desc" },
    });

    if (!execution?.output) {
      return NextResponse.json({ error: "No future state data found. Run Future State Vision first." }, { status: 404 });
    }

    const output = execution.output as Record<string, unknown>;
    let capabilities = (output.capabilities || []) as Array<{
      name: string;
      category: string;
      description?: string;
      businessImpact?: string;
      complexity?: string;
      reach?: number;
      impact?: number;
      confidence?: number;
      effort?: number;
      riceScore?: number;
    }>;

    const quarters = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];

    // Load all products with their DB capabilities to build name→productId map
    const products = await prisma.digitalProduct.findMany({
      where: { repository: { organizationId } },
      include: {
        digitalCapabilities: {
          select: { id: true, name: true, category: true, description: true },
        },
      },
    });

    // Build name → productId map for AI capability matching
    const capToProductId: Record<string, string> = {};
    for (const prod of products) {
      for (const cap of prod.digitalCapabilities) {
        capToProductId[cap.name] = prod.id;
      }
    }

    // Fallback: if future state produced no capabilities, use DB capabilities
    if (capabilities.length === 0) {
      const dbCaps = await prisma.digitalCapability.findMany({
        where: { digitalProduct: { repository: { organizationId } } },
        select: { name: true, category: true, description: true },
      });
      capabilities = dbCaps.map((cap) => ({
        name: cap.name,
        category: cap.category || "AI_ML_INTEGRATION",
        description: cap.description || undefined,
        businessImpact: "MEDIUM",
        complexity: "MEDIUM",
      }));
    }

    // Clear existing PENDING agent-generated items for this org before recreating
    // (prevents duplicates on re-generate; approved/rejected items are preserved)
    await prisma.roadmapItem.deleteMany({
      where: {
        organizationId,
        source: "agent",
        approvalStatus: "PENDING",
      },
    });

    // ── 1. AI-generated capability items (from future state execution) ───────────
    // Tagged to requestedProductId if provided, else matched by name to a product.
    const aiCapNames = new Set(capabilities.map((c) => c.name));

    const roadmapItems = capabilities.map((cap, idx) => {
      const reach = cap.reach ?? (cap.businessImpact === "HIGH" ? 8 : cap.businessImpact === "MEDIUM" ? 5 : 3);
      const impact = cap.impact ?? (cap.businessImpact === "HIGH" ? 9 : cap.businessImpact === "MEDIUM" ? 6 : 3);
      const confidence = cap.confidence ?? (cap.complexity === "LOW" ? 0.9 : cap.complexity === "MEDIUM" ? 0.7 : 0.5);
      const effort = cap.effort ?? (cap.complexity === "HIGH" ? 8 : cap.complexity === "MEDIUM" ? 5 : 2);
      const riceScore = (reach * impact * confidence) / effort;

      return {
        organizationId,
        capabilityName: cap.name,
        category: cap.category,
        description: cap.description || null,
        reach,
        impact,
        confidence,
        effort,
        riceScore,
        quarter: quarters[idx % quarters.length],
        status: "planned" as const,
        source: "agent" as const,
        approvalStatus: "PENDING" as const,
        itemType: "capability" as const,
        digitalProductId: requestedProductId || capToProductId[cap.name] || null,
      };
    });

    // ── 2. DB capability items for ALL products ────────────────────────────────
    // Covers products not represented in the AI future state output.
    // Each item uses its own product's ID so it appears correctly per product.
    const dbCapItems = products.flatMap((prod) =>
      prod.digitalCapabilities
        .filter((cap) => !aiCapNames.has(cap.name))
        .map((cap, idx) => ({
          organizationId,
          capabilityName: cap.name,
          category: cap.category || "AI_ML_INTEGRATION",
          description: cap.description || null,
          reach: 5,
          impact: 6,
          confidence: 0.7,
          effort: 5,
          riceScore: (5 * 6 * 0.7) / 5,
          quarter: quarters[(roadmapItems.length + idx) % quarters.length],
          status: "planned" as const,
          source: "agent" as const,
          approvalStatus: "PENDING" as const,
          itemType: "capability" as const,
          digitalProductId: prod.id,
        }))
    );

    // ── 3. Functionality items ────────────────────────────────────────────────
    // Scoped to requestedProductId when set (avoids pulling all org functionalities
    // into one product's roadmap). Each item uses its OWN product ID.
    const dbFunctionalities = await prisma.functionality.findMany({
      where: {
        digitalCapability: {
          digitalProduct: requestedProductId
            ? { id: requestedProductId }
            : { repository: { organizationId } },
        },
      },
      select: {
        name: true,
        description: true,
        digitalCapability: {
          select: { name: true, digitalProduct: { select: { id: true } } },
        },
      },
    });

    const functionalityItems = dbFunctionalities.map((func, idx) => ({
      organizationId,
      capabilityName: func.name,
      category: func.digitalCapability?.name || "GENERAL",
      description: func.description || null,
      reach: 4,
      impact: 5,
      confidence: 0.7,
      effort: 3,
      riceScore: (4 * 5 * 0.7) / 3,
      quarter: quarters[(idx + capabilities.length) % quarters.length],
      status: "planned" as const,
      source: "agent" as const,
      approvalStatus: "PENDING" as const,
      itemType: "functionality" as const,
      // Always use the functionality's own product ID — not requestedProductId
      digitalProductId: func.digitalCapability?.digitalProduct?.id || null,
    }));

    const allItems = [...roadmapItems, ...dbCapItems, ...functionalityItems];

    // Create agent execution record
    const repo = await prisma.repository.findFirst({ where: { organizationId } });
    await prisma.agentExecution.create({
      data: {
        agentType: "product_roadmap",
        status: "COMPLETED",
        repositoryId: repo?.id ?? null,
        organizationId,
        input: {
          organizationId,
          capabilityCount: capabilities.length,
          dbCapCount: dbCapItems.length,
          functionalityCount: dbFunctionalities.length,
        },
        output: { roadmapItems: allItems, generatedCount: allItems.length },
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const created = await prisma.roadmapItem.createMany({ data: allItems });

    return NextResponse.json({ success: true, count: created.count });
  } catch (error) {
    console.error("Failed to generate roadmap:", error);
    return NextResponse.json({ error: "Failed to generate roadmap" }, { status: 500 });
  }
}
