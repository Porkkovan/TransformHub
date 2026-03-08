"use client";

import { useEffect, useState, useMemo } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassBadge from "@/components/ui/GlassBadge";
import MetricCard from "@/components/ui/MetricCard";
import EntityListSidebar from "@/components/ui/EntityListSidebar";
import InlineEditText from "@/components/ui/InlineEditText";
import ArchitectureDiagramPanel from "@/components/product-workbench/ArchitectureDiagramPanel";
import ReadinessScorePanel from "@/components/product-workbench/ReadinessScorePanel";
import { useDigitalProducts, DigitalProduct } from "@/hooks/useDigitalProducts";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";
import BusinessSegmentSelector from "@/components/shared/BusinessSegmentSelector";
import AgentOutputReviewPanel from "@/components/shared/AgentOutputReviewPanel";
import { parseFunctionalityTiming, computeCapabilityRollup } from "@/lib/vsm-hierarchy";
import { formatDuration } from "@/lib/format-duration";
import ExportDropdown from "@/components/ui/ExportDropdown";

type ViewLevel = "L1" | "L2" | "L3";

// ── Readiness score ────────────────────────────────────────────────────────
function computeReadiness(product: DigitalProduct) {
  const caps = product.digitalCapabilities ?? [];
  const funcs = caps.flatMap((c) => c.functionalities ?? []);
  const capsWithVsm = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
  const capsWithProcMap = caps.filter((c) => c.category === "PROCESS_MAP");
  const vsmCoverage = caps.length > 0 ? (capsWithVsm.length / caps.length) * 10 : 0;
  let avgFe = 0;
  if (capsWithVsm.length > 0) {
    const totalFe = capsWithVsm.reduce((s, c) => s + c.vsmMetrics![0].flowEfficiency, 0);
    avgFe = Math.min((totalFe / capsWithVsm.length) / 10, 10);
  }
  const docScore = capsWithProcMap.length > 0 ? 8.5 : funcs.length > 8 ? 6.0 : funcs.length > 3 ? 4.0 : 2.5;
  const depthScore = Math.min(caps.length > 0 ? (funcs.length / caps.length) * 2 : 0, 10);
  const readinessScore = vsmCoverage * 0.35 + avgFe * 0.25 + docScore * 0.25 + depthScore * 0.15;
  return {
    productId: product.id,
    productName: product.name,
    readinessScore: Math.round(Math.min(readinessScore, 10) * 10) / 10,
    factors: [
      { name: "VSM Coverage", score: Math.round(vsmCoverage * 10) / 10 },
      { name: "Flow Efficiency", score: Math.round(avgFe * 10) / 10 },
      { name: "Documentation", score: Math.round(docScore * 10) / 10 },
      { name: "Functionality Depth", score: Math.round(depthScore * 10) / 10 },
    ],
  };
}

// ── Product PT/WT/FE rollup ────────────────────────────────────────────────
function productRollup(product: DigitalProduct) {
  const caps = product.digitalCapabilities ?? [];
  let pt = 0, wt = 0;
  const withM = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
  if (withM.length > 0) {
    pt = withM.reduce((s, c) => s + c.vsmMetrics![0].processTime, 0);
    wt = withM.reduce((s, c) => s + c.vsmMetrics![0].waitTime, 0);
  } else {
    for (const cap of caps) {
      const r = computeCapabilityRollup(cap.functionalities ?? []);
      if (r) { pt += r.pt; wt += r.wt; }
    }
  }
  const lt = pt + wt || 0;
  const fe = lt > 0 ? (pt / lt) * 100 : 0;
  return { pt, wt, lt, fe, hasData: lt > 0 };
}


