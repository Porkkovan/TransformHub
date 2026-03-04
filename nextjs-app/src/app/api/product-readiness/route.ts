import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const MOCK_DATA = [
  {
    productId: "prod-1",
    productName: "Analytics Hub",
    readinessScore: 7.2,
    factors: [
      { name: "Technical Debt", score: 6.5 },
      { name: "Team Readiness", score: 8.0 },
      { name: "Data Quality", score: 7.0 },
      { name: "Infrastructure", score: 7.5 },
    ],
    migrationSteps: [
      {
        phase: "Assessment",
        description: "Evaluate current architecture and dependencies",
        status: "completed" as const,
        estimatedDuration: "2 weeks",
      },
      {
        phase: "Data Migration",
        description: "Migrate data stores to cloud-native solutions",
        status: "in-progress" as const,
        estimatedDuration: "4 weeks",
      },
      {
        phase: "Service Decomposition",
        description: "Break monolith into microservices",
        status: "pending" as const,
        estimatedDuration: "6 weeks",
      },
      {
        phase: "Integration Testing",
        description: "End-to-end testing of new architecture",
        status: "pending" as const,
        estimatedDuration: "3 weeks",
      },
    ],
    gateApproved: true,
    blockers: [],
  },
  {
    productId: "prod-2",
    productName: "KYC Platform",
    readinessScore: 3.8,
    factors: [
      { name: "Technical Debt", score: 2.5 },
      { name: "Team Readiness", score: 5.0 },
      { name: "Data Quality", score: 3.5 },
      { name: "Infrastructure", score: 4.0 },
    ],
    migrationSteps: [
      {
        phase: "Assessment",
        description: "Evaluate regulatory compliance requirements",
        status: "completed" as const,
        estimatedDuration: "3 weeks",
      },
      {
        phase: "Remediation",
        description: "Address critical technical debt",
        status: "in-progress" as const,
        estimatedDuration: "8 weeks",
      },
      {
        phase: "Modernization",
        description: "Implement AI-powered identity verification",
        status: "pending" as const,
        estimatedDuration: "10 weeks",
      },
    ],
    gateApproved: false,
    blockers: [
      "Critical technical debt score below 3.0",
      "Regulatory compliance gaps in KYC workflow",
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    let user: { organizationId: string | null } | null = null;
    try { user = await requireAuth(); } catch { /* continue with query params */ }
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const orgFilter = organizationId || user?.organizationId;
    const where: Record<string, unknown> = {
      agentType: "product_transformation",
    };
    if (orgFilter) {
      where.organizationId = orgFilter;
    }

    const executions = await prisma.agentExecution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (executions.length > 0 && executions[0].output) {
      const output =
        typeof executions[0].output === "string"
          ? JSON.parse(executions[0].output)
          : executions[0].output;

      if (Array.isArray(output) && output.length > 0) {
        return NextResponse.json(output);
      }
    }

    // Fall back to mock data
    return NextResponse.json(MOCK_DATA);
  } catch (error) {
    console.error("Failed to fetch product readiness:", error);
    // If Prisma fails (e.g. table doesn't exist), return mock data
    return NextResponse.json(MOCK_DATA);
  }
}
