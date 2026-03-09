"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassInput from "@/components/ui/GlassInput";
import ProgressRing from "@/components/ui/ProgressRing";
import MetricCard from "@/components/ui/MetricCard";
import GlassButton from "@/components/ui/GlassButton";
import ModuleAccuracyBadge from "@/components/ui/ModuleAccuracyBadge";
import EntityListSidebar from "@/components/ui/EntityListSidebar";
import StepClassificationPanel from "@/components/vsm/StepClassificationPanel";
import CapabilityComparisonChart from "@/components/vsm/CapabilityComparisonChart";
import BusinessSegmentSelector from "@/components/shared/BusinessSegmentSelector";
import { useVsmMetrics } from "@/hooks/useVsmMetrics";
import { useDigitalProducts, DigitalProduct } from "@/hooks/useDigitalProducts";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";
import MermaidRenderer from "@/components/vsm/MermaidRenderer";
import AgentOutputReviewPanel from "@/components/shared/AgentOutputReviewPanel";
import ProcessMapImportModal from "@/components/vsm/ProcessMapImportModal";
import VsmMetricsImportCard from "@/components/vsm/VsmMetricsImportCard";
import { formatDuration } from "@/lib/format-duration";
import {
  generateL1Mermaid,
  generateL2Mermaid,
  generateProductsMermaid,
  buildL1Steps,
  buildL2Steps,
  buildProductSteps,
  computeCapabilityRollup,
  parseFunctionalityTiming,
} from "@/lib/vsm-hierarchy";

type ViewLevel = "L1" | "L2" | "L3";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute total PT/LT/WT/FE for a single DigitalProduct from its capabilities. */
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

// ─────────────────────────────────────────────────────────────────────────────

function VsmPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProductId = searchParams.get("productId") ?? "";
  const urlCapabilityId = searchParams.get("capabilityId") ?? "";
  const { currentOrg } = useOrganization();
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const { products, refetch: refetchProducts } = useDigitalProducts(currentOrg?.id, selectedSegment || undefined);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string>("");
  const [viewLevel, setViewLevel] = useState<ViewLevel>("L1");
  const { execute, execution, loading: agentLoading } = useAgentExecution();
  const [reviewStatus, setReviewStatus] = useState<"pending_review" | "approved" | "rejected" | null>(null);
  const [docUrl, setDocUrl] = useState("");
  const [competitors, setCompetitors] = useState([
    { name: "", description: "" },
    { name: "", description: "" },
    { name: "", description: "" },
  ]);

  // ── Segment change → reset all, return to L1 ─────────────────────────────
  const handleSegmentChange = (segment: string) => {
    setSelectedSegment(segment);
    setSelectedProductId("");
    setSelectedCapabilityId("");
    setViewLevel("L1");
  };

  // ── Init from URL params (deep-link from Discovery) ───────────────────────
  useEffect(() => {
    if (products.length === 0 || selectedProductId) return;
    if (urlProductId && products.find((p) => p.id === urlProductId)) {
      setSelectedProductId(urlProductId);
      setViewLevel(urlCapabilityId ? "L3" : "L2");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const capabilities = selectedProduct?.digitalCapabilities ?? [];

  // ── Init capability from URL param ────────────────────────────────────────
  useEffect(() => {
    if (!urlCapabilityId || !capabilities.length) return;
    if (capabilities.find((c) => c.id === urlCapabilityId)) {
      setSelectedCapabilityId(urlCapabilityId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities, urlCapabilityId]);

  // ── Reset capability when product changes ─────────────────────────────────
  useEffect(() => {
    setSelectedCapabilityId("");
  }, [selectedProductId]);

  const selectedCapability = capabilities.find((c) => c.id === selectedCapabilityId);
  const { metrics } = useVsmMetrics(selectedCapabilityId);
  const selectedMetric = selectedCapabilityId && metrics.length > 0 ? metrics[0] : null;

  // ── Metrics ───────────────────────────────────────────────────────────────
  /** L1 overall: sum of ALL products in selected segment */
  const segmentMetrics = useMemo(() => {
    let pt = 0, wt = 0;
    for (const p of products) {
      const r = productRollup(p);
      pt += r.pt; wt += r.wt;
    }
    if (pt === 0 && wt === 0) return null;
    const lt = pt + wt || 1;
    return { processTime: pt, waitTime: wt, leadTime: lt, flowEfficiency: (pt / lt) * 100 };
  }, [products]);

  /** L2/L3 overall: selected product total (user spec: "same metrics at L2 and L3") */
  const productMetrics = useMemo(() => {
    if (!selectedProduct) return null;
    const r = productRollup(selectedProduct);
    if (!r.hasData) return null;
    return { processTime: r.pt, waitTime: r.wt, leadTime: r.lt, flowEfficiency: r.fe };
  }, [selectedProduct]);

  // L1 → segment total; L2/L3 → product total
  const activeMetrics = viewLevel === "L1" ? segmentMetrics : productMetrics;

  // ── Mermaid sources ────────────────────────────────────────────────────────
  // L1: all products in segment as process nodes
  const segmentMermaid = useMemo(() => generateProductsMermaid(products), [products]);
  // L2: capabilities of selected product
  const productCapsMermaid = useMemo(() => generateL1Mermaid(capabilities), [capabilities]);
  // L3: functionalities (prefer agent mermaid when available)
  const capFuncsMermaid = useMemo(
    () => selectedMetric?.mermaidSource || generateL2Mermaid(selectedCapability?.functionalities ?? []),
    [selectedCapability, selectedMetric]
  );

  const activeMermaid =
    viewLevel === "L1" ? segmentMermaid :
    viewLevel === "L2" ? productCapsMermaid :
    capFuncsMermaid;

  // ── Step classification panels ─────────────────────────────────────────────
  const l1Steps = useMemo(() => buildProductSteps(products), [products]);
  const l2Steps = useMemo(() => buildL1Steps(capabilities), [capabilities]);
  const l3Steps = useMemo(() => {
    if (selectedMetric?.mermaidSource) {
      const leadTime = selectedMetric.leadTime || 1;
      const metaMatch = selectedMetric.mermaidSource.match(/^%%steps:(.+)$/m);
      if (metaMatch) {
        try {
          const stepData: { n: string; c: string; pt: number; wt: number }[] = JSON.parse(metaMatch[1]);
          return stepData.map((s) => {
            const duration = Math.round((s.pt + s.wt) * 10) / 10;
            return {
              name: s.n,
              classification: s.c as "value-adding" | "bottleneck" | "waste",
              duration,
              processTime: s.pt,
              waitTime: s.wt,
              percentOfLeadTime: Math.round((duration / leadTime) * 100),
            };
          });
        } catch { /* fall through */ }
      }
    }
    return buildL2Steps(selectedCapability?.functionalities ?? []);
  }, [selectedMetric, selectedCapability]);

  const activeSteps =
    viewLevel === "L1" ? l1Steps :
    viewLevel === "L2" ? l2Steps :
    l3Steps;

  // ── Cross-capability comparison (shown at L2) ──────────────────────────────
  const capabilityComparison = useMemo(() => {
    return capabilities
      .filter((cap) => (cap.vsmMetrics?.length ?? 0) > 0)
      .map((cap) => {
        const m = cap.vsmMetrics![0];
        return { name: cap.name, processTime: m.processTime, waitTime: m.waitTime, flowEfficiency: m.flowEfficiency };
      });
  }, [capabilities]);

  const handleImported = (productId: string) => {
    setSelectedCapabilityId("");
    refetchProducts().then(() => {
      setSelectedProductId(productId);
      setViewLevel("L2");
    });
  };

  const handleRemoveProcessMap = async () => {
    if (!selectedProductId) return;
    await fetch(`/api/process-map/${selectedProductId}`, { method: "DELETE" });
    setSelectedCapabilityId("");
    refetchProducts();
  };

  // ── Mermaid card title ─────────────────────────────────────────────────────
  const mermaidTitle =
    viewLevel === "L1"
      ? `Segment Value Stream${selectedSegment ? ` — ${selectedSegment}` : " — All"}`
      : viewLevel === "L2"
      ? `${selectedProduct?.name ?? "Product"} — Capability Flow`
      : `${selectedCapability?.name ?? "Capability"} — Functionality Flow`;

  return (
    <div className="space-y-6">
      {importModalOpen && (
        <ProcessMapImportModal
          organizationId={currentOrg?.id}
          defaultSegment={selectedSegment}
          onClose={() => setImportModalOpen(false)}
          onImported={handleImported}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          {urlProductId && (
            <button
              onClick={() => router.push("/discovery")}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 mb-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Discovery
            </button>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Value Stream Mapping</h1>
            <ModuleAccuracyBadge moduleKey="leanVsm" />
          </div>
          <p className="text-white/50 mt-1">
            L1 — Segment view &nbsp;·&nbsp; L2 — Product capabilities &nbsp;·&nbsp; L3 — Functionality steps
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GlassButton onClick={() => setImportModalOpen(true)}>Import Process Map</GlassButton>
          <GlassButton
            onClick={() => {
              const input: Record<string, unknown> = {};
              if (docUrl) input.docUrl = docUrl;
              const validCompetitors = competitors.filter((c) => c.name.trim());
              if (validCompetitors.length > 0) input.competitors = validCompetitors;
              if (selectedProduct) {
                const capsWithData = capabilities.filter(
                  (c) =>
                    (c.vsmMetrics?.length ?? 0) > 0 ||
                    (c.functionalities ?? []).some((f) => parseFunctionalityTiming(f.description) !== null)
                );
                if (capsWithData.length > 0) {
                  input.existingProcessData = {
                    productId: selectedProduct.id,
                    productName: selectedProduct.name,
                    capabilities: capsWithData.map((cap) => ({
                      name: cap.name,
                      category: cap.category,
                      processTime: cap.vsmMetrics?.[0]?.processTime ?? 0,
                      waitTime: cap.vsmMetrics?.[0]?.waitTime ?? 0,
                      flowEfficiency: cap.vsmMetrics?.[0]?.flowEfficiency ?? 0,
                      steps: (cap.functionalities ?? []).map((f) => {
                        const t = parseFunctionalityTiming(f.description);
                        return { name: f.name, pt: t?.pt ?? 0, wt: t?.wt ?? 0, classification: t?.classification ?? "value-adding" };
                      }),
                    })),
                  };
                }
              }
              execute("lean_vsm", input, undefined, currentOrg?.id);
            }}
            disabled={agentLoading}
          >
            {agentLoading ? "Running..." : "Run VSM Agent"}
          </GlassButton>
        </div>
      </div>

      {/* Agent output */}
      {execution && (
        <AgentOutputReviewPanel
          execution={execution}
          loading={agentLoading}
          title="VSM Agent Output Review"
          renderSummary={(output) => {
            const m = output as Record<string, unknown>;
            return (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">VSM Analysis Results</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {m.process_time != null && <div><span className="text-white/40">Process Time</span><p className="text-white/80 font-medium">{String(m.process_time)}h</p></div>}
                  {m.lead_time != null && <div><span className="text-white/40">Lead Time</span><p className="text-white/80 font-medium">{String(m.lead_time)}h</p></div>}
                  {m.flow_efficiency != null && <div><span className="text-white/40">Flow Efficiency</span><p className="text-white/80 font-medium">{String(m.flow_efficiency)}%</p></div>}
                </div>
              </div>
            );
          }}
          onApprove={() => setReviewStatus("approved")}
          onReject={() => setReviewStatus("rejected")}
        />
      )}

      {/* Context inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard title="Existing VSM Documents">
          <GlassInput label="Document URL" placeholder="https://... or path to existing VSM document" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} />
        </GlassCard>
        <GlassCard title="Competitor Value Streams">
          <div className="space-y-3">
            {competitors.map((comp, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <GlassInput placeholder={`Competitor ${i + 1} name`} value={comp.name} onChange={(e) => { const next = [...competitors]; next[i] = { ...next[i], name: e.target.value }; setCompetitors(next); }} />
                <GlassInput placeholder="Description or URL" value={comp.description} onChange={(e) => { const next = [...competitors]; next[i] = { ...next[i], description: e.target.value }; setCompetitors(next); }} />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {reviewStatus === "approved" && (
        <div className="flex justify-end">
          <GlassButton variant="success" onClick={() => router.push("/risk-compliance")}>Proceed to Risk &amp; Compliance</GlassButton>
        </div>
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
              setViewLevel("L2"); // auto-advance to capability view
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

          {/* Update VSM Metrics via CSV/XLSX */}
          {selectedProduct && (
            <div className="glass-panel-sm rounded-xl p-3 space-y-2 border border-white/5">
              <p className="text-xs font-semibold text-white/60">Update VSM Metrics</p>
              <VsmMetricsImportCard
                productId={selectedProduct.id}
                productName={selectedProduct.name}
                onImported={() => refetchProducts()}
              />
            </div>
          )}

          {/* Remove process map */}
          {capabilities.some((c) => (c.vsmMetrics?.length ?? 0) > 0) && (
            <button
              onClick={handleRemoveProcessMap}
              className="w-full text-xs text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg py-1.5 transition-colors"
            >
              Remove Process Map Data
            </button>
          )}
        </div>

        {/* ── Right content ─────────────────────────────────────────────────── */}
        <div className="w-2/3 space-y-6">

          {/* Breadcrumb (clickable to switch level) */}
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
                    ? `${selectedCapability?.functionalities?.length ?? 0} steps`
                    : "Select capability";
                return (
                  <button
                    key={lvl}
                    onClick={() => available && setViewLevel(lvl)}
                    disabled={!available}
                    title={
                      !available
                        ? lvl === "L2" ? "Select a product first" : "Select a capability from L2"
                        : undefined
                    }
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
                ? `All products in ${selectedSegment || "all segments"} — segment-level value stream · click a product card or sidebar item to drill into capabilities`
                : viewLevel === "L2"
                ? selectedProduct
                  ? `${capabilities.length} capabilities in "${selectedProduct.name}" — click any capability card to drill into L3 steps`
                  : "Select a product from the sidebar to view its capabilities"
                : selectedCapability
                ? `${selectedCapability.functionalities?.length ?? 0} functionalities in "${selectedCapability.name}" with individual process & wait times`
                : "Select a capability from the L2 drill-down"}
            </p>
          )}

          {/* ── Overall metrics (4 cards) ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Process Time"
              value={activeMetrics ? formatDuration(activeMetrics.processTime) : "-"}
              subtitle={viewLevel === "L1" ? "Segment total" : "Product total"}
              icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <MetricCard
              title="Lead Time"
              value={activeMetrics ? formatDuration(activeMetrics.leadTime) : "-"}
              subtitle="Total elapsed time"
              icon="M13 10V3L4 14h7v7l9-11h-7z"
            />
            <MetricCard
              title="Wait Time"
              value={activeMetrics ? formatDuration(activeMetrics.waitTime) : "-"}
              subtitle="Non-value time"
              trend="up"
              trendValue="Waste"
              icon="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <MetricCard
              title="Flow Efficiency"
              value={activeMetrics ? `${activeMetrics.flowEfficiency.toFixed(1)}%` : "-"}
              subtitle="PT / LT ratio"
              icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </div>

          {/* ── Mermaid + Gauge ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard title={mermaidTitle} className="lg:col-span-2">
              {activeMermaid ? (
                <MermaidRenderer source={activeMermaid} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-white/30 gap-2 text-center px-6">
                  {viewLevel === "L1" && products.length === 0 && (
                    <p className="text-sm">No products in this segment. Import a process map or run Discovery agent.</p>
                  )}
                  {viewLevel === "L2" && !selectedProduct && (
                    <p className="text-sm">Select a product from the sidebar to view its capabilities.</p>
                  )}
                  {viewLevel === "L2" && selectedProduct && capabilities.length === 0 && (
                    <p className="text-sm">No capabilities yet — import a process map or run the VSM agent.</p>
                  )}
                  {viewLevel === "L3" && !selectedCapability && (
                    <p className="text-sm">Select a capability from the L2 cards below to view its functionalities.</p>
                  )}
                  {viewLevel === "L3" && selectedCapability && (selectedCapability.functionalities?.length ?? 0) === 0 && (
                    <p className="text-sm">No functionalities. Import a process map with step data.</p>
                  )}
                </div>
              )}
              <div className="flex gap-4 mt-4 text-xs flex-wrap">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500" /><span className="text-white/50">Value-adding (FE≥40%)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /><span className="text-white/50">Bottleneck (20-40%)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500" /><span className="text-white/50">Waste (&lt;20%)</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-slate-700" /><span className="text-white/50">No data</span></div>
              </div>
            </GlassCard>

            <GlassCard title="Flow Efficiency">
              <div className="flex flex-col items-center justify-center py-8">
                <ProgressRing
                  progress={activeMetrics?.flowEfficiency ?? 0}
                  size={140}
                  strokeWidth={8}
                  color={
                    activeMetrics && activeMetrics.flowEfficiency > 25 ? "#22c55e" :
                    activeMetrics && activeMetrics.flowEfficiency > 10 ? "#f59e0b" : "#ef4444"
                  }
                />
                <p className="text-sm text-white/50 mt-4 text-center">
                  {!activeMetrics ? "No data available" :
                    activeMetrics.flowEfficiency < 10 ? "Poor — significant waste" :
                    activeMetrics.flowEfficiency < 25 ? "Fair — room for improvement" :
                    "Good — efficient value delivery"}
                </p>
              </div>
              {activeMetrics && (
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-sm"><span className="text-white/40">Process Time</span><span className="text-green-400">{formatDuration(activeMetrics.processTime)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-white/40">Wait Time</span><span className="text-red-400">{formatDuration(activeMetrics.waitTime)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-white/40">Lead Time</span><span className="text-white/70">{formatDuration(activeMetrics.leadTime)}</span></div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* ── L1 Drill-down: Product cards ──────────────────────────────── */}
          {viewLevel === "L1" && products.length > 0 && (
            <GlassCard title={`Products in ${selectedSegment || "All Segments"}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => {
                  const { pt, wt, lt, fe, hasData } = productRollup(product);
                  const feColor = fe >= 40 ? "text-green-400" : fe >= 20 ? "text-amber-400" : "text-red-400";
                  const clsLabel = fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste";
                  const clsBg = fe >= 40 ? "bg-green-500/15 text-green-400" : fe >= 20 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
                  const segLT = (segmentMetrics?.leadTime ?? 0) || 1;
                  const pct = hasData ? Math.round((lt / segLT) * 100) : 0;
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
                            {product.businessSegment && (
                              <GlassBadge variant="info">{product.businessSegment}</GlassBadge>
                            )}
                            <span className="text-xs text-white/30">
                              {product.digitalCapabilities?.length ?? 0} capabilities
                            </span>
                            {hasData && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${clsBg}`}>
                                {clsLabel}
                              </span>
                            )}
                          </div>
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
                              <span>% of segment lead time</span>
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
            </GlassCard>
          )}

          {/* ── L2 Drill-down: Capability cards (merged with classification) ── */}
          {viewLevel === "L2" && selectedProduct && capabilities.length > 0 && (
            <GlassCard title={`Capabilities — ${selectedProduct.name} · click any card to explore L3 steps`}>
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
                  const funcCount = cap.functionalities?.length ?? 0;
                  // % of this capability's LT relative to the product's total LT
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
                          <p className="text-sm font-medium text-white/90">{cap.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {cap.category && <GlassBadge variant="info">{cap.category}</GlassBadge>}
                            <span className="text-xs text-white/30">{funcCount} steps</span>
                            {hasData && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${clsBg}`}>
                                {clsLabel}
                              </span>
                            )}
                          </div>
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
                          {/* % of product total lead time — the "classification bar" insight */}
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
            </GlassCard>
          )}

          {/* ── L3 Drill-down: Functionality cards ────────────────────────── */}
          {viewLevel === "L3" && selectedCapability && (
            <GlassCard title={`Functionalities — ${selectedCapability.name}`}>
              {(selectedCapability.functionalities?.length ?? 0) === 0 ? (
                <p className="text-sm text-white/40">No functionalities. Import a process map with step data.</p>
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
                      <div key={func.id} className="glass-panel-sm p-3 rounded-xl">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-white/20 pt-0.5 shrink-0 tabular-nums">{idx + 1}.</span>
                          <p className="text-xs font-medium text-white/80 leading-snug">{func.name}</p>
                        </div>
                        {t ? (
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/50 pl-4">
                            <span>PT {t.pt.toFixed(1)}h</span>
                            <span>WT {t.wt.toFixed(1)}h</span>
                            <span className={clsColor}>{cls}</span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-white/20 mt-1 pl-4 line-clamp-2">
                            {func.description?.substring(0, 60)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          )}

          {/* Step Classification Panel — L1 (products) and L3 (functionalities) only.
              L2 omitted: classification + % bar is already shown inside each capability card. */}
          {activeSteps.length > 0 && viewLevel !== "L2" && (
            <GlassCard
              title={
                viewLevel === "L1"
                  ? "Product Classification — Segment Value Stream"
                  : "Functionality Classification — Step Analysis"
              }
            >
              <StepClassificationPanel steps={activeSteps} />
            </GlassCard>
          )}

          {/* Cross-Capability Comparison (L2 only, when 2+ caps have metrics) */}
          {viewLevel === "L2" && capabilityComparison.length > 1 && (
            <GlassCard title="Capability Comparison">
              <CapabilityComparisonChart capabilities={capabilityComparison} />
            </GlassCard>
          )}

          {/* Capability Metrics Table (L2 only) */}
          {viewLevel === "L2" && capabilityComparison.length > 1 && (
            <GlassCard title="Capability Metrics Summary">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/40 border-b border-white/10">
                      <th className="pb-3 pr-4">Capability</th>
                      <th className="pb-3 pr-4">Classification</th>
                      <th className="pb-3 pr-4">PT</th>
                      <th className="pb-3 pr-4">WT</th>
                      <th className="pb-3 min-w-[140px]">Flow Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/70">
                    {capabilityComparison.map((cap, i) => {
                      const fe = cap.flowEfficiency;
                      const feColor = fe >= 40 ? "text-green-400" : fe >= 20 ? "text-amber-400" : "text-red-400";
                      const clsLabel = fe >= 40 ? "value-adding" : fe >= 20 ? "bottleneck" : "waste";
                      const clsBg = fe >= 40 ? "bg-green-500/15 text-green-400" : fe >= 20 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
                      const barColor = fe >= 40 ? "bg-green-500" : fe >= 20 ? "bg-amber-500" : "bg-red-500";
                      return (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 pr-4 font-medium text-white/80">{cap.name}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${clsBg}`}>
                              {clsLabel}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-green-400">{formatDuration(cap.processTime)}</td>
                          <td className="py-3 pr-4 text-red-400">{formatDuration(cap.waitTime)}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(fe, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium tabular-nums ${feColor}`}>{fe.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VsmPage() {
  return (
    <Suspense fallback={<div className="text-white/40 text-sm p-8">Loading...</div>}>
      <VsmPageInner />
    </Suspense>
  );
}
