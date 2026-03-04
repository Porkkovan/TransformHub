"use server";

import prisma from "@/lib/prisma";

export async function getArchitectureData(
  repositoryId?: string,
  organizationId?: string
) {
  try {
    const where: Record<string, unknown> = {
      agentType: "architecture",
      status: "COMPLETED",
    };
    if (repositoryId) {
      where.repositoryId = repositoryId;
    }
    if (organizationId) {
      where.repository = { organizationId };
    }

    const execution = await prisma.agentExecution.findFirst({
      where,
      orderBy: { completedAt: "desc" },
    });

    if (!execution || !execution.output) {
      return null;
    }

    // Return plain JSON-serializable data
    return execution.output as Record<string, unknown>;
  } catch (error) {
    console.error("[getArchitectureData] error:", error);
    return null;
  }
}
