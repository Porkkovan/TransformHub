"use client";

import { useEffect, useState, useMemo } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import StatusIndicator from "@/components/ui/StatusIndicator";
import EntityListSidebar from "@/components/ui/EntityListSidebar";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import MermaidRenderer from "@/components/vsm/MermaidRenderer";
import LeanVSMBoard, { LeanVSMStep } from "@/components/vsm/LeanVSMBoard";
import InlineEditText from "@/components/ui/InlineEditText";
import ExportDropdown from "@/components/ui/ExportDropdown";
import AutomationBreakdownPanel from "@/components/future-state/AutomationBreakdownPanel";
import ValueStreamComparisonPanel from "@/components/future-state/ValueStreamComparisonPanel";
import ValueStreamImprovementPanel from "@/components/shared/ValueStreamImprovementPanel";
import ValueStreamMetricsPanel from "@/components/shared/ValueStreamMetricsPanel";
import ArchitectureDiagramPanel from "@/components/product-workbench/ArchitectureDiagramPanel";
import { useDigitalProducts, DigitalProduct } from "@/hooks/useDigitalProducts";
import { useFutureStateVision } from "@/hooks/useFutureStateVision";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";
import BusinessSegmentSelector from "@/components/shared/BusinessSegmentSelector";
import AgentOutputReviewPanel from "@/components/shared/AgentOutputReviewPanel";
import {
  parseFunctionalityTiming,
  computeCapabilityRollup,
  generateL2Mermaid,
} from "@/lib/vsm-hierarchy";

// ── Types ──────────────────────────────────────────────────────────────────────
type StrategyKey = "automation" | "agentification";

interface ProjectedBand { conservative?: number; expected?: number; optimistic?: number }
interface AgentProjectedMetrics {
  process_time_hrs?: ProjectedBand;
  wait_time_hrs?: ProjectedBand;
  flow_efficiency_pct?: ProjectedBand;
  benchmark_source?: string;
}

interface AgentCap {
  name: string;
  category?: string;
  description?: string;
  businessImpact?: string;
  complexity?: string;
  riceScore?: number;
  product_name?: string;
  projected_metrics?: AgentProjectedMetrics | null;
}

interface CapMeta {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  pt: number;
  wt: number;
  fe: number;
  hasData: boolean;
  functionalities: Array<{ id: string; name: string; description?: string | null }>;
}

interface Projected {
  pt: number; wt: number; fe: number;
  ptSavePct: number; wtSavePct: number; ltSavePct: number;
  ptSaveHrs: number; wtSaveHrs: number; ltSaveHrs: number;
  feGain: number;
}

// ── 2-tab strategy config ──────────────────────────────────────────────────────
const VISION_TABS: Array<{
  key: StrategyKey;
  label: string;
  primary: string[];
  futureLabel: string;
  description: string;
}> = [
  {
    key: "automation",
    label: "Modernization",
    primary: ["RPA_AUTOMATION", "AI_ML_INTEGRATION", "ADVANCED_ANALYTICS"],
    futureLabel: "Modernized",
    description: "Build modern capabilities with increased automation & AI",
  },
  {
    key: "agentification",
    label: "Agentification",
    primary: ["AGENT_BASED", "CONVERSATIONAL_AI"],
    futureLabel: "Agent",
    description: "Transform each capability into an autonomous AI agent",
  },
];

// ── Projection helpers ─────────────────────────────────────────────────────────

/** PT and WT reduction multipliers by category — used as FALLBACK when agent has no projected_metrics. */
function getCategoryMultipliers(category?: string): [number, number] {
  switch (category) {
    case "RPA_AUTOMATION":      return [0.55, 0.35];
    case "AI_ML_INTEGRATION":   return [0.50, 0.38];
    case "AGENT_BASED":         return [0.35, 0.25];
    case "CONVERSATIONAL_AI":   return [0.40, 0.28];
    case "ADVANCED_ANALYTICS":  return [0.75, 0.52];
    default:                    return [0.60, 0.42];
  }
}

/**
 * Project future metrics for a capability.
 * Prefers agent-provided projected_metrics (grounded in uploaded benchmarks).
 * Falls back to hardcoded category multipliers when agent data is absent.
 */
function projectCapMetrics(
  pt: number,
  wt: number,
  category?: string,
  agentProjected?: {
    process_time_hrs?: { expected?: number };
    wait_time_hrs?: { expected?: number };
    flow_efficiency_pct?: { expected?: number };
    benchmark_source?: string;
  } | null,
): Projected & { benchmarkGrounded?: boolean; benchmarkSource?: string } {
  let futurePt: number;
  let futureWt: number;
  let benchmarkGrounded = false;
  let benchmarkSource: string | undefined;

  if (
    agentProjected?.process_time_hrs?.expected != null &&
    agentProjected?.wait_time_hrs?.expected != null
  ) {
    // Use agent-generated benchmark-grounded projections
    futurePt = agentProjected.process_time_hrs.expected;
    futureWt = agentProjected.wait_time_hrs.expected;
    benchmarkGrounded = true;
    benchmarkSource = agentProjected.benchmark_source;
  } else {
    // Fallback: generic multipliers
    const [ptMult, wtMult] = getCategoryMultipliers(category);
    futurePt = pt * ptMult;
    futureWt = wt * wtMult;
  }

  const currentLt = pt + wt || 1;
  const futureLt = futurePt + futureWt || 1;
  return {
    pt: futurePt, wt: futureWt, fe: (futurePt / futureLt) * 100,
    ptSavePct: ((pt - futurePt) / (pt || 1)) * 100,
    wtSavePct: ((wt - futureWt) / (wt || 1)) * 100,
    ltSavePct: ((currentLt - futureLt) / currentLt) * 100,
    ptSaveHrs: pt - futurePt, wtSaveHrs: wt - futureWt, ltSaveHrs: currentLt - futureLt,
    feGain: (futurePt / futureLt) * 100 - (pt / currentLt) * 100,
    benchmarkGrounded,
    benchmarkSource,
  };
}

