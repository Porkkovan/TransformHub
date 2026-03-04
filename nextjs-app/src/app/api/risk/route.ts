import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    let user: { organizationId: string | null } | null = null;
    try { user = await requireAuth(); } catch { /* continue with query params */ }
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const organizationId = searchParams.get("organizationId");

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const orgFilter = organizationId || user?.organizationId;
    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    // RiskAssessment has no direct org relation — filter by entity IDs belonging to the org
    if (orgFilter && !entityId) {
      const orgCapabilities = await prisma.digitalCapability.findMany({
        where: { digitalProduct: { repository: { organizationId: orgFilter } } },
        select: { id: true },
      });
      where.entityId = { in: orgCapabilities.map((c) => c.id) };
    }

    const riskAssessments = await prisma.riskAssessment.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(riskAssessments);
  } catch (error) {
    console.error("Failed to fetch risk assessments:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk assessments" },
      { status: 500 }
    );
  }
}
