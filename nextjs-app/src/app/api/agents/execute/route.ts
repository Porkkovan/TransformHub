import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { executeAgent } from "@/lib/agent-client";
import { executeAgentSchema, formatZodError } from "@/lib/validations";
import { requireAuth } from "@/lib/api-auth";
import { generateEmbedding } from "@/lib/embeddings";

/** Representative search query for each agent type — used for semantic context retrieval. */
const AGENT_CONTEXT_QUERIES: Record<string, string> = {
  discovery: "business functionalities modules services codebase structure capabilities value stream",
  lean_vsm: "process steps workflow value stream lead time process time bottleneck waste automation",
  risk_compliance: "risk assessment regulatory compliance GDPR data privacy operational risk audit",
  future_state_vision: "future state automation agentification AI transformation digital capabilities roadmap",
  product_transformation: "digital product transformation readiness migration plan current state architecture",
  architecture: "system architecture microservices API integration technical debt current state target state",
  market_intelligence: "market trends competitor analysis industry benchmark competitive intelligence",
  skill_gap: "skills gap team capabilities training needs talent workforce technology skills",
  backlog_okr: "product backlog OKRs objectives key results sprint features user stories",
  change_impact: "change impact organizational change stakeholder communication change management",
  cost_estimation: "cost estimation budget resource planning ROI financial investment benefit",
  data_governance: "data governance data quality data lineage master data privacy compliance",
  documentation: "technical documentation API specification code documentation process guide",
  fiduciary: "fiduciary duty investment management financial obligations regulatory compliance",
  git_integration: "git repository code analysis dependencies technical stack version control",
  monitoring: "KPIs metrics monitoring dashboards performance indicators SLAs observability",
  security: "security vulnerabilities threat analysis cybersecurity OWASP penetration testing",
  testing_validation: "testing strategy QA validation test cases quality assurance test coverage",
};

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const result = executeAgentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 }
      );
    }

    const { agentType, inputData, repositoryId, organizationId } = result.data;

    // Look up org context for the repository if available
    let enrichedInput = inputData || {};
    if (repositoryId) {
      const repo = await prisma.repository.findUnique({
        where: { id: repositoryId },
        include: { organization: true },
      });
      if (repo?.organization) {
        const org = repo.organization;
        enrichedInput = {
          ...enrichedInput,
          organization: {
            id: org.id,
            name: org.name,
            industry_type: org.industryType,
            competitors: org.competitors,
            business_segments: org.businessSegments,
            regulatory_frameworks: org.regulatoryFrameworks,
            personas: org.personas,
          },
        };
      }
    } else if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (org) {
        enrichedInput = {
          ...enrichedInput,
          organization: {
            id: org.id,
            name: org.name,
            industry_type: org.industryType,
            competitors: org.competitors,
            business_segments: org.businessSegments,
            regulatory_frameworks: org.regulatoryFrameworks,
            personas: org.personas,
          },
        };
      }
    }

    // Inject context documents and application portfolio
    const orgId = (enrichedInput as Record<string, unknown>).organization
      ? ((enrichedInput as Record<string, { id?: string }>).organization?.id)
      : organizationId || null;

    if (orgId) {
      // Build a query string from the agent type for semantic retrieval
      const contextQuery = AGENT_CONTEXT_QUERIES[agentType] ?? agentType.replace(/_/g, " ");
      const queryEmbedding = await generateEmbedding(contextQuery);

      let contextDocuments: Array<{
        content: string;
        source: string;
        category: string;
        subCategory: string | null;
      }> = [];

      if (queryEmbedding) {
        // Semantic search: find the 20 most relevant chunks via pgvector cosine similarity
        const vectorStr = `[${queryEmbedding.join(",")}]`;
        interface VectorRow {
          content: string;
          file_name: string;
          category: string;
          sub_category: string | null;
        }
        const rows = await prisma.$queryRawUnsafe<VectorRow[]>(`
          SELECT
            ce.content,
            cd.file_name,
            cd.category,
            cd.sub_category
          FROM context_embeddings ce
          JOIN context_documents cd ON cd.id = ce.context_document_id
          WHERE ce.organization_id = $1
            AND ce.embedding IS NOT NULL
          ORDER BY ce.embedding <=> '${vectorStr}'::vector
          LIMIT 20
        `, orgId);

        contextDocuments = rows.map((r) => ({
          content: r.content,
          source: r.file_name,
          category: r.category,
          subCategory: r.sub_category,
        }));
      }

      // Fallback: if no embeddings available (OPENAI_API_KEY not set and Azure not configured),
      // use the 20 most recently added chunks so agents still get some context.
      if (contextDocuments.length === 0) {
        const recentChunks = await prisma.contextEmbedding.findMany({
          where: { organizationId: orgId },
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            contextDocument: {
              select: { fileName: true, category: true, subCategory: true },
            },
          },
        });
        contextDocuments = recentChunks.map((chunk) => ({
          content: chunk.content,
          source: chunk.contextDocument.fileName,
          category: chunk.contextDocument.category,
          subCategory: chunk.contextDocument.subCategory,
        }));
      }

      if (contextDocuments.length > 0) {
        (enrichedInput as Record<string, unknown>).contextDocuments = contextDocuments;
      }

      const activeApps = await prisma.contextApplication.findMany({
        where: { organizationId: orgId, status: "active" },
        orderBy: { name: "asc" },
      });

      if (activeApps.length > 0) {
        (enrichedInput as Record<string, unknown>).applicationPortfolio = activeApps.map((app) => ({
          name: app.name,
          vendor: app.vendor,
          status: app.status,
          businessSegment: app.businessSegment,
          technologyStack: app.technologyStack,
          businessCriticality: app.businessCriticality,
          annualCost: app.annualCost,
          userCount: app.userCount,
        }));
      }
    }

    // Create the execution record in the database
    const execution = await prisma.agentExecution.create({
      data: {
        agentType,
        status: "PENDING",
        input: enrichedInput as Prisma.InputJsonValue,
        repositoryId: repositoryId || null,
        organizationId: orgId || null,
        startedAt: new Date(),
      },
    });

    // Fire the request to the Python agent service (non-blocking).
    // Pass execution.id so the Python service reuses the same DB record instead of creating a duplicate.
    executeAgent(agentType, enrichedInput, repositoryId, execution.id).catch(async (error) => {
      console.error(`Agent execution failed for ${execution.id}:`, error);
      await prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
    });

    return NextResponse.json(
      { executionId: execution.id, status: execution.status },
      { status: 202 }
    );
  } catch (error) {
    console.error("Failed to execute agent:", error);
    return NextResponse.json(
      { error: "Failed to execute agent" },
      { status: 500 }
    );
  }
}
