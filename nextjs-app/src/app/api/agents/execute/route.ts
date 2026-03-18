import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { executeAgent } from "@/lib/agent-client";
import { executeAgentSchema, formatZodError } from "@/lib/validations";
import { requireAuth } from "@/lib/api-auth";
import { generateEmbedding } from "@/lib/embeddings";
import { sanitizeInputData } from "@/lib/api-validation";

/**
 * Multi-query expansion per agent type for hybrid semantic retrieval.
 * Running multiple queries and unioning results dramatically improves recall
 * for uploaded benchmark docs, case studies, and prior agent outputs.
 */
const AGENT_CONTEXT_QUERIES: Record<string, string[]> = {
  discovery: [
    "business functionalities modules services codebase structure capabilities value stream",
    "application architecture microservices domain modules current state",
    "digital product capabilities L1 L2 L3 hierarchy product group",
    "Jira epics capabilities features functionalities product hierarchy L2 L3",
    "Azure DevOps epics features user stories area path product group capabilities",
  ],
  lean_vsm: [
    "process steps workflow value stream lead time process time bottleneck waste automation",
    "VSM benchmarks industry process time wait time flow efficiency standards",
    "lean six sigma process improvement bottleneck elimination throughput",
    "process time wait time lead time flow efficiency automation ROI",
  ],
  risk_compliance: [
    "risk assessment regulatory compliance GDPR data privacy operational risk audit",
    "compliance framework regulatory requirements industry standards",
    "risk register threat assessment mitigation controls",
  ],
  future_state_vision: [
    "future state automation agentification AI transformation digital capabilities roadmap",
    "AI automation ROI case study transformation results banking healthcare retail",
    "RPA artificial intelligence agent-based automation business process improvement metrics",
    "digital transformation case study efficiency gains before after automation",
    "VSM benchmarks industry process improvement automation future state targets",
  ],
  product_transformation: [
    "digital product transformation readiness migration plan current state architecture",
    "transformation plan prerequisites steps timeline dependencies",
    "readiness assessment digital maturity transformation blockers",
    "prior discovery VSM risk assessment agent output analysis",
  ],
  architecture: [
    "system architecture microservices API integration technical debt current state target state",
    "cloud architecture patterns event-driven CQRS domain-driven design",
    "technical stack technology choices integration patterns",
  ],
  market_intelligence: [
    "market trends competitor analysis industry benchmark competitive intelligence",
    "industry report digital transformation trends technology adoption",
    "competitor capabilities market positioning digital strategy",
  ],
  skill_gap: [
    "skills gap team capabilities training needs talent workforce technology skills",
    "AI ML cloud DevOps skills training certification workforce development",
  ],
  backlog_okr: [
    "product backlog OKRs objectives key results sprint features user stories",
    "prior agent analysis future state discovery VSM results",
    "product roadmap priorities transformation initiatives capabilities",
  ],
  change_impact: [
    "change impact organizational change stakeholder communication change management",
    "change readiness adoption resistance stakeholder engagement",
  ],
  cost_estimation: [
    "cost estimation budget resource planning ROI financial investment benefit",
    "transformation cost implementation timeline resource requirements",
    "ROI case study financial benefit automation digital transformation",
  ],
  data_governance: [
    "data governance data quality data lineage master data privacy compliance",
    "data management policies data catalog metadata governance framework",
  ],
  documentation: [
    "technical documentation API specification code documentation process guide",
    "process documentation SOPs workflow guides user manuals",
  ],
  fiduciary: [
    "fiduciary duty investment management financial obligations regulatory compliance",
    "financial services regulatory requirements investment governance",
  ],
  git_integration: [
    "git repository code analysis dependencies technical stack version control",
    "code repository structure modules services technical analysis",
  ],
  monitoring: [
    "KPIs metrics monitoring dashboards performance indicators SLAs observability",
    "performance benchmarks industry KPIs digital transformation metrics",
  ],
  security: [
    "security vulnerabilities threat analysis cybersecurity OWASP penetration testing",
    "security framework controls zero trust data protection",
  ],
  testing_validation: [
    "testing strategy QA validation test cases quality assurance test coverage",
    "test automation quality benchmarks coverage standards",
  ],
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
      // Multi-query semantic retrieval: run all queries for the agent type,
      // union results (deduplicated by content), keep top 25 most-cited chunks.
      const queryList = AGENT_CONTEXT_QUERIES[agentType]
        ?? [agentType.replace(/_/g, " ")];

      interface VectorRow {
        content: string;
        file_name: string;
        category: string;
        sub_category: string | null;
      }

      type DocEntry = { content: string; source: string; category: string; subCategory: string | null; hits: number };
      const docMap = new Map<string, DocEntry>();

      for (const query of queryList) {
        const queryEmbedding = await generateEmbedding(query);
        if (!queryEmbedding) continue;

        const vectorStr = `[${queryEmbedding.join(",")}]`;
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
          LIMIT 50
        `, orgId);

        for (const r of rows) {
          // Deduplicate by content fingerprint (first 120 chars)
          const key = r.content.slice(0, 120);
          const existing = docMap.get(key);
          if (existing) {
            existing.hits += 1;
          } else {
            docMap.set(key, {
              content: r.content,
              source: r.file_name,
              category: r.category,
              subCategory: r.sub_category,
              hits: 1,
            });
          }
        }
      }

      // Sort by hit count (chunks appearing in multiple query results rank higher),
      // then take top 25 for injection.
      let contextDocuments: Array<{ content: string; source: string; category: string; subCategory: string | null }> =
        Array.from(docMap.values())
          .sort((a, b) => b.hits - a.hits)
          .slice(0, 25)
          .map(({ content, source, category, subCategory }) => ({ content, source, category, subCategory }));

      // Fallback: no embeddings available — use 25 most recently indexed chunks.
      if (contextDocuments.length === 0) {
        const recentChunks = await prisma.contextEmbedding.findMany({
          where: { organizationId: orgId },
          take: 25,
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

    // Sanitize all user-supplied string values to prevent prompt injection
    enrichedInput = sanitizeInputData(enrichedInput) as typeof enrichedInput;

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
