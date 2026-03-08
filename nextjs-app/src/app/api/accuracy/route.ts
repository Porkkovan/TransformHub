import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    // ── Run all queries in parallel ───────────────────────────────────────────
    const [
      products,
      capabilities,
      functionalities,
      contextDocs,
      embeddingCount,
      agentExecutions,
      riskAssessments,
      roadmapItems,
      agentMemories,
    ] = await Promise.all([
      // Products in org
      prisma.digitalProduct.findMany({
        where: { repository: { organizationId: orgId } },
        select: { id: true, confidence: true, sources: true },
      }),

      // Capabilities in org
      prisma.digitalCapability.findMany({
        where: { digitalProduct: { repository: { organizationId: orgId } } },
        select: { id: true, confidence: true, sources: true },
      }),

      // Functionalities in org
      prisma.functionality.findMany({
        where: { digitalCapability: { digitalProduct: { repository: { organizationId: orgId } } } },
        select: { id: true, confidence: true, sources: true },
      }),

      // Context documents
      prisma.contextDocument.findMany({
        where: { organizationId: orgId },
        select: { id: true, category: true, status: true, chunkCount: true, fileName: true, createdAt: true },
      }),

      // Total embeddings (chunks with actual vectors)
      prisma.contextEmbedding.count({
        where: { organizationId: orgId },
      }),

      // Agent executions — last 90 days
      prisma.agentExecution.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        select: { agentType: true, status: true, completedAt: true, createdAt: true, output: true },
        orderBy: { createdAt: "desc" },
      }),

      // Risk assessments for org entities
      prisma.riskAssessment.findMany({
        where: {
          entityId: {
            in: await prisma.digitalCapability
              .findMany({ where: { digitalProduct: { repository: { organizationId: orgId } } }, select: { id: true } })
              .then((caps) => caps.map((c) => c.id)),
          },
        },
        select: { riskScore: true, severity: true, riskCategory: true },
      }),

      // Roadmap items
      prisma.roadmapItem.findMany({
        where: { organizationId: orgId },
        select: { confidence: true, riceScore: true, approvalStatus: true, status: true },
      }),

      // Agent memories (knowledge retention)
      prisma.agentMemory.findMany({
        where: { organizationId: orgId },
        select: { agentType: true, confidence: true, accessCount: true },
      }),
    ]);

    // ── Discovery confidence ───────────────────────────────────────────────────
    function confBuckets(items: { confidence: number | null }[]) {
      const withConf = items.filter((i) => i.confidence != null);
      if (withConf.length === 0) return { count: items.length, withConfidence: 0, avg: null, high: 0, medium: 0, low: 0 };
      const scores = withConf.map((i) => i.confidence as number);
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      return {
        count: items.length,
        withConfidence: withConf.length,
        avg: Math.round(avg * 1000) / 1000,
        high: scores.filter((s) => s >= 0.8).length,
        medium: scores.filter((s) => s >= 0.6 && s < 0.8).length,
        low: scores.filter((s) => s < 0.6).length,
      };
    }

    // Source distribution across all items
    function sourceDist(items: { sources: string[] }[]) {
      const dist: Record<string, number> = {};
      for (const item of items) {
        for (const src of item.sources) {
          dist[src] = (dist[src] ?? 0) + 1;
        }
      }
      return dist;
    }

    const allDiscoveryItems = [...products, ...capabilities, ...functionalities];
    const discovery = {
      products: confBuckets(products),
      capabilities: confBuckets(capabilities),
      functionalities: confBuckets(functionalities),
      sourceDistribution: sourceDist(allDiscoveryItems),
      triangulatedCount: allDiscoveryItems.filter((i) => i.sources.length >= 3).length,
      totalItems: allDiscoveryItems.length,
    };

    // ── Knowledge base ────────────────────────────────────────────────────────
    const catMap: Record<string, { count: number; indexed: number; chunks: number }> = {};
    for (const doc of contextDocs) {
      if (!catMap[doc.category]) catMap[doc.category] = { count: 0, indexed: 0, chunks: 0 };
      catMap[doc.category].count++;
      catMap[doc.category].chunks += doc.chunkCount;
      if (doc.status === "INDEXED") catMap[doc.category].indexed++;
    }
    const indexedDocs = contextDocs.filter((d) => d.status === "INDEXED").length;
    const totalChunks = contextDocs.reduce((s, d) => s + d.chunkCount, 0);

    const knowledgeBase = {
      totalDocs: contextDocs.length,
      indexedDocs,
      failedDocs: contextDocs.filter((d) => d.status === "FAILED").length,
      totalChunks,
      embeddingCount,
      embeddingCoverage: totalChunks > 0 ? Math.round((embeddingCount / totalChunks) * 100) : 0,
      coverageScore: contextDocs.length > 0 ? Math.round((indexedDocs / contextDocs.length) * 100) : 0,
      byCategory: Object.entries(catMap).map(([category, d]) => ({ category, ...d })).sort((a, b) => b.chunks - a.chunks),
      categories: Object.keys(catMap),
    };

    // ── Agent pipeline ────────────────────────────────────────────────────────
    const agentMap: Record<string, { total: number; completed: number; failed: number; running: number; lastRun: Date | null; avgOutputSize: number }> = {};
    for (const exec of agentExecutions) {
      if (!agentMap[exec.agentType]) agentMap[exec.agentType] = { total: 0, completed: 0, failed: 0, running: 0, lastRun: null, avgOutputSize: 0 };
      const a = agentMap[exec.agentType];
      a.total++;
      if (exec.status === "COMPLETED") a.completed++;
      else if (exec.status === "FAILED") a.failed++;
      else if (exec.status === "RUNNING") a.running++;
      if (!a.lastRun || exec.createdAt > a.lastRun) a.lastRun = exec.createdAt;
      if (exec.output) {
        const size = JSON.stringify(exec.output).length;
        a.avgOutputSize = Math.round((a.avgOutputSize * (a.total - 1) + size) / a.total);
      }
    }
    const totalRuns = agentExecutions.length;
    const completedRuns = agentExecutions.filter((e) => e.status === "COMPLETED").length;

    const agentPipeline = {
      totalRuns,
      completedRuns,
      failedRuns: agentExecutions.filter((e) => e.status === "FAILED").length,
      successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
      uniqueAgentsRun: Object.keys(agentMap).length,
      byAgent: Object.entries(agentMap).map(([agentType, d]) => ({ agentType, ...d })).sort((a, b) => b.total - a.total),
    };

    // ── Risk intelligence ─────────────────────────────────────────────────────
    const sevDist = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const catDist: Record<string, number> = {};
    let riskScoreSum = 0;
    for (const r of riskAssessments) {
      sevDist[r.severity as keyof typeof sevDist] = (sevDist[r.severity as keyof typeof sevDist] ?? 0) + 1;
      catDist[r.riskCategory] = (catDist[r.riskCategory] ?? 0) + 1;
      riskScoreSum += r.riskScore;
    }
    const riskIntelligence = {
      total: riskAssessments.length,
      avgScore: riskAssessments.length > 0 ? Math.round((riskScoreSum / riskAssessments.length) * 10) / 10 : null,
      bySeverity: sevDist,
      byCategory: catDist,
    };

    // ── Roadmap quality ───────────────────────────────────────────────────────
    const riceScores = roadmapItems.map((r) => r.riceScore).filter((s) => s > 0);
    const confScores = roadmapItems.map((r) => r.confidence).filter((s) => s > 0);
    const roadmapQuality = {
      total: roadmapItems.length,
      approved: roadmapItems.filter((r) => r.approvalStatus === "APPROVED").length,
      pending: roadmapItems.filter((r) => r.approvalStatus === "PENDING").length,
      rejected: roadmapItems.filter((r) => r.approvalStatus === "REJECTED").length,
      avgRiceScore: riceScores.length > 0 ? Math.round((riceScores.reduce((s, v) => s + v, 0) / riceScores.length) * 10) / 10 : null,
      avgConfidence: confScores.length > 0 ? Math.round((confScores.reduce((s, v) => s + v, 0) / confScores.length) * 100) / 100 : null,
    };

    // ── Agent memory / knowledge retention ───────────────────────────────────
    const memByAgent: Record<string, { count: number; avgConf: number; totalAccess: number }> = {};
    for (const m of agentMemories) {
      if (!memByAgent[m.agentType]) memByAgent[m.agentType] = { count: 0, avgConf: 0, totalAccess: 0 };
      const a = memByAgent[m.agentType];
      a.avgConf = (a.avgConf * a.count + m.confidence) / (a.count + 1);
      a.count++;
      a.totalAccess += m.accessCount;
    }
    const agentMemoryStats = {
      totalMemories: agentMemories.length,
      byAgent: Object.entries(memByAgent).map(([agentType, d]) => ({
        agentType,
        count: d.count,
        avgConfidence: Math.round(d.avgConf * 100) / 100,
        totalAccess: d.totalAccess,
      })),
    };

    // ── Composite accuracy score (0–100) ──────────────────────────────────────
    // Discovery confidence: avg across all items (30%)
    const discoveryScore = (() => {
      const all = [...products, ...capabilities, ...functionalities].filter((i) => i.confidence != null);
      if (!all.length) return 0;
      const avg = all.reduce((s, i) => s + (i.confidence as number), 0) / all.length;
      return avg * 100;
    })();

    // KB coverage: indexed docs × embedding coverage (25%)
    const kbScore = knowledgeBase.coverageScore * (knowledgeBase.embeddingCoverage / 100);

    // Agent success rate (25%)
    const agentScore = agentPipeline.successRate;

    // RAG contextualization: categories covered (20%)
    const ragCategories = ["CURRENT_STATE", "VSM_BENCHMARKS", "TRANSFORMATION_CASE_STUDIES", "ARCHITECTURE_STANDARDS", "AGENT_OUTPUT"];
    const ragCoveredCategories = ragCategories.filter((c) => knowledgeBase.categories.includes(c)).length;
    const ragScore = (ragCoveredCategories / ragCategories.length) * 100;

    const compositeScore = Math.round(
      discoveryScore * 0.30 +
      kbScore * 0.25 +
      agentScore * 0.25 +
      ragScore * 0.20
    );

    return NextResponse.json({
      compositeScore,
      breakdown: {
        discoveryConfidence: Math.round(discoveryScore),
        kbCoverage: Math.round(kbScore),
        agentSuccessRate: agentScore,
        ragContextualization: Math.round(ragScore),
      },
      ragCategories: ragCategories.map((c) => ({ category: c, covered: knowledgeBase.categories.includes(c) })),
      discovery,
      knowledgeBase,
      agentPipeline,
      riskIntelligence,
      roadmapQuality,
      agentMemoryStats,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Accuracy summary failed:", error);
    return NextResponse.json({ error: "Failed to compute accuracy summary" }, { status: 500 });
  }
}
