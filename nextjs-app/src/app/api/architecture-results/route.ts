import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    let user: { organizationId: string | null } | null = null;
    try {
      user = await requireAuth();
    } catch {
      // Auth optional — fall back to query params
    }
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");
    const organizationId = searchParams.get("organizationId");

    const orgFilter = organizationId || user?.organizationId;

    const where: Record<string, unknown> = {
      agentType: "architecture",
      status: "COMPLETED",
    };
    if (repositoryId) {
      where.repositoryId = repositoryId;
    }
    if (orgFilter) {
      where.organizationId = orgFilter;
    }

    const execution = await prisma.agentExecution.findFirst({
      where,
      orderBy: { completedAt: "desc" },
    });

    if (!execution) {
      return NextResponse.json(null);
    }

    return NextResponse.json(execution.output);
  } catch (error) {
    console.error("[arch-api] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch architecture results" },
      { status: 500 }
    );
  }
}
