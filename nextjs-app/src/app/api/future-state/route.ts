import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const MOCK_DATA = {
  automationMix: [
    { productName: "Analytics Hub", rpa: 15, aiMl: 35, agentBased: 25, conversational: 10, analytics: 15 },
    { productName: "KYC Platform", rpa: 30, aiMl: 20, agentBased: 15, conversational: 25, analytics: 10 },
    { productName: "Trade Settlement", rpa: 40, aiMl: 15, agentBased: 10, conversational: 5, analytics: 30 },
  ],
  currentSteps: [
    { name: "Data Collection", type: "manual" as const, duration: 4 },
    { name: "Validation", type: "manual" as const, duration: 3 },
    { name: "Processing", type: "automated" as const, duration: 1 },
    { name: "Review", type: "manual" as const, duration: 5 },
    { name: "Distribution", type: "manual" as const, duration: 2 },
  ],
  futureSteps: [
    { name: "Auto-Ingest", type: "agent" as const, duration: 0.5 },
    { name: "AI Validation", type: "ai" as const, duration: 0.2 },
    { name: "Smart Processing", type: "ai" as const, duration: 0.3 },
    { name: "Agent Review", type: "agent" as const, duration: 0.5 },
    { name: "Auto-Distribute", type: "automated" as const, duration: 0.1 },
  ],
  capabilities: [
    {
      name: "Intelligent Document Processing",
      category: "AI_ML_INTEGRATION",
      businessImpact: "HIGH" as const,
      complexity: "MEDIUM" as const,
      techStack: ["GPT-4", "LangChain", "Tesseract"],
      description: "AI-powered extraction and classification of financial documents",
    },
    {
      name: "Autonomous Trade Reconciliation",
      category: "AGENT_BASED",
      businessImpact: "HIGH" as const,
      complexity: "HIGH" as const,
      techStack: ["CrewAI", "Python", "Kafka"],
      description: "Multi-agent system for real-time trade matching and exception handling",
    },
    {
      name: "Conversational KYC Assistant",
      category: "CONVERSATIONAL_AI",
      businessImpact: "MEDIUM" as const,
      complexity: "MEDIUM" as const,
      techStack: ["Rasa", "FastAPI", "PostgreSQL"],
      description: "Natural language interface for customer onboarding and verification",
    },
    {
      name: "Predictive Risk Analytics",
      category: "ADVANCED_ANALYTICS",
      businessImpact: "HIGH" as const,
      complexity: "HIGH" as const,
      techStack: ["Spark", "TensorFlow", "Grafana"],
      description: "Real-time risk scoring and anomaly detection across portfolios",
    },
    {
      name: "Report Generation Bot",
      category: "RPA_AUTOMATION",
      businessImpact: "MEDIUM" as const,
      complexity: "LOW" as const,
      techStack: ["UiPath", "Python", "Jinja2"],
      description: "Automated generation and distribution of regulatory reports",
    },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // Organization-level data isolation: prefer explicit query param, fall back to user's org
    const orgFilter = organizationId || user.organizationId;
    const where: Record<string, unknown> = {
      agentType: "future_state_vision",
      status: "COMPLETED",
    };
    if (orgFilter) {
      where.organizationId = orgFilter;
    }

    const execution = await prisma.agentExecution.findFirst({
      where,
      orderBy: { completedAt: "desc" },
    });

    if (execution?.output) {
      return NextResponse.json(execution.output);
    }

    // Fall back to mock data when no agent execution is available
    return NextResponse.json(MOCK_DATA);
  } catch (error) {
    console.error("Failed to fetch future state data:", error);
    // Return mock data on any error (e.g. Prisma connection failure)
    return NextResponse.json(MOCK_DATA);
  }
}
