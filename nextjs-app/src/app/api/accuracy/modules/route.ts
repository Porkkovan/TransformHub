import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

// ── Module score helpers ───────────────────────────────────────────────────
function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}
function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    // ── Fetch all raw data in parallel ────────────────────────────────────
    const [
      products,
      capabilities,
      functionalities,
      vsmMetrics,
      contextDocs,
      embeddingCount,
      riskAssessments,
      complianceMappings,
      roadmapItems,
      agentExecutions,
      agentMemories,
      agentFeedbacks,
      auditLogs,
    ] = await Promise.all([
      prisma.digitalProduct.findMany({
        where: { repository: { organizationId: orgId } },
        select: { id: true, confidence: true, sources: true, futureState: true, currentState: true, name: true },
      }),
      prisma.digitalCapability.findMany({
        where: { digitalProduct: { repository: { organizationId: orgId } } },
        select: { id: true, confidence: true, sources: true, category: true, name: true },
      }),
      prisma.functionality.findMany({
        where: { digitalCapability: { digitalProduct: { repository: { organizationId: orgId } } } },
        select: { id: true, confidence: true, sources: true, description: true },
      }),
      prisma.vsmMetrics.findMany({
        where: { digitalCapability: { digitalProduct: { repository: { organizationId: orgId } } } },
        select: { processTime: true, waitTime: true, leadTime: true, flowEfficiency: true, mermaidSource: true, digitalCapabilityId: true },
      }),
      prisma.contextDocument.findMany({
        where: { organizationId: orgId },
        select: { id: true, category: true, status: true, chunkCount: true, subCategory: true },
      }),
      prisma.contextEmbedding.count({ where: { organizationId: orgId } }),
      prisma.riskAssessment.findMany({
        where: {
          entityId: {
            in: await prisma.digitalCapability
              .findMany({ where: { digitalProduct: { repository: { organizationId: orgId } } }, select: { id: true } })
              .then((r) => r.map((c) => c.id)),
          },
        },
        select: { riskScore: true, severity: true, riskCategory: true, entityId: true, transitionBlocked: true },
      }),
      prisma.complianceMapping.findMany({
        where: {
          entityId: {
            in: await prisma.digitalProduct
              .findMany({ where: { repository: { organizationId: orgId } }, select: { id: true } })
              .then((r) => r.map((p) => p.id)),
          },
        },
        select: { status: true, framework: true },
      }).catch(() => [] as { status: string; framework: string }[]),
      prisma.roadmapItem.findMany({
        where: { organizationId: orgId },
        select: { confidence: true, riceScore: true, approvalStatus: true, status: true, initiative: true, quarter: true },
      }),
      prisma.agentExecution.findMany({
        where: { organizationId: orgId },
        select: { agentType: true, status: true, output: true, completedAt: true, startedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.agentMemory.findMany({
        where: { organizationId: orgId },
        select: { agentType: true, confidence: true, accessCount: true, memoryType: true },
      }),
      prisma.agentFeedback.findMany({
        where: { execution: { organizationId: orgId } },
        select: { rating: true, corrections: true, execution: { select: { agentType: true } } },
      }),
      prisma.auditLog.findMany({
        where: { entityType: { in: ["product_transformation", "TRANSFORMATION", "READINESS"] } },
        select: { action: true, entityType: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      }).catch(() => [] as { action: string; entityType: string }[]),
    ]);

    // ── Execution map by agent type ───────────────────────────────────────
    type ExecEntry = { total: number; completed: number; failed: number; outputs: unknown[] };
    const execMap: Record<string, ExecEntry> = {};
    for (const e of agentExecutions) {
      if (!execMap[e.agentType]) execMap[e.agentType] = { total: 0, completed: 0, failed: 0, outputs: [] };
      execMap[e.agentType].total++;
      if (e.status === "COMPLETED") { execMap[e.agentType].completed++; if (e.output) execMap[e.agentType].outputs.push(e.output); }
      if (e.status === "FAILED") execMap[e.agentType].failed++;
    }

    // ── Feedback map by agent type ────────────────────────────────────────
    const feedbackMap: Record<string, number[]> = {};
    for (const f of agentFeedbacks) {
      const at = f.execution.agentType;
      if (!feedbackMap[at]) feedbackMap[at] = [];
      feedbackMap[at].push(f.rating);
    }

    // ── Helper: agent score (success rate + feedback + output richness) ───
    function agentModuleScore(agentType: string, extraScore?: number): { score: number; successRate: number; avgFeedback: number | null; runs: number } {
      const e = execMap[agentType] ?? { total: 0, completed: 0, failed: 0, outputs: [] };
      const successRate = pct(e.completed, e.total);
      const fb = feedbackMap[agentType];
      const avgFeedback = fb?.length ? avg(fb) : null;
      // Convert 1-5 feedback to 0-100
      const fbScore = avgFeedback != null ? ((avgFeedback - 1) / 4) * 100 : null;
      let score = e.total === 0 ? 0 : successRate;
      if (fbScore != null) score = score * 0.6 + fbScore * 0.4;
      if (extraScore != null) score = score * 0.5 + extraScore * 0.5;
      return { score: Math.round(score), successRate, avgFeedback, runs: e.total };
    }

    // ── 1. DISCOVERY MODULE ───────────────────────────────────────────────
    const allDiscovered = [...products, ...capabilities, ...functionalities];
    const withConf = allDiscovered.filter((i) => i.confidence != null);
    const avgConf = avg(withConf.map((i) => i.confidence as number)) ?? 0;
    const triangulated = allDiscovered.filter((i) => i.sources.length >= 3).length;
    const triangulationRate = pct(triangulated, allDiscovered.length);
    const sourceDist: Record<string, number> = {};
    for (const i of allDiscovered) for (const s of i.sources) sourceDist[s] = (sourceDist[s] ?? 0) + 1;
    const uniqueSources = Object.keys(sourceDist).length;

    // Confidence distribution
    const confHigh = withConf.filter((i) => (i.confidence as number) >= 0.8).length;
    const confMed = withConf.filter((i) => (i.confidence as number) >= 0.6 && (i.confidence as number) < 0.8).length;
    const confLow = withConf.filter((i) => (i.confidence as number) < 0.6).length;

    // Discovery score: confidence (60%) + triangulation (25%) + source diversity (15%)
    const discExtraScore = avgConf * 60 + (triangulationRate / 100) * 25 + Math.min(uniqueSources / 8, 1) * 15;
    const discoveryModule = {
      ...agentModuleScore("discovery", allDiscovered.length > 0 ? discExtraScore : undefined),
      score: Math.round(allDiscovered.length === 0 ? 0 : discExtraScore),
      label: "Discovery",
      description: "Confidence of discovered products, capabilities, functionalities",
      detail: {
        products: { count: products.length, avgConf: products.filter(p=>p.confidence!=null).length ? avg(products.map(p=>p.confidence as number).filter(Boolean)) : null },
        capabilities: { count: capabilities.length, avgConf: capabilities.filter(c=>c.confidence!=null).length ? avg(capabilities.map(c=>c.confidence as number).filter(Boolean)) : null },
        functionalities: { count: functionalities.length, avgConf: functionalities.filter(f=>f.confidence!=null).length ? avg(functionalities.map(f=>f.confidence as number).filter(Boolean)) : null },
        triangulationRate,
        triangulated,
        uniqueSources,
        sourceDist,
        confHigh, confMed, confLow,
        withConfidencePct: pct(withConf.length, allDiscovered.length),
      },
    };

    // ── 2. VALUE STREAM MAPPING MODULE ────────────────────────────────────
    const capsWithVsm = new Set(vsmMetrics.map((m) => m.digitalCapabilityId));
    const vsmCoverage = pct(capsWithVsm.size, capabilities.length);
    const feScores = vsmMetrics.map((m) => m.flowEfficiency).filter((fe) => fe > 0);
    const avgFe = avg(feScores);
    const mermaidCount = vsmMetrics.filter((m) => m.mermaidSource).length;
    // Functionalities with timing JSON (PT/WT embedded)
    const funcsWithTiming = functionalities.filter((f) => {
      try { const d = f.description; return d?.startsWith("{") && d.includes("pt") && d.includes("wt"); } catch { return false; }
    }).length;

    const vsmExtraScore =
      vsmCoverage * 0.4 +
      (avgFe != null ? Math.min(avgFe / 40, 1) * 100 * 0.3 : 0) +
      pct(mermaidCount, Math.max(capabilities.length, 1)) * 0.2 +
      pct(funcsWithTiming, Math.max(functionalities.length, 1)) * 0.1;

    const vsmModule = {
      label: "Lean VSM",
      description: "Capability VSM coverage, flow efficiency data quality, Mermaid diagrams",
      ...agentModuleScore("lean_vsm", capabilities.length > 0 ? vsmExtraScore : undefined),
      score: Math.round(capabilities.length === 0 ? 0 : vsmExtraScore),
      detail: {
        capsWithVsm: capsWithVsm.size,
        totalCaps: capabilities.length,
        vsmCoverage,
        avgFlowEfficiency: avgFe != null ? Math.round(avgFe * 10) / 10 : null,
        mermaidDiagrams: mermaidCount,
        funcsWithTiming,
        feDistribution: {
          high: feScores.filter((fe) => fe >= 40).length,
          medium: feScores.filter((fe) => fe >= 20 && fe < 40).length,
          low: feScores.filter((fe) => fe < 20).length,
        },
      },
    };

    // ── 3. FUTURE STATE VISION MODULE ─────────────────────────────────────
    const fsExecs = execMap["future_state_vision"] ?? { total: 0, completed: 0, outputs: [] };
    const hasBenchmarkDocs = contextDocs.some((d) => d.category === "VSM_BENCHMARKS" || d.category === "TRANSFORMATION_CASE_STUDIES");
    const benchmarkGroundedCount = (fsExecs.outputs as Record<string, unknown>[]).filter((o) => {
      try {
        const out = o as Record<string, unknown>;
        const caps = Array.isArray(out.capabilities) ? out.capabilities as Record<string, unknown>[] : [];
        return caps.some((c) => {
          const pm = c.projected_metrics as Record<string, unknown> | undefined;
          return pm?.benchmark_source && String(pm.benchmark_source) !== "industry_estimate";
        });
      } catch { return false; }
    }).length;
    const productsWithFutureState = products.filter((p) => p.futureState && (p.futureState as string).length > 50).length;
    const fsExtraScore =
      pct(productsWithFutureState, Math.max(products.length, 1)) * 0.4 +
      (hasBenchmarkDocs ? 30 : 0) +
      (fsExecs.total > 0 ? pct(benchmarkGroundedCount, fsExecs.total) * 0.3 : 0);

    const futureStateModule = {
      label: "Future State Vision",
      description: "Benchmark grounding, projected metrics quality, vision coverage",
      ...agentModuleScore("future_state_vision", fsExecs.total > 0 ? fsExtraScore : undefined),
      score: Math.round(fsExecs.total === 0 && products.length === 0 ? 0 : fsExtraScore),
      detail: {
        productsWithVision: productsWithFutureState,
        totalProducts: products.length,
        hasBenchmarkDocs,
        benchmarkGroundedRuns: benchmarkGroundedCount,
        totalFsRuns: fsExecs.total,
        benchmarkDocs: contextDocs.filter((d) => d.category === "VSM_BENCHMARKS" || d.category === "TRANSFORMATION_CASE_STUDIES").length,
        casestudyDocs: contextDocs.filter((d) => d.category === "TRANSFORMATION_CASE_STUDIES").length,
      },
    };

    // ── 4. RISK & COMPLIANCE MODULE ───────────────────────────────────────
    const entitiesAssessed = new Set(riskAssessments.map((r) => r.entityId)).size;
    const riskCoverage = pct(entitiesAssessed, capabilities.length);
    const criticalCount = riskAssessments.filter((r) => r.severity === "CRITICAL").length;
    const avgRiskScore = avg(riskAssessments.map((r) => r.riskScore));
    const complianceCount = complianceMappings.length;
    const compliantPct = pct(
      complianceMappings.filter((c) => c.status === "COMPLIANT").length,
      complianceMappings.length,
    );
    const riskExtraScore =
      riskCoverage * 0.5 +
      (complianceCount > 0 ? compliantPct * 0.3 : 0) +
      (avgRiskScore != null ? (1 - Math.min(avgRiskScore / 10, 1)) * 20 : 0); // lower risk = higher score

    const riskModule = {
      label: "Risk & Compliance",
      description: "Entity risk coverage, compliance mapping, severity distribution",
      ...agentModuleScore("risk_compliance", riskAssessments.length > 0 ? riskExtraScore : undefined),
      score: Math.round(riskAssessments.length === 0 ? 0 : riskExtraScore),
      detail: {
        assessments: riskAssessments.length,
        entitiesAssessed,
        riskCoverage,
        avgRiskScore: avgRiskScore != null ? Math.round(avgRiskScore * 10) / 10 : null,
        bySeverity: {
          LOW: riskAssessments.filter((r) => r.severity === "LOW").length,
          MEDIUM: riskAssessments.filter((r) => r.severity === "MEDIUM").length,
          HIGH: riskAssessments.filter((r) => r.severity === "HIGH").length,
          CRITICAL: criticalCount,
        },
        complianceMappings: complianceCount,
        compliantPct,
        byCategory: riskAssessments.reduce<Record<string, number>>((acc, r) => {
          acc[r.riskCategory] = (acc[r.riskCategory] ?? 0) + 1; return acc;
        }, {}),
      },
    };

    // ── 5. PRODUCT TRANSFORMATION MODULE ─────────────────────────────────
    const roadmapWithConf = roadmapItems.filter((r) => r.confidence > 0);
    const roadmapWithRice = roadmapItems.filter((r) => r.riceScore > 0);
    const avgRice = avg(roadmapWithRice.map((r) => r.riceScore));
    const avgRoadmapConf = avg(roadmapWithConf.map((r) => r.confidence));
    const approvalRate = pct(roadmapItems.filter((r) => r.approvalStatus === "APPROVED").length, roadmapItems.length);
    // Audit logs for transformation actions
    const transformAudits = auditLogs.filter((a) => a.action.includes("TRANSFORMATION") || a.action.includes("READINESS") || a.entityType === "product_transformation").length;

    const ptExtraScore =
      (roadmapItems.length > 0 ? approvalRate * 0.35 : 0) +
      (avgRoadmapConf != null ? avgRoadmapConf * 100 * 0.35 : 0) +
      (avgRice != null ? Math.min(avgRice / 100, 1) * 100 * 0.2 : 0) +
      (transformAudits > 0 ? 10 : 0);

    const productTransformModule = {
      label: "Product Transformation",
      description: "Roadmap quality, RICE scores, transformation readiness, approval rate",
      ...agentModuleScore("product_transformation", roadmapItems.length > 0 ? ptExtraScore : undefined),
      score: Math.round(roadmapItems.length === 0 ? 0 : ptExtraScore),
      detail: {
        roadmapItems: roadmapItems.length,
        approved: roadmapItems.filter((r) => r.approvalStatus === "APPROVED").length,
        pending: roadmapItems.filter((r) => r.approvalStatus === "PENDING").length,
        rejected: roadmapItems.filter((r) => r.approvalStatus === "REJECTED").length,
        approvalRate,
        avgRiceScore: avgRice != null ? Math.round(avgRice * 10) / 10 : null,
        avgConfidence: avgRoadmapConf != null ? Math.round(avgRoadmapConf * 100) / 100 : null,
        byStatus: roadmapItems.reduce<Record<string, number>>((acc, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1; return acc;
        }, {}),
      },
    };

    // ── 6. ARCHITECTURE MODULE ────────────────────────────────────────────
    const archOutputs = (execMap["architecture"]?.outputs ?? []) as Record<string, unknown>[];
    const avgComponents = avg(archOutputs.map((o) => Array.isArray(o?.components) ? (o.components as unknown[]).length : 0));
    const avgPatterns = avg(archOutputs.map((o) => Array.isArray(o?.patterns) ? (o.patterns as unknown[]).length : 0));
    const archExtraScore = (avgComponents != null ? Math.min(avgComponents / 5, 1) * 50 : 0) +
                           (avgPatterns != null ? Math.min(avgPatterns / 3, 1) * 50 : 0);

    const architectureModule = {
      label: "Architecture",
      description: "Components discovered, patterns identified, architecture coverage",
      ...agentModuleScore("architecture", archOutputs.length > 0 ? archExtraScore : undefined),
      detail: {
        avgComponentsPerRun: avgComponents != null ? Math.round(avgComponents * 10) / 10 : null,
        avgPatternsPerRun: avgPatterns != null ? Math.round(avgPatterns * 10) / 10 : null,
      },
    };

    // ── 7. KNOWLEDGE BASE / RAG MODULE ───────────────────────────────────
    const indexedDocs = contextDocs.filter((d) => d.status === "INDEXED").length;
    const totalChunks = contextDocs.reduce((s, d) => s + d.chunkCount, 0);
    const RAG_CATS = ["CURRENT_STATE", "VSM_BENCHMARKS", "TRANSFORMATION_CASE_STUDIES", "ARCHITECTURE_STANDARDS", "AGENT_OUTPUT"];
    const coveredCats = new Set(contextDocs.map((d) => d.category));
    const catCoverage = pct([...RAG_CATS].filter((c) => coveredCats.has(c)).length, RAG_CATS.length);
    const embeddingCoverage = totalChunks > 0 ? pct(embeddingCount, totalChunks) : 0;

    const kbScore =
      pct(indexedDocs, contextDocs.length) * 0.3 +
      catCoverage * 0.4 +
      embeddingCoverage * 0.3;

    const knowledgeBaseModule = {
      label: "Knowledge Base / RAG",
      description: "Context doc coverage, embedding quality, category completeness",
      score: Math.round(contextDocs.length === 0 ? 0 : kbScore),
      runs: contextDocs.length,
      successRate: pct(indexedDocs, contextDocs.length),
      avgFeedback: null,
      detail: {
        totalDocs: contextDocs.length,
        indexedDocs,
        failedDocs: contextDocs.filter((d) => d.status === "FAILED").length,
        totalChunks,
        embeddingCount,
        embeddingCoverage,
        catCoverage,
        coveredCategories: [...coveredCats],
        missingCategories: RAG_CATS.filter((c) => !coveredCats.has(c)),
        byCategory: RAG_CATS.map((c) => ({
          category: c,
          covered: coveredCats.has(c),
          docs: contextDocs.filter((d) => d.category === c).length,
          chunks: contextDocs.filter((d) => d.category === c).reduce((s, d) => s + d.chunkCount, 0),
        })),
      },
    };

    // ── 8. MARKET INTELLIGENCE MODULE ────────────────────────────────────
    const miOutputs = (execMap["market_intelligence"]?.outputs ?? []) as Record<string, unknown>[];
    const avgTrends = avg(miOutputs.map((o) => Array.isArray(o?.trends) ? (o.trends as unknown[]).length : 0));
    const miExtra = avgTrends != null ? Math.min(avgTrends / 5, 1) * 100 : undefined;
    const marketModule = {
      label: "Market Intelligence",
      description: "Tech trends discovered, competitor insights, market signals",
      ...agentModuleScore("market_intelligence", miExtra),
      detail: { avgTrendsPerRun: avgTrends != null ? Math.round(avgTrends * 10) / 10 : null },
    };

    // ── 9. Other pipeline agents ──────────────────────────────────────────
    const pipelineAgents = ["backlog_okr", "change_impact", "cost_estimation", "data_governance",
      "documentation", "fiduciary", "git_integration", "monitoring", "security",
      "skill_gap", "testing_validation"];

    const otherModules = pipelineAgents
      .filter((a) => execMap[a]?.total > 0)
      .map((a) => ({
        label: a.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        description: "Agent execution success rate",
        ...agentModuleScore(a),
        detail: execMap[a] ?? {},
      }));

    // ── 10. Agent memory quality ──────────────────────────────────────────
    const memByAgent = agentMemories.reduce<Record<string, { count: number; avgConf: number; accesses: number }>>((acc, m) => {
      if (!acc[m.agentType]) acc[m.agentType] = { count: 0, avgConf: 0, accesses: 0 };
      acc[m.agentType].avgConf = (acc[m.agentType].avgConf * acc[m.agentType].count + m.confidence) / (acc[m.agentType].count + 1);
      acc[m.agentType].count++;
      acc[m.agentType].accesses += m.accessCount;
      return acc;
    }, {});

    // ── Composite score across core modules ───────────────────────────────
    const coreModules = [discoveryModule, vsmModule, futureStateModule, riskModule, productTransformModule, architectureModule, knowledgeBaseModule];
    const compositeScore = Math.round(
      discoveryModule.score * 0.20 +
      vsmModule.score * 0.18 +
      futureStateModule.score * 0.15 +
      riskModule.score * 0.12 +
      productTransformModule.score * 0.12 +
      architectureModule.score * 0.08 +
      knowledgeBaseModule.score * 0.15,
    );

    return NextResponse.json({
      compositeScore,
      orgId,
      summary: {
        totalProducts: products.length,
        totalCapabilities: capabilities.length,
        totalFunctionalities: functionalities.length,
        totalAgentRuns: agentExecutions.length,
        totalContextDocs: contextDocs.length,
        totalRiskAssessments: riskAssessments.length,
        totalRoadmapItems: roadmapItems.length,
        totalMemories: agentMemories.length,
        feedbackCount: agentFeedbacks.length,
      },
      modules: {
        discovery: discoveryModule,
        leanVsm: vsmModule,
        futureState: futureStateModule,
        riskCompliance: riskModule,
        productTransformation: productTransformModule,
        architecture: architectureModule,
        knowledgeBase: knowledgeBaseModule,
        marketIntelligence: marketModule,
        pipeline: otherModules,
      },
      agentMemory: memByAgent,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Module accuracy failed:", error);
    return NextResponse.json({ error: "Failed to compute module accuracy" }, { status: 500 });
  }
}
