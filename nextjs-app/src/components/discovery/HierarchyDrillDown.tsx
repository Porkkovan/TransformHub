"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import MermaidRenderer from "@/components/vsm/MermaidRenderer";
import {
  generateL1Mermaid,
  generateL2Mermaid,
  parseFunctionalityTiming,
  computeCapabilityRollup,
} from "@/lib/vsm-hierarchy";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValueStreamStep {
  id: string;
  name: string;
  stepOrder: number;
  stepType: string;
}

interface ProductGroup {
  id: string;
  name: string;
  description?: string;
  valueStreamSteps: ValueStreamStep[];
}

interface Functionality {
  id: string;
  name: string;
  description?: string;
  sourceFiles: string[];
}

interface VsmMetric {
  id: string;
  processTime: number;
  leadTime: number;
  waitTime: number;
  flowEfficiency: number;
  mermaidSource?: string;
}

interface DigitalCapability {
  id: string;
  name: string;
  description?: string;
  category?: string;
  functionalities: Functionality[];
  vsmMetrics?: VsmMetric[];
}

interface DigitalProduct {
  id: string;
  name: string;
  description?: string;
  digitalCapabilities: DigitalCapability[];
  productGroups: ProductGroup[];
}

interface Repository {
  id: string;
  name: string;
  language?: string;
  digitalProducts: DigitalProduct[];
}

interface HierarchyDrillDownProps {
  repositories: Repository[];
  /** When set, the drill-down starts pre-navigated to this product's capabilities. */
  initialProductId?: string;
}

// ─── Level metadata ──────────────────────────────────────────────────────────

type LevelKey = "repos" | "products" | "capabilities" | "functionalities";

interface BreadcrumbEntry {
  level: LevelKey;
  id: string;
  label: string;
}

const LEVEL_META: Record<
  LevelKey,
  { title: string; childLabel: string; colorDot: string; colorBorder: string; colorText: string; colorBg: string }
