import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const digitalCapabilityId = searchParams.get("digitalCapabilityId");
    const organizationId = searchParams.get("organizationId");

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const orgFilter = organizationId || user.organizationId;
    const where: Record<string, unknown> = {};
    if (digitalCapabilityId) where.digitalCapabilityId = digitalCapabilityId;
    if (orgFilter) {
      where.digitalCapability = {
        digitalProduct: { repository: { organizationId: orgFilter } },
      };
    }

    const vsmMetrics = await prisma.vsmMetrics.findMany({
      where,
      include: {
        digitalCapability: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(vsmMetrics);
  } catch (error) {
    console.error("Failed to fetch VSM metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch VSM metrics" },
      { status: 500 }
    );
  }
}
