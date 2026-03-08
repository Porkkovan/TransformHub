"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import GlassBadge from "@/components/ui/GlassBadge";
import { useOrganization } from "@/contexts/OrganizationContext";

// ── Types ──────────────────────────────────────────────────────────────────
interface ModuleData {
  label: string;
  description: string;
  score: number;
  runs: number;
  successRate: number;
  avgFeedback: number | null;
  detail: Record<string, unknown>;
}

interface AccuracyData {
  compositeScore: number;
  orgId: string;
  summary: {
    totalProducts: number;
    totalCapabilities: number;
    totalFunctionalities: number;
    totalAgentRuns: number;
    totalContextDocs: number;
    totalRiskAssessments: number;
    totalRoadmapItems: number;
    totalMemories: number;
    feedbackCount: number;
  };
  modules: {
    discovery: ModuleData & { detail: {
      products: { count: number; avgConf: number | null };
      capabilities: { count: number; avgConf: number | null };
      functionalities: { count: number; avgConf: number | null };
      triangulationRate: number; triangulated: number;
      uniqueSources: number; sourceDist: Record<string, number>;
      confHigh: number; confMed: number; confLow: number;
      withConfidencePct: number;
    }};
    leanVsm: ModuleData & { detail: {
      capsWithVsm: number; totalCaps: number; vsmCoverage: number;
      avgFlowEfficiency: number | null; mermaidDiagrams: number; funcsWithTiming: number;
      feDistribution: { high: number; medium: number; low: number };
    }};
    futureState: ModuleData & { detail: {
      productsWithVision: number; totalProducts: number; hasBenchmarkDocs: boolean;
      benchmarkGroundedRuns: number; totalFsRuns: number;
      benchmarkDocs: number; casestudyDocs: number;
    }};
    riskCompliance: ModuleData & { detail: {
      assessments: number; entitiesAssessed: number; riskCoverage: number;
      avgRiskScore: number | null;
      bySeverity: Record<string, number>; byCategory: Record<string, number>;
      complianceMappings: number; compliantPct: number;
    }};
    productTransformation: ModuleData & { detail: {
      roadmapItems: number; approved: number; pending: number; rejected: number;
      approvalRate: number; avgRiceScore: number | null; avgConfidence: number | null;
      byStatus: Record<string, number>;
    }};
    architecture: ModuleData & { detail: { avgComponentsPerRun: number | null; avgPatternsPerRun: number | null }};
    knowledgeBase: ModuleData & { detail: {
      totalDocs: number; indexedDocs: number; failedDocs: number;
      totalChunks: number; embeddingCount: number; embeddingCoverage: number;
      catCoverage: number; coveredCategories: string[]; missingCategories: string[];
      byCategory: { category: string; covered: boolean; docs: number; chunks: number }[];
    }};
    marketIntelligence: ModuleData & { detail: { avgTrendsPerRun: number | null }};
    pipeline: (ModuleData & { detail: Record<string, unknown> })[];
  };
  agentMemory: Record<string, { count: number; avgConf: number; accesses: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  return s >= 70 ? "text-green-400" : s >= 40 ? "text-amber-400" : s > 0 ? "text-red-400" : "text-white/25";
}
function scoreBg(s: number) {
  return s >= 70 ? "border-green-500/30 bg-green-500/5" : s >= 40 ? "border-amber-500/30 bg-amber-500/5" : s > 0 ? "border-red-500/30 bg-red-500/5" : "border-white/10";
}
function scoreBar(s: number) {
  return s >= 70 ? "bg-green-500" : s >= 40 ? "bg-amber-500" : s > 0 ? "bg-red-500" : "bg-white/10";
}
function scoreLabel(s: number) {
  return s >= 80 ? "Excellent" : s >= 65 ? "Good" : s >= 45 ? "Fair" : s > 0 ? "Needs Work" : "No Data";
}

function Bar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreBg(score)} ${scoreColor(score)}`}>
      {score > 0 ? `${score}%` : "—"}
    </span>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  url_analysis: "URL", openapi_spec: "OpenAPI", github_structure: "GitHub",
  github_tests: "Tests", db_schema: "DB", context_document: "Docs",
  integration_data: "Integrations", questionnaire: "Q&A",
};
const SOURCE_COLORS: Record<string, string> = {
  url_analysis: "bg-white/15", openapi_spec: "bg-blue-500/30", github_structure: "bg-slate-500/30",
  github_tests: "bg-green-500/30", db_schema: "bg-orange-500/30", context_document: "bg-purple-500/30",
  integration_data: "bg-cyan-500/30", questionnaire: "bg-amber-500/30",
};
const CAT_COLORS: Record<string, string> = {
  CURRENT_STATE: "text-blue-400", VSM_BENCHMARKS: "text-green-400",
  TRANSFORMATION_CASE_STUDIES: "text-purple-400", ARCHITECTURE_STANDARDS: "text-cyan-400", AGENT_OUTPUT: "text-amber-400",
};

// ── Module card ────────────────────────────────────────────────────────────
function ModuleCard({ mod, children }: { mod: ModuleData; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`glass-panel-sm rounded-2xl border ${scoreBg(mod.score)} overflow-hidden`}>
      <div
        role="button" tabIndex={0}
        onClick={() => setOpen((p) => !p)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((p) => !p); }}
        className="p-4 cursor-pointer hover:bg-white/3 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-white/90">{mod.label}</p>
              <ScorePill score={mod.score} />
              <span className={`text-[10px] ${scoreColor(mod.score)}`}>{scoreLabel(mod.score)}</span>
            </div>
            <p className="text-[11px] text-white/40">{mod.description}</p>
          </div>
          <svg className={`w-4 h-4 text-white/30 shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <Bar value={mod.score} color={scoreBar(mod.score)} />
        <div className="flex items-center gap-4 mt-2 text-[10px] text-white/30">
          <span>{mod.runs} run{mod.runs !== 1 ? "s" : ""}</span>
          {mod.runs > 0 && <span>{mod.successRate}% success</span>}
          {mod.avgFeedback != null && <span>★ {mod.avgFeedback.toFixed(1)}/5 feedback</span>}
        </div>
      </div>
      {open && children && (
        <div className="px-4 pb-4 border-t border-white/8 pt-3 space-y-3 text-xs">{children}</div>
      )}
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-white/40">{label}</span>
      <div className="text-right">
        <span className="text-white/80 font-medium">{value}</span>
        {sub && <span className="text-white/30 text-[10px] ml-1">{sub}</span>}
      </div>
    </div>
  );
}