/** Transform a functionality name based on the future category. */
function transformFuncName(name: string, category?: string): string {
  const lower = name.toLowerCase();
  switch (category) {
    case "RPA_AUTOMATION":
      if (lower.startsWith("automat")) return name;
      return `Automated ${name}`;
    case "AI_ML_INTEGRATION":
      if (lower.startsWith("ai") || lower.startsWith("ml")) return name;
      return `AI-Powered ${name}`;
    case "AGENT_BASED":
      if (lower.includes("agent")) return name;
      return `${name} (Agent)`;
    case "CONVERSATIONAL_AI":
      return `Conversational ${name}`;
    case "ADVANCED_ANALYTICS":
      return `${name} Intelligence`;
    default:
      return `Enhanced ${name}`;
  }
}

/** Build future functionalities with projected timing JSON in description. */
function buildFutureFunctionalities(
  funcs: CapMeta["functionalities"],
  category?: string
): Array<{ id: string; name: string; description: string | null }> {
  const [ptMult, wtMult] = getCategoryMultipliers(category);
  return funcs.map((f) => {
    const timing = parseFunctionalityTiming(f.description);
    const description = timing
      ? JSON.stringify({ pt: timing.pt * ptMult, wt: timing.wt * wtMult, classification: "value-adding" })
      : null;
    return { id: `fut-${f.id}`, name: transformFuncName(f.name, category), description };
  });
}

/** Build capability data for generateL1Mermaid using projected metrics. */
function buildFutureL1Data(
  pairs: Array<{ current: CapMeta; future?: AgentCap }>,
  fallbackCategory?: string
) {
  return pairs.map(({ current, future }) => {
    const category = future?.category ?? fallbackCategory;
    const proj = current.hasData ? projectCapMetrics(current.pt, current.wt, category) : null;
    return {
      id: current.id,
      name: future?.name ?? current.name,
      vsmMetrics: proj ? [{ processTime: proj.pt, waitTime: proj.wt, flowEfficiency: proj.fe }] : null,
      functionalities: null,
    };
  });
}