> = {
  repos: {
    title: "Repositories",
    childLabel: "Products",
    colorDot: "bg-blue-400",
    colorBorder: "border-blue-400/30",
    colorText: "text-blue-400",
    colorBg: "bg-blue-400/10",
  },
  products: {
    title: "Digital Products",
    childLabel: "Capabilities",
    colorDot: "bg-green-400",
    colorBorder: "border-green-400/30",
    colorText: "text-green-400",
    colorBg: "bg-green-400/10",
  },
  capabilities: {
    title: "Capabilities",
    childLabel: "Functionalities",
    colorDot: "bg-cyan-400",
    colorBorder: "border-cyan-400/30",
    colorText: "text-cyan-400",
    colorBg: "bg-cyan-400/10",
  },
  functionalities: {
    title: "Functionalities",
    childLabel: "Detail",
    colorDot: "bg-purple-400",
    colorBorder: "border-purple-400/30",
    colorText: "text-purple-400",
    colorBg: "bg-purple-400/10",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function HierarchyDrillDown({ repositories, initialProductId }: HierarchyDrillDownProps) {
  const router = useRouter();
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const [mermaidExpanded, setMermaidExpanded] = useState(true);

  // Track which initialProductId we've already navigated to, so that a
  // repositories refetch (e.g. from a background poll) doesn't reset the
  // breadcrumb back to the capabilities level while the user has already
  // drilled deeper into L3 functionalities.
  const initializedProductIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!initialProductId) return;
    // Only run the initialisation logic when the product being targeted changes,
    // not on every repositories update.
    if (initializedProductIdRef.current === initialProductId) return;
    for (const repo of repositories) {
      const product = repo.digitalProducts.find((p) => p.id === initialProductId);
      if (product) {
        initializedProductIdRef.current = initialProductId;
        setBreadcrumb([
          { level: "repos", id: repo.id, label: repo.name },
          { level: "products", id: product.id, label: product.name },
        ]);
        return;
      }
    }
  }, [initialProductId, repositories]);

  const navigateTo = useCallback((index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index));
  }, []);

  const drillInto = useCallback((level: LevelKey, id: string, label: string) => {
    setBreadcrumb((prev) => [...prev, { level, id, label }]);
  }, []);

  // ── Resolve current context from breadcrumb ─────────────────────────────
  const currentRepo =
    breadcrumb.length >= 1 ? repositories.find((r) => r.id === breadcrumb[0].id) ?? null : null;
  const currentProduct =
    breadcrumb.length >= 2 && currentRepo
      ? currentRepo.digitalProducts.find((p) => p.id === breadcrumb[1].id) ?? null
      : null;
  const currentCapability =
    breadcrumb.length >= 3 && currentProduct
      ? currentProduct.digitalCapabilities.find((c) => c.id === breadcrumb[2].id) ?? null
      : null;
  const currentFunctionality =
    breadcrumb.length >= 4 && currentCapability
      ? currentCapability.functionalities.find((f) => f.id === breadcrumb[3].id) ?? null
      : null;

  // ── Resolve current list ─────────────────────────────────────────────────
  const resolveCurrentView = (): {
    level: LevelKey;
    items: { id: string; name: string; description?: string; childCount: number; extra?: string }[];
  } => {
    if (breadcrumb.length === 0) {
      return {
        level: "repos",
        items: repositories.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.language ? `Language: ${r.language}` : undefined,
          childCount: r.digitalProducts.length,
          extra: r.language,
        })),
      };
    }

    if (!currentRepo) return { level: "repos", items: [] };

    if (breadcrumb.length === 1) {
      return {
        level: "products",
        items: currentRepo.digitalProducts.map((p) => {
          const withVsm = p.digitalCapabilities.filter((c) => (c.vsmMetrics?.length ?? 0) > 0).length;
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            childCount: p.digitalCapabilities.length,
            extra: withVsm > 0 ? `${withVsm} of ${p.digitalCapabilities.length} caps have VSM data` : undefined,
          };
        }),
      };
    }

    if (!currentProduct) return { level: "products", items: [] };

    if (breadcrumb.length === 2) {
      return {
        level: "capabilities",
        items: currentProduct.digitalCapabilities.map((c) => {
          const m = c.vsmMetrics?.[0];
          const t = !m ? computeCapabilityRollup(c.functionalities) : null;
          const fe = m ? m.flowEfficiency : t ? t.fe : null;
          const pt = m ? m.processTime : t ? t.pt : null;
          const wt = m ? m.waitTime : t ? t.wt : null;
          const extra =
            fe !== null
              ? `FE ${fe.toFixed(0)}% · PT ${pt!.toFixed(1)}h · WT ${wt!.toFixed(1)}h`
              : c.category ?? undefined;
          return {
            id: c.id,
            name: c.name,
            description: c.description,
            childCount: c.functionalities.length,
            extra,
          };
        }),
      };
    }

    if (!currentCapability) return { level: "capabilities", items: [] };

    if (breadcrumb.length === 3) {
      return {
        level: "functionalities",
        items: currentCapability.functionalities.map((f) => {
          const t = parseFunctionalityTiming(f.description);
          const extra = t
            ? `PT ${t.pt.toFixed(1)}h · WT ${t.wt.toFixed(1)}h · ${t.classification}`
            : (f.sourceFiles?.length ?? 0) > 0
            ? `${f.sourceFiles.length} source files`
            : undefined;
          return {
            id: f.id,
            name: f.name,
            description: t ? undefined : f.description,
            childCount: f.sourceFiles?.length ?? 0,
            extra,
          };
        }),
      };
    }

    return { level: "functionalities", items: [] };
  };

  const { level, items } = resolveCurrentView();
  const meta = LEVEL_META[level];

  const nextLevelMap: Record<LevelKey, LevelKey | null> = {
    repos: "products",
    products: "capabilities",
    capabilities: "functionalities",
    functionalities: null,
  };
  const nextLevel = nextLevelMap[level];

  // ── Process flow diagram ─────────────────────────────────────────────────
  const activeMermaid =
    level === "capabilities" && currentProduct
      ? generateL1Mermaid(currentProduct.digitalCapabilities)
      : level === "functionalities" && currentCapability
      ? generateL2Mermaid(currentCapability.functionalities)
      : "";

  const mermaidLabel =
    level === "capabilities"
      ? `L1 — ${currentProduct?.name ?? "Product"} Process Flow`
      : level === "functionalities"
      ? `L2 — ${currentCapability?.name ?? "Capability"} Process Flow`
      : "";

  // ── Aggregate metrics ────────────────────────────────────────────────────
  const aggregateMetrics = (() => {
    if (level === "capabilities" && currentProduct) {
      const caps = currentProduct.digitalCapabilities;
      const withVsm = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
      if (withVsm.length > 0) {
        const pt = withVsm.reduce((s, c) => s + c.vsmMetrics![0].processTime, 0);
        const wt = withVsm.reduce((s, c) => s + c.vsmMetrics![0].waitTime, 0);
        const lt = pt + wt || 1;
        return { pt, wt, lt, fe: (pt / lt) * 100 };
      }
      let pt = 0, wt = 0, hasData = false;
      for (const cap of caps) {
        const r = computeCapabilityRollup(cap.functionalities);
        if (r) { pt += r.pt; wt += r.wt; hasData = true; }
      }
      if (hasData) {
        const lt = pt + wt || 1;
        return { pt, wt, lt, fe: (pt / lt) * 100 };
      }
    }
    if (level === "functionalities" && currentCapability) {
      const m = currentCapability.vsmMetrics?.[0];
      if (m) return { pt: m.processTime, wt: m.waitTime, lt: m.leadTime, fe: m.flowEfficiency };
      const r = computeCapabilityRollup(currentCapability.functionalities);
      if (r) return { pt: r.pt, wt: r.wt, lt: r.lt, fe: r.fe };
    }
    return null;
  })();

  // ── VSM navigation URL ───────────────────────────────────────────────────
  const vsmUrl = currentProduct
    ? `/vsm?productId=${currentProduct.id}${currentCapability ? `&capabilityId=${currentCapability.id}` : ""}`
    : null;

  // ── Functionality leaf detail ────────────────────────────────────────────
  const renderFunctionalityDetail = () => {
    if (!currentFunctionality) return null;
    const timing = parseFunctionalityTiming(currentFunctionality.description);
    return (
      <div className="space-y-4">
        {timing ? (
          <div className="glass-panel-sm rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-white/30">Process Step Timing</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-sm font-semibold text-green-400">{timing.pt.toFixed(1)}h</p>
                <p className="text-[10px] text-white/40">Process Time</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-400">{timing.wt.toFixed(1)}h</p>
                <p className="text-[10px] text-white/40">Wait Time</p>
              </div>
              <div>
                <p className={`text-sm font-semibold ${
                  timing.classification === "value-adding" ? "text-green-400" :
                  timing.classification === "bottleneck" ? "text-amber-400" : "text-red-400"
                }`}>
                  {timing.classification}
                </p>
                <p className="text-[10px] text-white/40">Classification</p>
              </div>
            </div>
          </div>
        ) : currentFunctionality.description ? (
          <p className="text-sm text-white/60">{currentFunctionality.description}</p>
        ) : null}

        {(currentFunctionality.sourceFiles?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/50">Source Files</p>
            {currentFunctionality.sourceFiles.map((file, i) => (
              <div key={i} className="glass-panel-sm p-3 flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-400/15 text-purple-400 text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-white/90 truncate">{file}</p>
              </div>
            ))}
          </div>
        )}

        {(currentFunctionality.sourceFiles?.length ?? 0) === 0 && !timing && !currentFunctionality.description && (
          <p className="text-sm text-white/40 italic">No detail data available for this step.</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Breadcrumb Trail ─────────────────────────────────────────────── */}
      <nav className="glass-panel-sm px-4 py-3 flex items-center gap-1.5 text-sm overflow-x-auto">
        <button
          onClick={() => navigateTo(0)}
          className={`shrink-0 font-medium transition-colors ${
            breadcrumb.length === 0 ? "text-blue-400" : "text-white/50 hover:text-white/90"
          }`}
        >
          All Repos
        </button>
        {breadcrumb.map((entry, index) => {
          const entryMeta = LEVEL_META[entry.level];
          const isLast = index === breadcrumb.length - 1;
          return (
            <span key={`${entry.level}-${entry.id}`} className="flex items-center gap-1.5 shrink-0">
              <svg className="w-3.5 h-3.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <button
                onClick={() => navigateTo(index + 1)}
                className={`font-medium transition-colors ${
                  isLast ? entryMeta.colorText : "text-white/50 hover:text-white/90"
                }`}
              >
                {entry.label}
              </button>
            </span>
          );
        })}
      </nav>

      {/* ── Header row: level title + View in VSM button ─────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${meta.colorDot}`} />
          <h3 className="text-lg font-semibold text-white">{meta.title}</h3>
          <span className="text-sm text-white/40">({items.length})</span>
        </div>
        {vsmUrl && (
          <button
            onClick={() => router.push(vsmUrl)}
            className="flex items-center gap-1.5 text-xs text-cyan-400/70 hover:text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View in VSM
          </button>
        )}
      </div>

      {/* ── Aggregate metrics bar (at capabilities / functionalities level) ── */}
      {aggregateMetrics && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Process Time", value: `${aggregateMetrics.pt.toFixed(1)}h`, color: "text-green-400" },
            { label: "Wait Time",    value: `${aggregateMetrics.wt.toFixed(1)}h`, color: "text-red-400" },
            { label: "Lead Time",    value: `${aggregateMetrics.lt.toFixed(1)}h`, color: "text-white/80" },
            {
              label: "Flow Efficiency",
              value: `${aggregateMetrics.fe.toFixed(0)}%`,
              color:
                aggregateMetrics.fe >= 40 ? "text-green-400" :
                aggregateMetrics.fe >= 20 ? "text-amber-400" : "text-red-400",
            },
          ].map((m) => (
            <div key={m.label} className="glass-panel-sm rounded-lg p-2 text-center">
              <p className={`text-sm font-semibold ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-white/40">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Process flow diagram (collapsible) ───────────────────────────── */}
      {activeMermaid && (
        <div className="glass-panel-sm rounded-xl border border-white/[0.06] overflow-hidden">
          <button
            onClick={() => setMermaidExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-medium text-white/50">{mermaidLabel}</span>
            </div>
            <svg
              className={`w-4 h-4 text-white/30 transition-transform ${mermaidExpanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {mermaidExpanded && (
            <div className="px-4 pb-4 space-y-3">
              <MermaidRenderer source={activeMermaid} />
              <div className="flex gap-4 text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-green-500" /><span className="text-white/40">Value-adding (FE≥40%)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-amber-500" /><span className="text-white/40">Bottleneck (20-40%)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-red-500" /><span className="text-white/40">Waste (&lt;20%)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-slate-700" /><span className="text-white/40">No data</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cards grid or leaf detail ─────────────────────────────────────── */}
      {breadcrumb.length >= 4 ? (
        renderFunctionalityDetail()
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (nextLevel) drillInto(level, item.id, item.name);
              }}
              disabled={!nextLevel}
              className={`glass-panel-sm p-4 text-left transition-all ${
                nextLevel
                  ? "cursor-pointer hover:bg-white/[0.07] hover:border-white/15"
                  : "cursor-default"
              } ${meta.colorBorder}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/90 truncate">{item.name}</p>
                  {item.description && (
                    <p className="mt-1 text-xs text-white/50 line-clamp-2">{item.description}</p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.colorBg} ${meta.colorText}`}>
                  {item.childCount}
                  <span className="hidden sm:inline">{meta.childLabel}</span>
                </span>
              </div>

              {item.extra && (
                <p className="mt-2 text-xs text-white/40">{item.extra}</p>
              )}

              {nextLevel && (
                <div className="mt-3 flex items-center gap-1 text-xs text-white/30">
                  <span>Drill into {meta.childLabel.toLowerCase()}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="glass-panel-sm p-8 text-center">
          <p className="text-sm text-white/40">No items at this level.</p>
        </div>
      )}
    </div>
  );
}
