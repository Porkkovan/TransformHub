import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const digitalProductId = searchParams.get("digitalProductId");
    const itemType = searchParams.get("itemType");

    const organizationId = searchParams.get("organizationId") || user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "User has no organization assigned" }, { status: 400 });
    }

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const where: Record<string, unknown> = { organizationId };
    if (digitalProductId) where.digitalProductId = digitalProductId;
    if (itemType) where.itemType = itemType;

    const items = await prisma.roadmapItem.findMany({
      where,
      orderBy: { riceScore: "desc" },
      include: {
        digitalProduct: { select: { id: true, name: true } },
        digitalCapability: { select: { id: true, name: true } },
        functionality: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch roadmap items:", error);
    return NextResponse.json({ error: "Failed to fetch roadmap items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { capabilityName, category, description, reach, impact, confidence, effort, quarter, digitalProductId, digitalCapabilityId, functionalityId, itemType, initiative } = body;

    // Organization-level data isolation: prefer body param, fall back to user's org
    const organizationId = body.organizationId || user.organizationId;
    if (!organizationId || !capabilityName || !category || !quarter) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const r = Number(reach) || 0;
    const i = Number(impact) || 0;
    const c = Number(confidence) || 0;
    const e = Math.max(Number(effort) || 1, 1);
    const riceScore = (r * i * c) / e;

    const item = await prisma.roadmapItem.create({
      data: {
        organizationId,
        capabilityName,
        category,
        description: description || null,
        reach: r,
        impact: i,
        confidence: c,
        effort: e,
        riceScore,
        quarter,
        source: "manual",
        status: "planned",
        approvalStatus: "PENDING",
        digitalProductId: digitalProductId || null,
        digitalCapabilityId: digitalCapabilityId || null,
        functionalityId: functionalityId || null,
        itemType: itemType || "capability",
        initiative: initiative || null,
      },
    });

    await auditLog({
      action: "roadmap_item.created",
      entityType: "RoadmapItem",
      entityId: item.id,
      actor: user.id,
      details: { capabilityName, category, quarter, organizationId },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create roadmap item:", error);
    return NextResponse.json({ error: "Failed to create roadmap item" }, { status: 500 });
  }
}
