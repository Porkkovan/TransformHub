import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const agentType = searchParams.get("agentType");
    const repositoryId = searchParams.get("repositoryId");

    const organizationId = searchParams.get("organizationId");

    const where: Record<string, unknown> = {};
    if (agentType) where.agentType = agentType;
    if (repositoryId) where.repositoryId = repositoryId;
    if (organizationId) where.organizationId = organizationId;

    // Include output when filtering by agentType (needed for results display)
    const includeOutput = !!agentType;

    const executions = await prisma.agentExecution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        agentType: true,
        status: true,
        output: includeOutput,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return NextResponse.json(executions);
  } catch (error) {
    console.error("Failed to fetch execution history:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution history" },
      { status: 500 }
    );
  }
}