// ── Action plan (derived from live scores) ─────────────────────────────────
function ActionPlan({ d }: { d: AccuracyData }) {
  const actions: { priority: "high" | "medium"; title: string; detail: string; href: string; label: string }[] = [];
  const kb = d.modules.knowledgeBase.detail;
  const discovery = d.modules.discovery.detail;
  const vsm = d.modules.leanVsm.detail;
  const fs = d.modules.futureState.detail;
  const risk = d.modules.riskCompliance.detail;
  const pt = d.modules.productTransformation.detail;

  // KB missing categories — biggest impact action
  if (kb.missingCategories.length > 0) {
    const cats = kb.missingCategories.map((c) => c.replace(/_/g, " ")).join(", ");
    actions.push({
      priority: "high",
      title: `Upload docs for ${kb.missingCategories.length} missing KB ${kb.missingCategories.length === 1 ? "category" : "categories"}`,
      detail: `Missing: ${cats}. Each covered category adds up to 8 pts to KB score. Target: CURRENT_STATE (process maps, BRDs), VSM_BENCHMARKS (KPI data), TRANSFORMATION_CASE_STUDIES (use Fetch URL), ARCHITECTURE_STANDARDS.`,
      href: "/context-hub",
      label: "Go to Context Hub →",
    });
  }

  // Discovery — low confidence
  if (discovery.uniqueSources < 3) {
    actions.push({
      priority: "high",
      title: "Add enrichment sources to boost discovery confidence",
      detail: `Currently using ${discovery.uniqueSources} evidence source${discovery.uniqueSources === 1 ? "" : "s"}. Add OpenAPI spec URL (per repo), GitHub token, and paste DB schema in Discovery → Enrichment Sources. Each source adds 15–20% confidence per item.`,
      href: "/discovery",
      label: "Go to Discovery →",
    });
  }

  // VSM not run
  if (vsm.capsWithVsm === 0 && vsm.totalCaps > 0) {
    actions.push({
      priority: "high",
      title: "Run Lean VSM agent to map value stream metrics",
      detail: `${vsm.totalCaps} capabilities discovered but none have VSM metrics. Run the Lean VSM agent — it covers all capabilities automatically and boosts discovery confidence by +10% per capability.`,
      href: "/vsm",
      label: "Go to Value Stream →",
    });
  } else if (vsm.vsmCoverage < 60 && vsm.totalCaps > 0) {
    actions.push({
      priority: "medium",
      title: `Improve VSM coverage (${vsm.vsmCoverage}% → 80%+)`,
      detail: `${vsm.totalCaps - vsm.capsWithVsm} capabilities still lack VSM metrics. Re-run Lean VSM to extend coverage.`,
      href: "/vsm",
      label: "Go to Value Stream →",
    });
  }

  // Future state — no benchmark docs
  if (!fs.hasBenchmarkDocs) {
    actions.push({
      priority: "high",
      title: "Upload benchmark docs (+30 pts to Future State score)",
      detail: "Future State auto-loses 30 points without benchmark docs. Upload at least 1 doc to VSM_BENCHMARKS or TRANSFORMATION_CASE_STUDIES. Use 'Fetch URL' in Context Hub to ingest a public industry case study in seconds.",
      href: "/context-hub",
      label: "Upload Benchmarks →",
    });
  }

  // Future state — not run
  if (fs.productsWithVision === 0 && d.summary.totalProducts > 0) {
    actions.push({
      priority: "medium",
      title: "Run Future State Vision agent on all products",
      detail: `${d.summary.totalProducts} products have no future state vision. Run after uploading benchmarks for grounded projected metrics.`,
      href: "/future-state",
      label: "Go to Future State →",
    });
  }

  // Risk coverage low
  if (risk.riskCoverage < 50 && d.summary.totalCapabilities > 0) {
    actions.push({
      priority: "high",
      title: `Risk coverage at ${risk.riskCoverage}% — re-run Risk & Compliance`,
      detail: "Entity ID resolution has been improved (fuzzy matching). Re-running the Risk & Compliance agent will now correctly link assessments to capabilities. Also add regulatory frameworks in Organization Setup.",
      href: "/risk-compliance",
      label: "Go to Risk & Compliance →",
    });
  }

  // Product transformation not run
  if (d.summary.totalRoadmapItems === 0 && d.summary.totalProducts > 0) {
    actions.push({
      priority: "medium",
      title: "Run Product Transformation agent to generate roadmap",
      detail: "No roadmap items exist yet. Run Product Transformation after VSM and Risk to get grounded RICE scores and readiness assessments.",
      href: "/product-workbench",
      label: "Go to Product Workbench →",
    });
  } else if (pt.approvalRate < 30 && pt.roadmapItems > 0) {
    actions.push({
      priority: "medium",
      title: `Approve roadmap items to improve transformation score (${pt.pending} pending)`,
      detail: "Approval rate drives 35% of the Product Transformation score. Review and approve roadmap items in the Product Roadmap page.",
      href: "/product-roadmap",
      label: "Go to Product Roadmap →",
    });
  }

  if (actions.length === 0) return null;

  const high = actions.filter((a) => a.priority === "high");
  const medium = actions.filter((a) => a.priority === "medium");

  return (
    <GlassCard title="Action Plan — Steps to Reach 80%+">
      <div className="space-y-3">
        {[...high, ...medium].map((action, i) => (
          <div key={i} className={`glass-panel-sm rounded-xl p-3 border ${
            action.priority === "high" ? "border-red-500/20 bg-red-500/3" : "border-amber-500/15 bg-amber-500/3"
          }`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                action.priority === "high" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white/80">{action.title}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                    action.priority === "high"
                      ? "text-red-400 bg-red-500/10 border-red-500/20"
                      : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  }`}>
                    {action.priority === "high" ? "High Impact" : "Medium Impact"}
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{action.detail}</p>
                <Link href={action.href}
                  className="inline-block mt-2 text-[11px] text-blue-400 hover:text-blue-300 border border-blue-500/25 hover:border-blue-500/50 rounded-lg px-2.5 py-1 transition-colors">
                  {action.label}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AccuracyPage() {
  const { currentOrg } = useOrganization();
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = async () => {
    if (!currentOrg?.id) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/accuracy/modules?orgId=${currentOrg.id}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
      setRefreshedAt(new Date());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentOrg?.id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-white/40 text-sm animate-pulse">Computing module-wise accuracy…</div>
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );

  const d = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Module-Wise RAG Accuracy</h1>
          <p className="text-white/50 mt-1">
            {currentOrg?.name ?? "—"} · Live accuracy scores per agent module based on knowledge base, RAG contextualization & output quality
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshedAt && <span className="text-xs text-white/30">Updated {refreshedAt.toLocaleTimeString()}</span>}
          <button onClick={load} disabled={loading}
            className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 text-sm border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 transition-colors">
            Refresh
          </button>
        </div>
      </div>

      {!d && !loading && (
        <div className="flex items-center justify-center h-64 text-white/30">
          <p>Select an organisation to view accuracy scores</p>
        </div>
      )}

      {d && (
        <>
          {/* ── Composite banner ────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Big ring */}
              <div className="relative flex items-center justify-center shrink-0" style={{ width: 128, height: 128 }}>
                <svg width={128} height={128} className="-rotate-90">
                  <circle cx={64} cy={64} r={54} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
                  <circle cx={64} cy={64} r={54} fill="none"
                    stroke={d.compositeScore >= 70 ? "#22c55e" : d.compositeScore >= 40 ? "#f59e0b" : "#ef4444"}
                    strokeWidth={10}
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - d.compositeScore / 100)}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${scoreColor(d.compositeScore)}`}>{d.compositeScore}%</span>
                  <span className="text-[10px] text-white/40 mt-0.5">{scoreLabel(d.compositeScore)}</span>
                </div>
              </div>

              {/* Summary stats */}
              <div className="flex-1 grid grid-cols-3 md:grid-cols-5 gap-3 w-full">
                {[
                  { label: "Products", value: d.summary.totalProducts },
                  { label: "Capabilities", value: d.summary.totalCapabilities },
                  { label: "Functionalities", value: d.summary.totalFunctionalities },
                  { label: "Agent Runs", value: d.summary.totalAgentRuns },
                  { label: "Context Docs", value: d.summary.totalContextDocs },
                  { label: "Risk Items", value: d.summary.totalRiskAssessments },
                  { label: "Roadmap Items", value: d.summary.totalRoadmapItems },
                  { label: "Memories", value: d.summary.totalMemories },
                  { label: "Feedback", value: d.summary.feedbackCount },
                ].map(({ label, value }) => (
                  <div key={label} className="glass-panel-sm rounded-xl p-2 text-center">
                    <p className="text-lg font-bold text-white/90">{value}</p>
                    <p className="text-[10px] text-white/30">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Module score strip */}
            <div className="mt-6 pt-4 border-t border-white/8">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-3">Module Scores</p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                  d.modules.discovery, d.modules.leanVsm, d.modules.futureState,
                  d.modules.riskCompliance, d.modules.productTransformation,
                  d.modules.architecture, d.modules.knowledgeBase,
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <p className={`text-xl font-bold ${scoreColor(m.score)}`}>{m.score > 0 ? `${m.score}%` : "—"}</p>
                    <Bar value={m.score} color={scoreBar(m.score)} />
                    <p className="text-[9px] text-white/30 mt-1 leading-tight">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Action Plan ─────────────────────────────────────────────── */}
          <ActionPlan d={d} />

          {/* ── Module cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Discovery */}
            <ModuleCard mod={d.modules.discovery}>
              {(() => {
                const det = d.modules.discovery.detail;
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2 pb-2 border-b border-white/8">
                      {[
                        { label: "Products", count: det.products.count, conf: det.products.avgConf },
                        { label: "Capabilities", count: det.capabilities.count, conf: det.capabilities.avgConf },
                        { label: "Functionalities", count: det.functionalities.count, conf: det.functionalities.avgConf },
                      ].map(({ label, count, conf }) => (
                        <div key={label} className="glass-panel-sm rounded-lg p-2 text-center">
                          <p className="text-sm font-bold text-white/80">{count}</p>
                          <p className="text-[9px] text-white/30">{label}</p>
                          {conf != null && <p className={`text-[10px] font-medium mt-0.5 ${conf >= 0.8 ? "text-green-400" : conf >= 0.6 ? "text-amber-400" : "text-red-400"}`}>{(conf * 100).toFixed(0)}% conf</p>}
                        </div>
                      ))}
                    </div>
                    <StatRow label="Confidence Coverage" value={`${det.withConfidencePct}%`} sub="items with score" />
                    <StatRow label="Triangulated (≥3 sources)" value={`${det.triangulated}`} sub={`${det.triangulationRate}%`} />
                    <StatRow label="Unique Source Types" value={det.uniqueSources} sub="/ 8 max" />
                    <div className="pt-1 border-t border-white/8">
                      <p className="text-[10px] text-white/30 mb-1.5">Confidence Distribution</p>
                      <div className="flex gap-3">
                        <span className="text-green-400/70">▲ {det.confHigh} High ≥80%</span>
                        <span className="text-amber-400/70">◆ {det.confMed} Med 60-80%</span>
                        <span className="text-red-400/70">▼ {det.confLow} Low &lt;60%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 mb-1.5">Evidence Sources</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(det.sourceDist).sort((a, b) => b[1] - a[1]).map(([src, cnt]) => (
                          <span key={src} className={`px-1.5 py-0.5 rounded-full text-[9px] text-white/60 ${SOURCE_COLORS[src] ?? "bg-white/10"}`}>
                            {SOURCE_LABELS[src] ?? src} {cnt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </ModuleCard>

            {/* Lean VSM */}
            <ModuleCard mod={d.modules.leanVsm}>
              {(() => {
                const det = d.modules.leanVsm.detail;
                return (
                  <>
                    <StatRow label="VSM Coverage" value={`${det.vsmCoverage}%`} sub={`${det.capsWithVsm} / ${det.totalCaps} caps`} />
                    <Bar value={det.vsmCoverage} color={scoreBar(det.vsmCoverage)} />
                    {det.avgFlowEfficiency != null && (
                      <StatRow label="Avg Flow Efficiency" value={`${det.avgFlowEfficiency.toFixed(1)}%`}
                        sub={det.avgFlowEfficiency >= 40 ? "Good" : det.avgFlowEfficiency >= 20 ? "Fair" : "Poor"} />
                    )}
                    <StatRow label="Mermaid Diagrams" value={det.mermaidDiagrams} />
                    <StatRow label="Funcs with Timing JSON" value={det.funcsWithTiming} />
                    <div>
                      <p className="text-[10px] text-white/30 mb-1">Flow Efficiency Distribution</p>
                      <div className="flex gap-3">
                        <span className="text-green-400/70">▲ {det.feDistribution.high} ≥40%</span>
                        <span className="text-amber-400/70">◆ {det.feDistribution.medium} 20-40%</span>
                        <span className="text-red-400/70">▼ {det.feDistribution.low} &lt;20%</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </ModuleCard>

            {/* Future State */}
            <ModuleCard mod={d.modules.futureState}>
              {(() => {
                const det = d.modules.futureState.detail;
                return (
                  <>
                    <StatRow label="Products with Vision" value={`${det.productsWithVision} / ${det.totalProducts}`} />
                    <StatRow label="Benchmark Docs Available"
                      value={det.hasBenchmarkDocs ? "Yes" : "No"}
                      sub={`${det.benchmarkDocs} VSM + ${det.casestudyDocs} case studies`} />
                    {det.totalFsRuns > 0 && (
                      <StatRow label="Benchmark-Grounded Runs"
                        value={`${det.benchmarkGroundedRuns} / ${det.totalFsRuns}`} />
                    )}
                    {!det.hasBenchmarkDocs && (
                      <p className="text-amber-400/70 text-[10px] italic">
                        Upload VSM_BENCHMARKS or TRANSFORMATION_CASE_STUDIES to Context Hub to improve grounding
                      </p>
                    )}
                  </>
                );
              })()}
            </ModuleCard>

            {/* Risk & Compliance */}
            <ModuleCard mod={d.modules.riskCompliance}>
              {(() => {
                const det = d.modules.riskCompliance.detail;
                const sevColors: Record<string, string> = { LOW: "text-green-400", MEDIUM: "text-amber-400", HIGH: "text-orange-400", CRITICAL: "text-red-400" };
                return (
                  <>
                    <StatRow label="Entities Assessed" value={`${det.entitiesAssessed} / ${d.summary.totalCapabilities}`} sub={`${det.riskCoverage}% coverage`} />
                    <Bar value={det.riskCoverage} color={scoreBar(det.riskCoverage)} />
                    {det.avgRiskScore != null && <StatRow label="Avg Risk Score" value={`${det.avgRiskScore} / 10`} />}
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {Object.entries(det.bySeverity).map(([sev, cnt]) => (
                        <div key={sev} className="glass-panel-sm rounded-lg p-1.5 text-center">
                          <p className={`text-sm font-bold ${sevColors[sev] ?? "text-white/60"}`}>{cnt as number}</p>
                          <p className="text-[9px] text-white/30">{sev}</p>
                        </div>
                      ))}
                    </div>
                    {det.complianceMappings > 0 && (
                      <StatRow label="Compliance Mappings" value={det.complianceMappings} sub={`${det.compliantPct}% compliant`} />
                    )}
                    {Object.entries(det.byCategory).length > 0 && (
                      <div>
                        <p className="text-[10px] text-white/30 mb-1">By Category</p>
                        {Object.entries(det.byCategory).map(([cat, cnt]) => (
                          <div key={cat} className="flex justify-between text-[10px]">
                            <span className="text-white/50">{cat}</span>
                            <span className="text-white/30">{cnt as number}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </ModuleCard>

            {/* Product Transformation */}
            <ModuleCard mod={d.modules.productTransformation}>
              {(() => {
                const det = d.modules.productTransformation.detail;
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2 pb-2 border-b border-white/8">
                      {[
                        { label: "Approved", value: det.approved, color: "text-green-400" },
                        { label: "Pending", value: det.pending, color: "text-amber-400" },
                        { label: "Rejected", value: det.rejected, color: "text-red-400" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="glass-panel-sm rounded-lg p-2 text-center">
                          <p className={`text-sm font-bold ${color}`}>{value as number}</p>
                          <p className="text-[9px] text-white/30">{label}</p>
                        </div>
                      ))}
                    </div>
                    <StatRow label="Approval Rate" value={`${det.approvalRate}%`} />
                    {det.avgRiceScore != null && <StatRow label="Avg RICE Score" value={det.avgRiceScore} />}
                    {det.avgConfidence != null && <StatRow label="Avg Roadmap Confidence" value={`${((det.avgConfidence as number) * 100).toFixed(0)}%`} />}
                    {Object.entries(det.byStatus).length > 0 && (
                      <div>
                        <p className="text-[10px] text-white/30 mb-1">By Status</p>
                        {Object.entries(det.byStatus).map(([s, cnt]) => (
                          <div key={s} className="flex justify-between text-[10px]">
                            <span className="text-white/50">{s}</span>
                            <span className="text-white/30">{cnt as number}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </ModuleCard>

            {/* Architecture */}
            <ModuleCard mod={d.modules.architecture}>
              {(() => {
                const det = d.modules.architecture.detail;
                return (
                  <>
                    {det.avgComponentsPerRun != null
                      ? <StatRow label="Avg Components / Run" value={det.avgComponentsPerRun as number} />
                      : <p className="text-[10px] text-white/30 italic">No architecture runs yet</p>}
                    {det.avgPatternsPerRun != null && <StatRow label="Avg Patterns / Run" value={det.avgPatternsPerRun as number} />}
                  </>
                );
              })()}
            </ModuleCard>

            {/* Knowledge Base */}
            <ModuleCard mod={d.modules.knowledgeBase}>
              {(() => {
                const det = d.modules.knowledgeBase.detail;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/8">
                      {[
                        { label: "Total Docs", value: det.totalDocs },
                        { label: "Indexed", value: det.indexedDocs, color: "text-green-400" },
                        { label: "Chunks", value: det.totalChunks, color: "text-blue-400" },
                        { label: "Embeddings", value: det.embeddingCount, color: "text-purple-400" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="glass-panel-sm rounded-lg p-2 text-center">
                          <p className={`text-base font-bold ${color ?? "text-white/80"}`}>{value as number}</p>
                          <p className="text-[9px] text-white/30">{label}</p>
                        </div>
                      ))}
                    </div>
                    <StatRow label="Index Coverage" value={`${d.modules.knowledgeBase.successRate}%`} />
                    <Bar value={d.modules.knowledgeBase.successRate} color="bg-green-500/60" />
                    <StatRow label="Embedding Coverage" value={`${det.embeddingCoverage}%`} />
                    <Bar value={det.embeddingCoverage} color="bg-purple-500/60" />
                    <StatRow label="Category Coverage" value={`${det.catCoverage}%`} sub={`${det.coveredCategories.length} / 5 categories`} />
                    <div className="space-y-1">
                      {det.byCategory.map((c) => (
                        <div key={c.category} className="flex items-center gap-2">
                          <span className={`text-[9px] w-2 h-2 rounded-full shrink-0 ${c.covered ? "bg-green-400" : "bg-white/15"}`} />
                          <span className={`text-[10px] flex-1 ${c.covered ? (CAT_COLORS[c.category] ?? "text-white/50") : "text-white/20"}`}>
                            {c.category.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-white/30">{c.covered ? `${c.docs} docs · ${c.chunks} chunks` : "missing"}</span>
                        </div>
                      ))}
                    </div>
                    {det.missingCategories.length > 0 && (
                      <p className="text-amber-400/60 text-[10px] italic">
                        Missing: {det.missingCategories.map((c) => c.replace(/_/g, " ")).join(", ")}
                      </p>
                    )}
                  </>
                );
              })()}
            </ModuleCard>

            {/* Market Intelligence */}
            <ModuleCard mod={d.modules.marketIntelligence}>
              {d.modules.marketIntelligence.detail.avgTrendsPerRun != null
                ? <StatRow label="Avg Trends / Run" value={d.modules.marketIntelligence.detail.avgTrendsPerRun as number} />
                : <p className="text-[10px] text-white/30 italic">No market intelligence runs yet</p>}
            </ModuleCard>
          </div>

          {/* ── Pipeline agents ──────────────────────────────────────────── */}
          {d.modules.pipeline.length > 0 && (
            <GlassCard title="Other Pipeline Agents">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {d.modules.pipeline.map((m) => (
                  <div key={m.label} className={`glass-panel-sm rounded-xl p-3 border ${scoreBg(m.score)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-medium text-white/80 leading-tight">{m.label}</p>
                      <ScorePill score={m.score} />
                    </div>
                    <Bar value={m.score} color={scoreBar(m.score)} />
                    <p className="text-[10px] text-white/30 mt-1">{m.runs} run{m.runs !== 1 ? "s" : ""} · {m.successRate}% success</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* ── Agent memory retention ───────────────────────────────────── */}
          {Object.keys(d.agentMemory).length > 0 && (
            <GlassCard title="Agent Knowledge Retention">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(d.agentMemory).map(([agent, mem]) => (
                  <div key={agent} className="glass-panel-sm rounded-xl p-3">
                    <p className="text-xs font-medium text-white/70 capitalize mb-1">{agent.replace(/_/g, " ")}</p>
                    <p className="text-sm font-bold text-cyan-400">{mem.count} <span className="text-[10px] text-white/30 font-normal">memories</span></p>
                    <Bar value={mem.avgConf * 100} color="bg-cyan-500/50" />
                    <div className="flex justify-between mt-1 text-[10px] text-white/30">
                      <span>{(mem.avgConf * 100).toFixed(0)}% conf</span>
                      <span>{mem.accesses} accesses</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