/** Build products array for generateProductsMermaid using projected future metrics per tab. */
function buildFutureProductsForL1(
  prods: DigitalProduct[],
  agentCaps: AgentCap[],
  tabKey: StrategyKey
) {
  const tab = VISION_TABS.find((t) => t.key === tabKey)!;
  return prods.map((product) => {
    const dbCaps = product.digitalCapabilities ?? [];
    const productAgentCaps = agentCaps.filter(
      (ac) =>
        (!ac.product_name || ac.product_name === product.name) &&
        tab.primary.includes(ac.category ?? "")
    );
    const digitalCapabilities = dbCaps.map((cap, i) => {
      const agentCap = productAgentCaps[i];
      const capMeta = deriveCap(cap);
      const category = agentCap?.category ?? tab.primary[0];
      const proj = capMeta.hasData ? projectCapMetrics(capMeta.pt, capMeta.wt, category) : null;
      return {
        vsmMetrics: proj
          ? [{ processTime: proj.pt, waitTime: proj.wt, flowEfficiency: proj.fe }]
          : null,
        functionalities: capMeta.functionalities,
      };
    });
    return { name: product.name, digitalCapabilities };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function feColors(fe: number) {
  if (fe >= 40) return { border: "border-l-green-500", text: "text-green-400" };
  if (fe >= 20) return { border: "border-l-amber-500", text: "text-amber-400" };
  return { border: "border-l-red-500", text: "text-red-400" };
}

function parseFuncDesc(desc: string | null | undefined): string {
  if (!desc) return "";
  const t = parseFunctionalityTiming(desc);
  if (t) return `PT ${t.pt.toFixed(1)}h · WT ${t.wt.toFixed(1)}h · ${t.classification}`;
  return desc.length > 80 ? `${desc.substring(0, 80)}...` : desc;
}

function formatCat(cat?: string): string {
  if (!cat) return "";
  return cat.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
}

function deriveCap(cap: {
  id: string; name: string; category?: string | null; description?: string | null;
  vsmMetrics?: Array<{ processTime: number; waitTime: number }> | null;
  functionalities?: Array<{ id: string; name: string; description?: string | null }> | null;
}): CapMeta {
  let pt = 0, wt = 0, hasData = false;
  if (cap.vsmMetrics?.length) {
    pt = cap.vsmMetrics[0].processTime; wt = cap.vsmMetrics[0].waitTime; hasData = true;
  } else {
    const r = computeCapabilityRollup(cap.functionalities ?? []);
    if (r) { pt = r.pt; wt = r.wt; hasData = true; }
  }
  const lt = pt + wt || 1;
  return {
    id: cap.id, name: cap.name, category: cap.category, description: cap.description,
    pt, wt, fe: hasData ? (pt / lt) * 100 : 0, hasData,
    functionalities: cap.functionalities ?? [],
  };
}

const CAT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  RPA_AUTOMATION: { bg: "bg-orange-500/20", text: "text-orange-300", border: "border-orange-500/30" },
  AI_ML_INTEGRATION: { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/30" },
  AGENT_BASED: { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/30" },
  CONVERSATIONAL_AI: { bg: "bg-green-500/20", text: "text-green-300", border: "border-green-500/30" },
  ADVANCED_ANALYTICS: { bg: "bg-cyan-500/20", text: "text-cyan-300", border: "border-cyan-500/30" },
};

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null;
  const s = CAT_STYLES[category] ?? { bg: "bg-white/10", text: "text-slate-300", border: "border-white/10" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
      {formatCat(category)}
    </span>
  );
}

// ── Overall VSM card (current vs future product-level) ────────────────────────
function OverallVSMCard({
  capMetas,
  pairs,
  fallbackCategory,
}: {
  capMetas: CapMeta[];
  pairs: Array<{ current: CapMeta; future?: AgentCap }>;
  fallbackCategory?: string;
}) {
  const currentTotals = useMemo(() => {
    const hasMet = capMetas.filter((c) => c.hasData);
    if (hasMet.length === 0) return null;
    const pt = hasMet.reduce((s, c) => s + c.pt, 0);
    const wt = hasMet.reduce((s, c) => s + c.wt, 0);
    const lt = pt + wt || 1;
    return { pt, wt, lt, fe: (pt / lt) * 100 };
  }, [capMetas]);

  const futureTotals = useMemo(() => {
    let pt = 0, wt = 0, count = 0;
    for (const { current, future } of pairs) {
      if (!current.hasData) continue;
      const proj = projectCapMetrics(current.pt, current.wt, future?.category ?? fallbackCategory);
      pt += proj.pt; wt += proj.wt; count++;
    }
    if (count === 0) return null;
    const lt = pt + wt || 1;
    return { pt, wt, lt, fe: (pt / lt) * 100 };
  }, [pairs, fallbackCategory]);

  if (!currentTotals || !futureTotals) return null;

  const ltSavePct = ((currentTotals.lt - futureTotals.lt) / currentTotals.lt) * 100;
  const feGain = futureTotals.fe - currentTotals.fe;

  return (
    <div className="glass-panel-sm rounded-xl p-5">
      <div className="grid grid-cols-2 gap-6">
        {/* Current */}
        <div className="border-l-4 border-l-amber-500 pl-4">
          <p className="text-xs text-amber-400/70 uppercase tracking-wide mb-3 font-medium">Current State</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Process Time", value: `${currentTotals.pt.toFixed(1)}h` },
              { label: "Wait Time", value: `${currentTotals.wt.toFixed(1)}h` },
              { label: "Lead Time", value: `${currentTotals.lt.toFixed(1)}h` },
              { label: "Flow Efficiency", value: `${currentTotals.fe.toFixed(1)}%`, cls: "text-amber-400" },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className="text-xs text-white/35">{label}</p>
                <p className={`text-base font-bold ${cls ?? "text-white/80"}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Future */}
        <div className="border-l-4 border-l-green-500 pl-4">
          <p className="text-xs text-green-400/70 uppercase tracking-wide mb-3 font-medium">Future State (Projected)</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Process Time", value: `${futureTotals.pt.toFixed(1)}h`, save: `↓${((currentTotals.pt - futureTotals.pt) / currentTotals.pt * 100).toFixed(0)}%` },
              { label: "Wait Time", value: `${futureTotals.wt.toFixed(1)}h`, save: `↓${((currentTotals.wt - futureTotals.wt) / currentTotals.wt * 100).toFixed(0)}%` },
              { label: "Lead Time", value: `${futureTotals.lt.toFixed(1)}h`, save: `↓${ltSavePct.toFixed(0)}%` },
              { label: "Flow Efficiency", value: `${futureTotals.fe.toFixed(1)}%`, save: `↑${feGain.toFixed(1)}pp`, cls: "text-green-400" },
            ].map(({ label, value, save, cls }) => (
              <div key={label}>
                <p className="text-xs text-white/35">{label}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className={`text-base font-bold ${cls ?? "text-white/80"}`}>{value}</p>
                  <span className="text-xs text-green-400/80 font-medium">{save}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Summary bar */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/40">Lead Time Reduction</span>
          <span className="text-sm font-bold text-green-400">{ltSavePct.toFixed(1)}% savings — {(currentTotals.lt - futureTotals.lt).toFixed(1)}h recovered</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(ltSavePct, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Current capability card (clickable → L2 Lean VSM) ─────────────────────────
function CurrentCapCard({ cap }: { cap: CapMeta }) {
  const [open, setOpen] = useState(false);
  const colors = feColors(cap.fe);
  const l2Source = useMemo(
    () => (open && cap.functionalities.length > 0 ? generateL2Mermaid(cap.functionalities) : ""),
    [open, cap.functionalities]
  );
  return (
    <div className={`glass-panel-sm rounded-xl border-l-4 ${colors.border} p-4`}>
      <button className="w-full text-left flex items-center justify-between gap-3" onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90">{cap.name}</p>
          {cap.category && <p className="text-xs text-white/35 mt-0.5">{cap.category}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {cap.hasData ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-white/50">PT <span className="text-white/80 font-medium">{cap.pt.toFixed(1)}h</span></span>
              <span className="text-white/50">WT <span className="text-white/80 font-medium">{cap.wt.toFixed(1)}h</span></span>
              <span className={`font-bold ${colors.text}`}>FE {cap.fe.toFixed(0)}%</span>
            </div>
          ) : (
            <span className="text-xs text-white/30">No VSM data</span>
          )}
          <svg className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
          {cap.description && <p className="text-xs text-white/50">{cap.description}</p>}
          {cap.functionalities.length > 0 && (
            <div className="space-y-1.5">
              {cap.functionalities.map((f) => (
                <div key={f.id} className="glass-panel-sm p-2.5 rounded-lg flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-white/70">{f.name}</p>
                    {f.description && <p className="text-xs text-white/40 mt-0.5">{parseFuncDesc(f.description)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {l2Source && (
            <div>
              <p className="text-xs text-white/30 mb-1">Lean Value Stream</p>
              <MermaidRenderer source={l2Source} id={`l2curr-${cap.id}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Future capability transformation row ──────────────────────────────────────
function FutureCapRow({
  current,
  agentCap,
  futureLabel,
  fallbackCategory,
  onEditFutureCap,
}: {
  current: CapMeta;
  agentCap?: AgentCap;
  futureLabel: string;
  fallbackCategory?: string;
  onEditFutureCap?: (updates: Partial<AgentCap>) => void;
}) {
  const [open, setOpen] = useState(false);
  const colors = feColors(current.fe);
  const effectiveCategory = agentCap?.category ?? fallbackCategory;
  const proj = current.hasData
    ? projectCapMetrics(current.pt, current.wt, effectiveCategory, agentCap?.projected_metrics)
    : null;
  const futureFuncs = useMemo(
    () => buildFutureFunctionalities(current.functionalities, effectiveCategory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current.functionalities, effectiveCategory]
  );
  const futureL2Source = useMemo(
    () => (open && futureFuncs.length > 0 ? generateL2Mermaid(futureFuncs) : ""),
    [open, futureFuncs]
  );

  return (
    <div className="glass-panel-sm rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-[1fr,28px,1fr] gap-4 items-start">
        {/* Current */}
        <div className={`border-l-2 ${colors.border.replace("border-l-4", "border-l-2")} pl-3`}>
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Current</p>
          <p className="text-sm font-semibold text-white/80">{current.name}</p>
          {current.hasData ? (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-white/50">
                PT <span className="text-white/75 font-medium">{current.pt.toFixed(1)}h</span>
                {" · "}WT <span className="text-white/75 font-medium">{current.wt.toFixed(1)}h</span>
              </p>
              <p className={`text-xs font-bold ${colors.text}`}>FE {current.fe.toFixed(0)}%</p>
            </div>
          ) : (
            <p className="text-xs text-white/25 mt-1">No VSM data</p>
          )}
          <p className="text-xs text-white/30 mt-1">{current.functionalities.length} functionalities</p>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center pt-5">
          <svg className="w-5 h-5 text-blue-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>

        {/* Future */}
        <div className="border-l-2 border-l-blue-500 pl-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">{futureLabel}</p>
          {agentCap ? (
            <>
              <InlineEditText
                value={agentCap.name}
                displayClassName="text-sm font-semibold text-white/90"
                onSave={(val) => onEditFutureCap?.({ name: val })}
              />
              {agentCap.category && <div className="mt-1"><CategoryBadge category={agentCap.category} /></div>}
              <div className="mt-1.5">
                <InlineEditText
                  value={agentCap.description ?? ""}
                  placeholder="Add description…"
                  multiline
                  displayClassName="text-xs text-white/55 leading-relaxed"
                  inputClassName="text-xs"
                  onSave={(val) => onEditFutureCap?.({ description: val })}
                />
              </div>
              {/* Projected metrics */}
              {proj && (
                <div className="mt-2 space-y-1.5">
                  {proj.benchmarkGrounded && (
                    <p className="text-[9px] text-cyan-400/70 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      {proj.benchmarkSource && proj.benchmarkSource !== "industry_estimate"
                        ? `Benchmark: ${proj.benchmarkSource}`
                        : "Benchmark-grounded projection"}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="glass-panel-sm rounded-lg p-1.5 text-center">
                      <p className="text-[9px] text-white/30 uppercase">PT</p>
                      <p className="text-xs font-bold text-green-400">{proj.pt.toFixed(1)}h</p>
                      <p className="text-[9px] text-green-400/60">↓{proj.ptSavePct.toFixed(0)}%</p>
                    </div>
                    <div className="glass-panel-sm rounded-lg p-1.5 text-center">
                      <p className="text-[9px] text-white/30 uppercase">WT</p>
                      <p className="text-xs font-bold text-green-400">{proj.wt.toFixed(1)}h</p>
                      <p className="text-[9px] text-green-400/60">↓{proj.wtSavePct.toFixed(0)}%</p>
                    </div>
                    <div className="glass-panel-sm rounded-lg p-1.5 text-center">
                      <p className="text-[9px] text-white/30 uppercase">FE</p>
                      <p className="text-xs font-bold text-green-400">{proj.fe.toFixed(0)}%</p>
                      <p className="text-[9px] text-green-400/60">↑{proj.feGain.toFixed(1)}pp</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-white/25 italic mt-1">
              Run Future State Vision to generate {futureLabel.toLowerCase()} capability
            </p>
          )}
        </div>
      </div>

      {/* Expandable: future functionalities with projected metrics + L2 Lean VSM */}
      {current.functionalities.length > 0 && (
        <div className="border-t border-white/5 pt-2">
          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-white/35 hover:text-white/60 transition-colors flex items-center gap-1.5"
          >
            <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {open ? "Hide" : "Show"} future functionalities ({current.functionalities.length}) &amp; VSM
          </button>

          {open && (
            <div className="mt-3 space-y-3">
              {/* Side-by-side functionality comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-white/30 mb-2 font-medium">Current Functionalities</p>
                  <div className="space-y-1.5">
                    {current.functionalities.map((f) => {
                      const t = parseFunctionalityTiming(f.description);
                      return (
                        <div key={f.id} className="glass-panel-sm p-2 rounded-lg">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                            <p className="text-xs text-white/65">{f.name}</p>
                          </div>
                          {t && (
                            <p className="text-[10px] text-white/35 ml-2.5 mt-0.5">
                              PT {t.pt.toFixed(1)}h · WT {t.wt.toFixed(1)}h
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/30 mb-2 font-medium">Future Functionalities (Projected)</p>
                  <div className="space-y-1.5">
                    {futureFuncs.map((f, i) => {
                      const t = parseFunctionalityTiming(f.description);
                      const currT = parseFunctionalityTiming(current.functionalities[i]?.description);
                      return (
                        <div key={f.id} className="glass-panel-sm p-2 rounded-lg border border-blue-500/10">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                            <p className="text-xs text-white/75">{f.name}</p>
                          </div>
                          {t && currT && (
                            <p className="text-[10px] text-green-400/70 ml-2.5 mt-0.5">
                              PT {t.pt.toFixed(1)}h (↓{((currT.pt - t.pt) / currT.pt * 100).toFixed(0)}%)
                              {" · "}
                              WT {t.wt.toFixed(1)}h (↓{((currT.wt - t.wt) / currT.wt * 100).toFixed(0)}%)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Future L2 Lean VSM Mermaid */}
              {futureL2Source && (
                <div>
                  <p className="text-xs text-white/30 mb-1">Future State — Lean Value Stream</p>
                  <MermaidRenderer source={futureL2Source} id={`l2fut-${current.id}`} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Future State VSM Flow (L1=Product, L2=Capability, L3=Functionality) ────────
function FutureVSMFlow({
  products,
  allAgentCaps,
  tabKey,
}: {
  products: DigitalProduct[];
  allAgentCaps: AgentCap[];
  tabKey: StrategyKey;
}) {
  const tab = VISION_TABS.find((t) => t.key === tabKey)!;
  const [level, setLevel] = useState<"L1" | "L2" | "L3">("L1");
  const [l2ProductId, setL2ProductId] = useState<string | null>(null);
  const [l3CapId, setL3CapId] = useState<string | null>(null);

  // ── L1: One step per product — aggregate projected metrics ──────────────────
  const l1Steps = useMemo((): LeanVSMStep[] => {
    const data = buildFutureProductsForL1(products, allAgentCaps, tabKey);
    return data.map((product) => {
      let pt = 0, wt = 0, hasData = false;
      for (const cap of product.digitalCapabilities) {
        const m = cap.vsmMetrics?.[0];
        if (m) { pt += m.processTime; wt += m.waitTime; hasData = true; }
      }
      const lt = pt + wt || 1;
      const fe = (pt / lt) * 100;
      const cls: LeanVSMStep["classification"] =
        !hasData ? "value-adding" : fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste";
      return { name: product.name, processTime: pt, waitTime: wt, classification: cls };
    });
  }, [products, allAgentCaps, tabKey]);

  // ── L2: One step per capability for the selected product ────────────────────
  const l2Product = products.find((p) => p.id === l2ProductId) ?? products[0];
  const l2CapItems = useMemo(() => {
    if (!l2Product) return [];
    const dbCaps = l2Product.digitalCapabilities ?? [];
    const prodAgentCaps = allAgentCaps.filter(
      (ac) =>
        (!ac.product_name || ac.product_name === l2Product.name) &&
        tab.primary.includes(ac.category ?? "")
    );
    return dbCaps.map((cap, i) => {
      const agentCap = prodAgentCaps[i];
      const capMeta = deriveCap(cap);
      const category = agentCap?.category ?? tab.primary[0];
      const proj = capMeta.hasData ? projectCapMetrics(capMeta.pt, capMeta.wt, category) : null;
      const fe = proj ? proj.fe : 0;
      return {
        id: cap.id,
        name: agentCap?.name ?? cap.name,
        processTime: proj?.pt ?? 0,
        waitTime: proj?.wt ?? 0,
        classification: (
          !proj ? "value-adding" : fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste"
        ) as LeanVSMStep["classification"],
        _originalCap: capMeta,
        _category: category,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l2Product, allAgentCaps, tabKey]);

  // ── L3: One step per future functionality of the selected capability ─────────
  const l3Cap = l2CapItems.find((c) => c.id === l3CapId);
  const l3Steps = useMemo((): LeanVSMStep[] => {
    if (!l3Cap || l3Cap._originalCap.functionalities.length === 0) return [];
    const funcs = buildFutureFunctionalities(l3Cap._originalCap.functionalities, l3Cap._category);
    return funcs.map((f) => {
      const t = parseFunctionalityTiming(f.description);
      if (!t) return { name: f.name, processTime: 0, waitTime: 0, classification: "value-adding" as const };
      const cls: LeanVSMStep["classification"] =
        t.classification === "value-adding" ? "value-adding"
        : t.classification === "bottleneck"  ? "bottleneck"
        : "waste";
      return { id: f.id, name: f.name, processTime: t.pt, waitTime: t.wt, classification: cls };
    });
  }, [l3Cap]);

  // Level label map (matching Product Workbench convention)
  const LEVEL_LABELS = { L1: "Product", L2: "Capability", L3: "Functionality" };

  const levelBtn = (l: "L1" | "L2" | "L3") => (
    <button
      key={l}
      onClick={() => setLevel(l)}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        level === l
          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
          : "text-white/40 hover:text-white/60"
      }`}
    >
      {l} <span className="text-white/30 ml-0.5 font-normal">— {LEVEL_LABELS[l]}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Level switcher */}
      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 w-fit border border-white/8">
        {(["L1", "L2", "L3"] as const).map(levelBtn)}
      </div>

      {/* ── L1: Products in segment ── */}
      {level === "L1" && (
        <div className="space-y-4">
          <p className="text-xs text-white/40">
            L1 — Product view: all products in segment with projected future VSM ({tab.label})
          </p>
          <LeanVSMBoard steps={l1Steps} mode="future" />
          {products.length > 0 && (
            <div>
              <p className="text-xs text-white/30 mb-2">Drill into L2 Capability view →</p>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setL2ProductId(p.id); setL3CapId(null); setLevel("L2"); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/55 border border-white/10 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/20 transition-all"
                  >
                    {p.name} →
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── L2: Capabilities of selected product ── */}
      {level === "L2" && (
        <div className="space-y-4">
          {/* Product switcher */}
          {products.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setL2ProductId(p.id); setL3CapId(null); }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                    p.id === (l2ProductId ?? products[0]?.id)
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      : "bg-white/5 text-white/45 border-white/10 hover:text-white/65"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-white/40">
            L2 — Capability view: {l2Product?.name} capabilities with projected future VSM ({tab.label})
          </p>
          <LeanVSMBoard steps={l2CapItems} mode="future" />
          {/* Drill into L3 */}
          {l2CapItems.some((c) => c._originalCap.functionalities.length > 0) && (
            <div>
              <p className="text-xs text-white/30 mb-2">Drill into L3 Functionality view →</p>
              <div className="flex flex-wrap gap-2">
                {l2CapItems
                  .filter((c) => c._originalCap.functionalities.length > 0)
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setL3CapId(c.id); setLevel("L3"); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/55 border border-white/10 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/20 transition-all"
                    >
                      {c.name} →
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── L3: Future functionalities of selected capability ── */}
      {level === "L3" && (
        <div className="space-y-4">
          {/* Capability switcher */}
          {l2CapItems.filter((c) => c._originalCap.functionalities.length > 0).length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {l2CapItems
                .filter((c) => c._originalCap.functionalities.length > 0)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setL3CapId(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      c.id === l3CapId
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        : "bg-white/5 text-white/45 border-white/10 hover:text-white/65"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          )}
          {l3Cap ? (
            <>
              <p className="text-xs text-white/40">
                L3 — Functionality view: {l3Cap.name} — future functionalities with projected timing
              </p>
              {l3Steps.length > 0 ? (
                <LeanVSMBoard steps={l3Steps} mode="future" />
              ) : (
                <p className="text-xs text-white/25 py-4 text-center">
                  No functionality-level timing data for this capability
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-white/25 py-4 text-center">
              Select a capability above to view its future functionalities
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vision Report with proper markdown ────────────────────────────────────────
function processInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i} className="text-white/80">{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function VisionReportView({ report }: { report: string }) {
  const clean = report.replace(/```mermaid[\s\S]*?```/g, "");
  return (
    <div className="text-sm text-white/70 leading-relaxed space-y-1.5 max-h-[600px] overflow-y-auto pr-2">
      {clean.split("\n").map((line, i) => {
        const t = line.trimStart();
        if (t.startsWith("### ")) return <h4 key={i} className="text-sm font-semibold text-white/85 mt-4 mb-1">{processInline(t.slice(4))}</h4>;
        if (t.startsWith("## ")) return <h3 key={i} className="text-base font-bold text-white/90 mt-5 mb-1">{processInline(t.slice(3))}</h3>;
        if (t.startsWith("# ")) return <h2 key={i} className="text-lg font-bold text-white mt-6 mb-2">{processInline(t.slice(2))}</h2>;
        if (t.startsWith("- ") || t.startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-blue-400/50 shrink-0 mt-0.5">•</span>
              <span>{processInline(t.slice(2))}</span>
            </div>
          );
        }
        if (!t) return <div key={i} className="h-1" />;
        return <p key={i}>{processInline(t)}</p>;
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function FutureStatePage() {
  const { currentOrg } = useOrganization();
  const [selectedSegment, setSelectedSegment] = useState("");
  const { products } = useDigitalProducts(currentOrg?.id, selectedSegment || undefined);
  const [selectedProductId, setSelectedProductId] = useState("");
  const { execution, loading, execute } = useAgentExecution();
  const { data: futureStateData } = useFutureStateVision(currentOrg?.id);
  const [visionOptions, setVisionOptions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<StrategyKey>("automation");
  // Local overrides for agent caps (edits made in-session; persisted to agentExecution on save)
  const [capOverrides, setCapOverrides] = useState<Record<string, Partial<AgentCap>>>({});

  useEffect(() => {
    if (products.length > 0 && !products.find((p) => p.id === selectedProductId))
      setSelectedProductId(products[0].id);
  }, [products, selectedProductId]);

  useEffect(() => {
    if (visionOptions.length > 0) setActiveTab(visionOptions[0] as StrategyKey);
  }, [visionOptions]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const capMetas = useMemo(() => (selectedProduct?.digitalCapabilities ?? []).map(deriveCap), [selectedProduct]);

  const agentOutput = useMemo(
    () => (execution?.status === "COMPLETED" && execution.output ? (execution.output as Record<string, unknown>) : null),
    [execution]
  );

  // All raw agent caps — NOT filtered by product (used for L1 segment-level view).
  // Apply any in-session overrides on top.
  const allRawAgentCaps = useMemo((): AgentCap[] => {
    const base = agentOutput
      ? (Array.isArray(agentOutput.capabilities) ? agentOutput.capabilities as AgentCap[] : [])
      : (futureStateData?.capabilities as AgentCap[] ?? []);
    return base.map((c) => ({ ...c, ...(capOverrides[c.name] ?? {}) }));
  }, [agentOutput, futureStateData, capOverrides]);

  // Agent caps filtered to the selected product (for per-product transformation view).
  // Use lenient matching: if no caps match exactly (AI may vary product names slightly),
  // fall back to showing all caps so the page is never empty.
  const allAgentCaps = useMemo((): AgentCap[] => {
    if (!selectedProduct) return allRawAgentCaps;
    const nameLower = selectedProduct.name.toLowerCase().trim();
    const exact = allRawAgentCaps.filter(
      (c) => !c.product_name || c.product_name.toLowerCase().trim() === nameLower
    );
    if (exact.length > 0) return exact;
    // Partial match fallback: include if name contains or is contained by the product name
    const partial = allRawAgentCaps.filter(
      (c) => !c.product_name ||
        c.product_name.toLowerCase().includes(nameLower) ||
        nameLower.includes(c.product_name.toLowerCase().trim())
    );
    return partial.length > 0 ? partial : allRawAgentCaps;
  }, [allRawAgentCaps, selectedProduct]);

  // Return only agent caps whose category belongs to the given tab (strict filter)
  const getTabCaps = (tabKey: StrategyKey): AgentCap[] => {
    const tab = VISION_TABS.find((t) => t.key === tabKey)!;
    return allAgentCaps.filter((c) => tab.primary.includes(c.category ?? ""));
  };

  const productStreams = useMemo(() => {
    if (agentOutput?.productStreams)
      return agentOutput.productStreams as Record<string, {
        currentSteps: { name: string; type: string; duration: number }[];
        futureSteps: { name: string; type: string; duration: number }[];
      }>;
    return futureStateData?.productStreams;
  }, [agentOutput, futureStateData]);

  const visionReport = agentOutput
    ? (typeof agentOutput.vision_report === "string" ? agentOutput.vision_report : undefined)
    : undefined;

  const productNames = new Set(products.map((p) => p.name));
  const filteredAutomationMix = selectedSegment
    ? (futureStateData?.automationMix ?? []).filter((a) => productNames.has(a.productName))
    : (futureStateData?.automationMix ?? []);

  const showTabSwitcher = visionOptions.length > 1;
  const effectiveTabs = visionOptions.length > 0 ? VISION_TABS.filter((t) => visionOptions.includes(t.key)) : [VISION_TABS[0]];
  const streamProducts = selectedProduct ? [selectedProduct.name] : products.map((p) => p.name);

  const handleRunVision = async () => {
    const inputData: Record<string, unknown> = {};
    if (selectedProductId) inputData.product_id = selectedProductId;
    if (visionOptions.length > 0) inputData.vision_strategies = visionOptions;
    await execute("future_state_vision", inputData, undefined, currentOrg?.id);
  };

  const toggleOption = (option: string) => {
    setVisionOptions((prev) => prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]);
  };

  const renderFutureContent = (tabKey: StrategyKey) => {
    if (!selectedProduct) return null;
    const tabConfig = VISION_TABS.find((t) => t.key === tabKey)!;
    // Strict: only agent caps for this tab's categories
    const tabCaps = getTabCaps(tabKey);

    // Pair each current cap with a tab-specific agent cap by position.
    // If the vision was run but returned fewer caps than current caps (e.g. AI produced 2 for 6),
    // synthesize a projected cap so every current capability shows a future transformation.
    const tabHasBeenRun = tabCaps.length > 0;
    const pairs: Array<{ current: CapMeta; future?: AgentCap }> = capMetas.map((current, i) => {
      const future = (tabCaps[i] as AgentCap | undefined) ??
        (tabHasBeenRun
          ? {
              name: `${tabConfig.futureLabel} ${current.name}`,
              category: tabConfig.primary[0],
              description: `Projected ${tabConfig.label.toLowerCase()} transformation of ${current.name}`,
            }
          : undefined);
      return { current, future };
    });
    const extraFutureCaps = tabCaps.slice(capMetas.length);

    const productStream = productStreams?.[selectedProduct.name];
    const hasStream = productStream && productStream.currentSteps.length > 0;

    return (
      <div className="space-y-6">
        {/* Overall VSM: Current vs Future */}
        <GlassCard title={`Overall VSM Metrics — ${selectedProduct.name}`}>
          <OverallVSMCard capMetas={capMetas} pairs={pairs} fallbackCategory={tabConfig.primary[0]} />
        </GlassCard>

        {/* Capability Transformation */}
        <GlassCard title={`${tabConfig.label} Transformation — ${selectedProduct.name}`}>
          <p className="text-xs text-white/40 mb-4">
            {tabConfig.description}. Each current capability paired with its {tabConfig.futureLabel.toLowerCase()} version.
            {allAgentCaps.length === 0 && " Select a strategy and run Future State Vision to generate transformation plan."}
          </p>
          <div className="space-y-4">
            {pairs.map(({ current, future }) => (
              <FutureCapRow
                key={current.id}
                current={current}
                agentCap={future}
                futureLabel={tabConfig.futureLabel}
                fallbackCategory={tabConfig.primary[0]}
                onEditFutureCap={(updates) =>
                  future && setCapOverrides((prev) => ({
                    ...prev,
                    [future.name]: { ...(prev[future.name] ?? {}), ...updates },
                  }))
                }
              />
            ))}
            {extraFutureCaps.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-white/35 uppercase tracking-wide pt-2 border-t border-white/5">
                  Additional {tabConfig.label} Capabilities
                </p>
                {extraFutureCaps.map((cap, i) => (
                  <div key={`extra-${i}`} className="glass-panel-sm rounded-xl border-l-4 border-l-blue-500 p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-white/90">{cap.name}</p>
                      <CategoryBadge category={cap.category} />
                    </div>
                    {cap.description && <p className="text-xs text-white/55 mt-1">{cap.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Future State VSM Flow — L1 / L2 / L3 drill-down */}
        <GlassCard title={`Future State VSM Flow — ${tabConfig.label}`}>
          <FutureVSMFlow
            products={products}
            allAgentCaps={allRawAgentCaps}
            tabKey={tabKey}
          />
        </GlassCard>

        {/* Value Stream: Current → Future */}
        {hasStream && (
          <GlassCard title={`Value Stream: Current → Future — ${selectedProduct.name}`}>
            <ValueStreamComparisonPanel
              currentSteps={productStream!.currentSteps.map((s) => ({ ...s, type: s.type as "manual" | "automated" | "ai" | "agent" }))}
              futureSteps={productStream!.futureSteps.map((s) => ({ ...s, type: s.type as "manual" | "automated" | "ai" | "agent" }))}
            />
          </GlassCard>
        )}

        {/* Process Improvement */}
        {productStreams && Object.keys(productStreams).length > 0 && (
          <GlassCard title={`Process Improvement — ${selectedProduct.name}`}>
            <ValueStreamImprovementPanel productStreams={productStreams} products={streamProducts} />
          </GlassCard>
        )}

        {/* Future VSM Metrics */}
        {productStreams && Object.keys(productStreams).length > 0 && (
          <GlassCard title={`Future State VSM Metrics — ${selectedProduct.name}`}>
            <ValueStreamMetricsPanel productStreams={productStreams} products={streamProducts} mode="future" />
          </GlassCard>
        )}

        {/* Architecture Views */}
        <GlassCard title="Architecture Views — Future State">
          <ArchitectureDiagramPanel
            repositoryId={selectedProduct.repositoryId}
            organizationId={currentOrg?.id}
            mode="future"
            productName={selectedProduct.name}
            capabilities={selectedProduct.digitalCapabilities ?? []}
          />
        </GlassCard>

        {/* Vision Report */}
        {visionReport && (
          <GlassCard title="Vision Report">
            <VisionReportView report={visionReport} />
          </GlassCard>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Future State Vision</h1>
          <p className="text-white/50 mt-1">Envision modernized and agent-based future capabilities with projected VSM metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <GlassButton onClick={handleRunVision} disabled={loading}>
            {loading ? "Envisioning..." : "Run Future State Vision"}
          </GlassButton>
          {execution?.status === "COMPLETED" && execution?.output && (
            <GlassButton onClick={async () => {
              await execute("backlog_okr", { future_state_results: execution.output }, undefined, currentOrg?.id);
            }}>
              Send to Backlog
            </GlassButton>
          )}
          <ExportDropdown
            endpoint="/api/export/future-state"
            params={{ orgId: currentOrg?.id, productId: selectedProductId || undefined }}
            label="Export"
            disabled={!currentOrg?.id}
          />
        </div>
      </div>

      {/* Vision Strategy — 2 options */}
      <GlassCard title="Vision Strategy">
        <div className="space-y-3">
          {VISION_TABS.map((tab) => (
            <label key={tab.key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={visionOptions.includes(tab.key)}
                onChange={() => toggleOption(tab.key)}
                className="w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/30"
              />
              <div>
                <p className="text-sm font-medium text-white/80 group-hover:text-white/95 transition-colors">{tab.label}</p>
                <p className="text-xs text-white/45">{tab.description}</p>
              </div>
            </label>
          ))}
        </div>
      </GlassCard>

      {/* HITL Review */}
      {execution && (
        <AgentOutputReviewPanel
          execution={execution}
          loading={loading}
          title="Future State Vision Review"
          renderSummary={(output) => {
            const data = output as Record<string, unknown>;
            const caps = Array.isArray(data.capabilities) ? data.capabilities : [];
            const report = typeof data.vision_report === "string" ? data.vision_report : "";
            return (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Future State Vision Results</p>
                <div className="flex gap-6 text-sm">
                  {caps.length > 0 && <div><span className="text-white/40">Capabilities</span><p className="text-white/80 font-medium">{caps.length} identified</p></div>}
                  {report && <div><span className="text-white/40">Report</span><p className="text-white/80 font-medium">Generated</p></div>}
                </div>
              </div>
            );
          }}
          onApprove={() => {}} onReject={() => {}} onStatusChange={() => {}}
        />
      )}

      {/* Main Layout */}
      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Sidebar */}
        <div className="w-1/4 space-y-4">
          <BusinessSegmentSelector
            value={selectedSegment}
            onChange={(seg) => { setSelectedSegment(seg); setSelectedProductId(""); }}
          />
          <EntityListSidebar<DigitalProduct>
            title="Digital Products"
            items={products}
            selectedId={selectedProductId}
            onSelect={setSelectedProductId}
            getId={(p) => p.id}
            renderItem={(product, isSelected) => (
              <div>
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/70"}`}>{product.name}</p>
                  <div className={`w-2 h-2 rounded-full ${product.futureState ? "bg-green-400" : "bg-white/20"}`} />
                </div>
                <p className="text-xs text-white/40 mt-0.5">{product.digitalCapabilities?.length ?? 0} capabilities</p>
              </div>
            )}
          />
          {execution && (
            <div className="glass-panel-sm rounded-xl p-3">
              <div className="flex items-center gap-2">
                <StatusIndicator status={execution.status === "COMPLETED" ? "completed" : execution.status === "FAILED" ? "failed" : "running"} />
                <span className="text-xs text-white/70">{execution.status}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Content */}
        <div className="w-3/4 space-y-6">
          {filteredAutomationMix.length > 0 && (
            <GlassCard title="Automation Breakdown by Product">
              <AutomationBreakdownPanel products={filteredAutomationMix} />
            </GlassCard>
          )}

          {selectedProduct ? (
            <>
              {/* Current State Capabilities */}
              <GlassCard title={`Current State Capabilities — ${selectedProduct.name}`}>
                {capMetas.length > 0 ? (
                  <div className="space-y-3">
                    {capMetas.map((cap) => <CurrentCapCard key={cap.id} cap={cap} />)}
                  </div>
                ) : (
                  <p className="text-sm text-white/40 text-center py-6">
                    No capabilities found. Run the Discovery agent first.
                  </p>
                )}
              </GlassCard>

              {/* Tab switcher (2+ strategies) */}
              {showTabSwitcher && (
                <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit border border-white/10">
                  {effectiveTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab.key
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "text-white/50 hover:text-white/70"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {showTabSwitcher
                ? renderFutureContent(activeTab)
                : renderFutureContent((visionOptions[0] ?? "automation") as StrategyKey)
              }
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-white/30">
              <p>Select a product from the sidebar to view its future state</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
