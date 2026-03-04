import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit-logger";
import { createTechTrendSchema, formatZodError } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get("organizationId") || user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const category = searchParams.get("category");
    const maturityLevel = searchParams.get("maturityLevel");

    const where: Record<string, unknown> = { organizationId };
    if (category) where.category = category;
    if (maturityLevel) where.maturityLevel = maturityLevel;

    const trends = await prisma.techTrend.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(trends);
  } catch (error) {
    console.error("Failed to fetch tech trends:", error);
    return NextResponse.json({ error: "Failed to fetch tech trends" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const organizationId = body.organizationId || user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const result = createTechTrendSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      );
    }

    const data = result.data;

    const trend = await prisma.techTrend.create({
      data: {
        organizationId,
        name: data.name,
        category: data.category,
        maturityLevel: data.maturityLevel,
        description: data.description || null,
        impactScore: data.impactScore ?? 5,
        adoptionTimeline: data.adoptionTimeline || null,
      },
    });

    await auditLog({
      action: "tech_trend.created",
      entityType: "TechTrend",
      entityId: trend.id,
      actor: user.id,
      details: { name: data.name, category: data.category, organizationId },
    });

    return NextResponse.json(trend, { status: 201 });
  } catch (error) {
    console.error("Failed to create tech trend:", error);
    return NextResponse.json({ error: "Failed to create tech trend" }, { status: 500 });
  }
}