export default function ProductWorkbenchPage() {
  const { currentOrg } = useOrganization();
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const { products, refetch: refetchProducts } = useDigitalProducts(currentOrg?.id, selectedSegment || undefined);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string>("");
  const [viewLevel, setViewLevel] = useState<ViewLevel>("L1");
  const [addingFuncForCapId, setAddingFuncForCapId] = useState<string | null>(null);
  const [newFuncName, setNewFuncName] = useState("");
  const { execute: executeArch, execution: archExecution, loading: archAgentLoading } = useAgentExecution();

  // Segment change → reset all, return to L1
  const handleSegmentChange = (segment: string) => {
    setSelectedSegment(segment);
    setSelectedProductId("");
    setSelectedCapabilityId("");
    setViewLevel("L1");
  };

  // Auto-select first product on load
  useEffect(() => {
    if (products.length > 0 && !products.find((p) => p.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  // Reset capability when product changes
  useEffect(() => {
    setSelectedCapabilityId("");
  }, [selectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const capabilities = selectedProduct?.digitalCapabilities ?? [];
  const selectedCapability = capabilities.find((c) => c.id === selectedCapabilityId);
  const repositoryId = selectedProduct?.repository?.id;

  const handleRunArchAgent = () => {
    executeArch("architecture", {}, repositoryId, currentOrg?.id);
  };

  const segmentReadiness = useMemo(() => products.map(computeReadiness), [products]);

  const productMetrics = useMemo(() => {
    if (!selectedProduct) return null;
    const r = productRollup(selectedProduct);
    if (!r.hasData) return null;
    return { processTime: r.pt, waitTime: r.wt, leadTime: r.lt, flowEfficiency: r.fe };
  }, [selectedProduct]);

  // Product-level VSM rollup (same as original productVsmRollup)
  const productVsmRollup = useMemo(() => {
    if (!selectedProduct) return null;
    const caps = selectedProduct.digitalCapabilities ?? [];
    const capsWithVsm = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
    if (capsWithVsm.length > 0) {
      const pt = capsWithVsm.reduce((s, c) => s + c.vsmMetrics![0].processTime, 0);
      const wt = capsWithVsm.reduce((s, c) => s + c.vsmMetrics![0].waitTime, 0);
      const lt = pt + wt || 1;
      return { pt, wt, lt, fe: (pt / lt) * 100 };
    }
    const rollup = computeCapabilityRollup(caps.flatMap((c) => c.functionalities ?? []));
    return rollup ? { pt: rollup.pt, wt: rollup.wt, lt: rollup.lt, fe: rollup.fe } : null;
  }, [selectedProduct]);

  const totalCapabilities = selectedProduct?.digitalCapabilities?.length ?? 0;
  const totalFunctionalities = selectedProduct?.digitalCapabilities?.reduce(
    (sum, cap) => sum + (cap.functionalities?.length ?? 0), 0
  ) ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Product Workbench</h1>
          <p className="text-white/50 mt-1">
            L1 — Digital products &nbsp;·&nbsp; L2 — Capabilities &nbsp;·&nbsp; L3 — Functionalities
          </p>
        </div>
        <ExportDropdown
          endpoint="/api/export/workbench"
          params={{ orgId: currentOrg?.id, productId: selectedProductId || undefined }}
          label="Export"
          disabled={!currentOrg?.id}
        />
      </div>

      {/* Agent output */}
      {archExecution && (
        <AgentOutputReviewPanel
          execution={archExecution}
          loading={archAgentLoading}
          title="Architecture Agent Output Review"
          renderSummary={(output) => {
            const data = output as Record<string, unknown>;
            const components = Array.isArray(data.components) ? data.components : [];
            const patterns = Array.isArray(data.patterns) ? data.patterns : [];
            const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
            return (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Architecture Analysis Results</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-white/40">Components</span><p className="text-white/80 font-medium">{components.length} found</p></div>
                  <div><span className="text-white/40">Patterns</span><p className="text-white/80 font-medium">{patterns.length} detected</p></div>
                  <div><span className="text-white/40">Recommendations</span><p className="text-white/80 font-medium">{recommendations.length} items</p></div>
                </div>
              </div>
            );
          }}
          onApprove={() => {}}
          onReject={() => {}}
        />
      )}

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="w-1/3 space-y-4">
          <BusinessSegmentSelector value={selectedSegment} onChange={handleSegmentChange} />
          <EntityListSidebar<DigitalProduct>
            title="Digital Products"
            items={products}
            selectedId={selectedProductId}
            onSelect={(id) => {
              setSelectedProductId(id);
              setViewLevel("L2");
            }}
            getId={(p) => p.id}
            renderItem={(product, isSelected) => (
              <div>
                <p className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/70"}`}>{product.name}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {product.digitalCapabilities?.length ?? 0} capabilities
                  {product.businessSegment && ` · ${product.businessSegment}`}
                </p>
              </div>
            )}
          />
        </div>

        {/* ── Right content ─────────────────────────────────────────────────── */}
        <div className="w-2/3 space-y-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button
              onClick={() => setViewLevel("L1")}
              className={`transition-colors ${viewLevel === "L1" ? "text-white/80" : "text-white/30 hover:text-white/60"}`}
            >
              {selectedSegment || "All Segments"}
            </button>
            {selectedProduct && (
              <>
                <span className="text-white/20">/</span>
                <button
                  onClick={() => setViewLevel("L2")}
                  className={`transition-colors ${viewLevel === "L2" ? "text-white/80" : "text-white/30 hover:text-white/60"}`}
                >
                  {selectedProduct.name}
                </button>
              </>
            )}
            {selectedCapability && (
              <>
                <span className="text-white/20">/</span>
                <button
                  onClick={() => setViewLevel("L3")}
                  className={`transition-colors ${viewLevel === "L3" ? "text-blue-400/80" : "text-white/30 hover:text-white/60"}`}
                >
                  {selectedCapability.name}
                </button>
              </>
            )}
            <span className="ml-1">
              <GlassBadge variant={viewLevel === "L1" ? "info" : viewLevel === "L2" ? "warning" : "success"}>
                {viewLevel}
              </GlassBadge>
            </span>
          </div>

          {/* Level tabs */}
          {products.length > 0 && (
            <div className="glass-panel rounded-xl p-1 flex gap-1">
              {(["L1", "L2", "L3"] as ViewLevel[]).map((lvl) => {
                const available =
                  lvl === "L1" ? true :
                  lvl === "L2" ? !!selectedProductId :
                  !!(selectedProductId && selectedCapabilityId);
                const sublabel =
                  lvl === "L1"
                    ? `${products.length} product${products.length !== 1 ? "s" : ""}`
                    : lvl === "L2"
                    ? selectedProductId ? `${capabilities.length} capabilities` : "Select product"
                    : selectedCapabilityId
                    ? `${selectedCapability?.functionalities?.length ?? 0} functionalities`
                    : "Select capability";
                return (
                  <button
                    key={lvl}
                    onClick={() => available && setViewLevel(lvl)}
                    disabled={!available}
                    title={!available ? (lvl === "L2" ? "Select a product first" : "Select a capability from L2") : undefined}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      viewLevel === lvl ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    <div className="font-semibold">{lvl}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{sublabel}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Level description */}
          {products.length > 0 && (
            <p className="text-xs text-white/30 -mt-2">
              {viewLevel === "L1"
                ? `All products in ${selectedSegment || "all segments"} — click a product card or sidebar item to drill into capabilities`
                : viewLevel === "L2"
                ? selectedProduct
                  ? `${capabilities.length} capabilities in "${selectedProduct.name}" — click any capability card to drill into L3 functionalities`
                  : "Select a product from the sidebar"
                : selectedCapability
                ? `${selectedCapability.functionalities?.length ?? 0} functionalities in "${selectedCapability.name}" — click names to edit inline`
                : "Select a capability from the L2 drill-down"}
            </p>
          )}

          {/* ── L1: Product cards ─────────────────────────────────────────── */}
          {viewLevel === "L1" && products.length > 0 && (
            <GlassCard title={`Digital Products — ${selectedSegment || "All Segments"}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => {
                  const { pt, lt, fe, hasData } = productRollup(product);
                  const feColor = fe >= 40 ? "text-green-400" : fe >= 20 ? "text-amber-400" : "text-red-400";
                  const clsLabel = fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste";
                  const clsBg = fe >= 40 ? "bg-green-500/15 text-green-400" : fe >= 20 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
                  const readiness = segmentReadiness.find((r) => r.productId === product.id);
                  const rs = readiness?.readinessScore ?? 0;
                  const rsColor = rs >= 7 ? "text-green-400" : rs >= 4 ? "text-amber-400" : "text-red-400";
                  const isSelected = product.id === selectedProductId;
                  return (
                    <div
                      key={product.id}
                      onClick={() => { setSelectedProductId(product.id); setViewLevel("L2"); }}
                      className={`glass-panel-sm rounded-xl p-4 space-y-3 transition-all cursor-pointer hover:bg-white/5 border ${isSelected ? "border-blue-500/40" : "border-transparent hover:border-white/10"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {product.businessSegment && <GlassBadge variant="info">{product.businessSegment}</GlassBadge>}
                            <span className="text-xs text-white/30">{product.digitalCapabilities?.length ?? 0} capabilities</span>
                            {hasData && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${clsBg}`}>{clsLabel}</span>
                            )}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-white/20 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <span className="text-white/40 block text-[10px]">Readiness</span>
                          <span className={`font-bold text-sm ${rsColor}`}>{rs.toFixed(1)}<span className="text-[10px] text-white/30 font-normal">/10</span></span>
                        </div>
                        {hasData && (
                          <>
                            <div><span className="text-white/40 block text-[10px]">PT</span><span className="text-white/70 font-medium">{formatDuration(pt)}</span></div>
                            <div><span className="text-white/40 block text-[10px]">LT</span><span className="text-white/70 font-medium">{formatDuration(lt)}</span></div>
                            <div><span className="text-white/40 block text-[10px]">FE</span><span className={`font-medium ${feColor}`}>{fe.toFixed(0)}%</span></div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Readiness panel */}
              {segmentReadiness.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/8">
                  <p className="text-xs text-white/40 font-medium mb-3">Readiness Overview</p>
                  <ReadinessScorePanel products={segmentReadiness} />
                </div>
              )}
            </GlassCard>
          )}

          {/* ── L2: Capability cards ──────────────────────────────────────── */}
          {viewLevel === "L2" && selectedProduct && (
            <>
              {/* Product header */}
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-white">{selectedProduct.name}</h2>
                  <div className="flex items-center gap-2">
                    <GlassBadge variant="info">{totalCapabilities} capabilities</GlassBadge>
                    <GlassBadge variant="default">{totalFunctionalities} functionalities</GlassBadge>
                  </div>
                </div>
                <p className="text-sm text-white/50">{selectedProduct.description}</p>
              </div>

              {/* Product metrics */}
              {productMetrics && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard title="Process Time" value={formatDuration(productMetrics.processTime)} subtitle="Product total" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <MetricCard title="Lead Time" value={formatDuration(productMetrics.leadTime)} subtitle="Total elapsed time" icon="M13 10V3L4 14h7v7l9-11h-7z" />
                  <MetricCard title="Wait Time" value={formatDuration(productMetrics.waitTime)} subtitle="Non-value time" trend="up" trendValue="Waste" icon="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <MetricCard title="Flow Efficiency" value={`${productMetrics.flowEfficiency.toFixed(1)}%`} subtitle="PT / LT ratio" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </div>
              )}

              {/* Value Stream Metrics — product total + by capability breakdown */}
              {capabilities.some((c) => (c.vsmMetrics?.length ?? 0) > 0) && (
                <GlassCard title="Value Stream Metrics">
                  {productVsmRollup && (
                    <div className="mb-4 pb-4 border-b border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium mb-3">Product Total</p>
                      <div className="grid grid-cols-4 gap-4">
                        <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Process Time</p><p className="text-xl font-bold text-green-400">{formatDuration(productVsmRollup.pt)}</p></div>
                        <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Wait Time</p><p className="text-xl font-bold text-red-400">{formatDuration(productVsmRollup.wt)}</p></div>
                        <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Lead Time</p><p className="text-xl font-bold text-white/70">{formatDuration(productVsmRollup.lt)}</p></div>
                        <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Flow Efficiency</p><p className={`text-xl font-bold ${productVsmRollup.fe >= 40 ? "text-green-400" : productVsmRollup.fe >= 20 ? "text-amber-400" : "text-red-400"}`}>{productVsmRollup.fe.toFixed(1)}%</p></div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">By Capability</p>
                    {capabilities.filter((c) => (c.vsmMetrics?.length ?? 0) > 0).map((cap) => {
                      const m = cap.vsmMetrics![0];
                      return (
                        <div key={cap.id} className="glass-panel-sm rounded-xl p-4">
                          <p className="text-sm font-medium text-white/80 mb-3">{cap.name}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Process Time</p><p className="text-lg font-bold text-green-400">{m.processTime.toFixed(1)}h</p></div>
                            <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Wait Time</p><p className="text-lg font-bold text-red-400">{m.waitTime.toFixed(1)}h</p></div>
                            <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Lead Time</p><p className="text-lg font-bold text-white/70">{m.leadTime.toFixed(1)}h</p></div>
                            <div><p className="text-[10px] text-white/40 uppercase tracking-wide">Flow Efficiency</p><p className={`text-lg font-bold ${m.flowEfficiency >= 40 ? "text-green-400" : m.flowEfficiency >= 20 ? "text-amber-400" : "text-red-400"}`}>{m.flowEfficiency.toFixed(1)}%</p></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              )}

              <GlassCard title={`Capabilities — ${selectedProduct.name} · click any card to explore L3 functionalities`}>
                {capabilities.length === 0 ? (
                  <p className="text-sm text-white/30 italic">No capabilities discovered yet — run the Discovery agent first</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {capabilities.map((cap) => {
                      const m = cap.vsmMetrics?.[0];
                      const r = !m ? computeCapabilityRollup(cap.functionalities ?? []) : null;
                      const pt = m?.processTime ?? r?.pt ?? 0;
                      const wt = m?.waitTime ?? r?.wt ?? 0;
                      const lt = (m?.leadTime ?? r?.lt ?? (pt + wt)) || 0;
                      const fe = m?.flowEfficiency ?? (lt > 0 ? (pt / lt) * 100 : 0);
                      const hasData = lt > 0;
                      const feColor = fe >= 40 ? "text-green-400" : fe >= 20 ? "text-amber-400" : "text-red-400";
                      const clsLabel = fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste";
                      const clsBg = fe >= 40 ? "bg-green-500/15 text-green-400" : fe >= 20 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
                      const productLT = (productMetrics?.leadTime ?? 0) || 1;
                      const pct = hasData ? Math.round((lt / productLT) * 100) : 0;
                      const isSelected = cap.id === selectedCapabilityId;
                      return (
                        <div
                          key={cap.id}
                          onClick={() => { setSelectedCapabilityId(cap.id); setViewLevel("L3"); }}
                          className={`glass-panel-sm rounded-xl p-4 space-y-3 transition-all cursor-pointer hover:bg-white/5 border ${isSelected ? "border-blue-500/40" : "border-transparent hover:border-white/10"}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div onClick={(e) => e.stopPropagation()}>
                                <InlineEditText
                                  value={cap.name}
                                  displayClassName="text-sm font-medium text-white/90"
                                  onSave={async (val) => {
                                    await fetch(`/api/digital-capabilities/${cap.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ name: val }),
                                    });
                                    await refetchProducts();
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {cap.category && <GlassBadge variant="info">{cap.category}</GlassBadge>}
                                <span className="text-xs text-white/30">{cap.functionalities?.length ?? 0} functionalities</span>
                                {hasData && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${clsBg}`}>{clsLabel}</span>}
                              </div>
                              {cap.description && (
                                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                  <InlineEditText
                                    value={cap.description ?? ""}
                                    placeholder="Add description…"
                                    multiline
                                    displayClassName="text-xs text-white/40"
                                    inputClassName="text-xs"
                                    onSave={async (val) => {
                                      await fetch(`/api/digital-capabilities/${cap.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ description: val }),
                                      });
                                      await refetchProducts();
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            <svg className="w-4 h-4 text-white/20 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          {hasData && (
                            <>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div><span className="text-white/40 block">PT</span><span className="text-white/70 font-medium">{formatDuration(pt)}</span></div>
                                <div><span className="text-white/40 block">LT</span><span className="text-white/70 font-medium">{formatDuration(lt)}</span></div>
                                <div><span className="text-white/40 block">FE</span><span className={`font-medium ${feColor}`}>{fe.toFixed(0)}%</span></div>
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-white/25 mb-1">
                                  <span>% of product lead time</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${fe >= 40 ? "bg-green-500" : fe >= 20 ? "bg-amber-500" : "bg-red-500"}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>

              {/* Architecture Views — shown at L2 */}
              <GlassCard title="Architecture Views">
                <ArchitectureDiagramPanel
                  repositoryId={repositoryId}
                  organizationId={currentOrg?.id}
                  mode="current"
                  productName={selectedProduct.name}
                  capabilities={capabilities}
                  onRunAgent={handleRunArchAgent}
                  agentLoading={archAgentLoading}
                />
              </GlassCard>
            </>
          )}

          {/* ── L3: Functionality cards ────────────────────────────────────── */}
          {viewLevel === "L3" && selectedCapability && (
            <GlassCard title={`Functionalities — ${selectedCapability.name}`}>
              {(selectedCapability.functionalities?.length ?? 0) === 0 && addingFuncForCapId !== selectedCapability.id ? (
                <p className="text-sm text-white/30 italic">No functionalities yet — add one below</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(selectedCapability.functionalities ?? []).map((func, idx) => {
                    const t = parseFunctionalityTiming(func.description);
                    const cls = t?.classification;
                    const clsColor =
                      cls === "value-adding" ? "text-green-400" :
                      cls === "bottleneck" ? "text-amber-400" :
                      cls === "waste" ? "text-red-400" : "text-white/30";
                    return (
                      <div key={func.id} className="glass-panel-sm p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-start gap-2">
                          <span className="text-[10px] text-white/20 pt-0.5 shrink-0 tabular-nums">{idx + 1}.</span>
                          <InlineEditText
                            value={func.name}
                            displayClassName="text-xs font-medium text-white/80 leading-snug"
                            onSave={async (val) => {
                              await fetch(`/api/functionalities/${func.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: val }),
                              });
                              await refetchProducts();
                            }}
                          />
                          </div>
                          <GlassBadge variant="default">{func.sourceFiles?.length ?? 0} files</GlassBadge>
                        </div>
                        {t ? (
                          <div className="flex items-center gap-3 text-[10px] text-white/50 pl-4">
                            <span>PT {t.pt.toFixed(1)}h</span>
                            <span>WT {t.wt.toFixed(1)}h</span>
                            <span className={clsColor}>{cls}</span>
                          </div>
                        ) : (
                          <div className="pl-4">
                            <InlineEditText
                              value={func.description ?? ""}
                              placeholder="Add description…"
                              displayClassName="text-xs text-white/40"
                              inputClassName="text-xs"
                              onSave={async (val) => {
                                await fetch(`/api/functionalities/${func.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ description: val }),
                                });
                                await refetchProducts();
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add functionality */}
              <div className="mt-4">
                {addingFuncForCapId === selectedCapability.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newFuncName}
                      onChange={(e) => setNewFuncName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newFuncName.trim()) {
                          await fetch("/api/functionalities", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newFuncName.trim(), digitalCapabilityId: selectedCapability.id }),
                          });
                          setNewFuncName("");
                          setAddingFuncForCapId(null);
                          await refetchProducts();
                        }
                        if (e.key === "Escape") { setAddingFuncForCapId(null); setNewFuncName(""); }
                      }}
                      placeholder="Functionality name… (Enter to add)"
                      className="flex-1 bg-white/8 border border-blue-500/30 rounded-lg px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={async () => {
                        if (!newFuncName.trim()) return;
                        await fetch("/api/functionalities", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: newFuncName.trim(), digitalCapabilityId: selectedCapability.id }),
                        });
                        setNewFuncName("");
                        setAddingFuncForCapId(null);
                        await refetchProducts();
                      }}
                      className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs border border-green-500/20 hover:bg-green-500/30 transition-colors"
                    >Add</button>
                    <button
                      onClick={() => { setAddingFuncForCapId(null); setNewFuncName(""); }}
                      className="px-2 py-1 rounded-lg bg-white/8 text-white/40 text-xs border border-white/10 hover:bg-white/15 transition-colors"
                    >Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingFuncForCapId(selectedCapability.id); setNewFuncName(""); }}
                    className="text-xs text-blue-400/60 hover:text-blue-400 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add functionality
                  </button>
                )}
              </div>
            </GlassCard>
          )}

          {products.length === 0 && (
            <div className="flex items-center justify-center h-64 text-white/30">
              <p>No products found. Run the Discovery agent first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
