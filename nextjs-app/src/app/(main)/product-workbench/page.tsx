"use client";

import { useEffect, useState, useMemo } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassButton from "@/components/ui/GlassButton";
import EntityListSidebar from "@/components/ui/EntityListSidebar";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
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

// ── Compute a product-level readiness score from live VSM + capability data ──
function computeReadiness(product: DigitalProduct) {
  const caps = product.digitalCapabilities ?? [];
  const funcs = caps.flatMap((c) => c.functionalities ?? []);
  const capsWithVsm = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
  const capsWithProcMap = caps.filter((c) => c.category === "PROCESS_MAP");

  // VSM Coverage (0–10): what fraction of caps have VSM metrics
  const vsmCoverage = caps.length > 0 ? (capsWithVsm.length / caps.length) * 10 : 0;

  // Flow Efficiency (0–10): normalise avg FE (100% FE → 10 pts)
  let avgFe = 0;
  if (capsWithVsm.length > 0) {
    const totalFe = capsWithVsm.reduce((s, c) => s + c.vsmMetrics![0].flowEfficiency, 0);
    avgFe = Math.min((totalFe / capsWithVsm.length) / 10, 10);
  }

  // Documentation (0–10): process-map import present → higher score
  const docScore = capsWithProcMap.length > 0 ? 8.5 : funcs.length > 8 ? 6.0 : funcs.length > 3 ? 4.0 : 2.5;

  // Functionality Depth (0–10): avg funcs per cap, capped at 10
  const depthScore = Math.min(caps.length > 0 ? (funcs.length / caps.length) * 2 : 0, 10);

  const readinessScore =
    vsmCoverage * 0.35 + avgFe * 0.25 + docScore * 0.25 + depthScore * 0.15;

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

// ── Format a functionality description: JSON timing → human text, else plain ──
function formatFuncDesc(description: string | null | undefined): string | null {
  if (!description) return null;
  const timing = parseFunctionalityTiming(description);
  if (timing) {
    return `PT ${timing.pt.toFixed(1)}h  ·  WT ${timing.wt.toFixed(1)}h  ·  ${timing.classification}`;
  }
  // Plain text — return as-is (truncated)
  return description.length > 120 ? description.substring(0, 120) + "…" : description;
}

export default function ProductWorkbenchPage() {
  const { currentOrg } = useOrganization();
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const { products, refetch: refetchProducts } = useDigitalProducts(currentOrg?.id, selectedSegment || undefined);
  const [addingFuncForCapId, setAddingFuncForCapId] = useState<string | null>(null);
  const [newFuncName, setNewFuncName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const { execute: executeArch, execution: archExecution, loading: archAgentLoading } = useAgentExecution();

  // Reset product selection when segment changes
  const handleSegmentChange = (segment: string) => {
    setSelectedSegment(segment);
    setSelectedProductId("");
  };

  // Auto-select first product
  useEffect(() => {
    if (products.length > 0 && !products.find((p) => p.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const repositoryId = selectedProduct?.repository?.id;

  const handleRunArchAgent = () => {
    executeArch("architecture", {}, repositoryId, currentOrg?.id);
  };

  // Compute readiness from live product data for ALL products in segment
  const segmentReadiness = useMemo(() => products.map(computeReadiness), [products]);

  // Count totals for the selected product
  const totalCapabilities = selectedProduct?.digitalCapabilities?.length ?? 0;
  const totalFunctionalities =
    selectedProduct?.digitalCapabilities?.reduce(
      (sum, cap) => sum + (cap.functionalities?.length ?? 0),
      0
    ) ?? 0;

  // Compute product-level VSM rollup for the summary row
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
    // Fall back to functionality timing rollup
    const rollup = computeCapabilityRollup(
      caps.flatMap((c) => c.functionalities ?? [])
    );
    return rollup ? { pt: rollup.pt, wt: rollup.wt, lt: rollup.lt, fe: rollup.fe } : null;
  }, [selectedProduct]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Product Workbench</h1>
          <p className="text-white/50 mt-1">Current state analysis of digital products</p>
        </div>
        <ExportDropdown
          endpoint="/api/export/workbench"
          params={{ orgId: currentOrg?.id, productId: selectedProductId || undefined }}
          label="Export"
          disabled={!currentOrg?.id}
        />
      </div>

      {/* Readiness Score Overview — computed from real product + VSM data */}
      {segmentReadiness.length > 0 && (
        <GlassCard title={`Product Readiness Scores — ${selectedSegment || "All Segments"}`}>
          <ReadinessScorePanel products={segmentReadiness} />
        </GlassCard>
      )}

      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Left Sidebar */}
        <div className="w-1/4 space-y-4">
          <BusinessSegmentSelector value={selectedSegment} onChange={handleSegmentChange} />
          <EntityListSidebar<DigitalProduct>
            title="Digital Products"
            items={products}
            selectedId={selectedProductId}
            onSelect={setSelectedProductId}
            getId={(p) => p.id}
            renderItem={(product, isSelected) => (
              <div>
                <p className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/70"}`}>
                  {product.name}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {product.digitalCapabilities?.length ?? 0} capabilities
                </p>
              </div>
            )}
          />
        </div>

        {/* Right Content */}
        <div className="w-3/4 space-y-6">
          {selectedProduct ? (
            <>
              {/* Product Header */}
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

              {/* Architecture Agent Review Panel */}
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
                          <div>
                            <span className="text-white/40">Components</span>
                            <p className="text-white/80 font-medium">{components.length} found</p>
                          </div>
                          <div>
                            <span className="text-white/40">Patterns</span>
                            <p className="text-white/80 font-medium">{patterns.length} detected</p>
                          </div>
                          <div>
                            <span className="text-white/40">Recommendations</span>
                            <p className="text-white/80 font-medium">{recommendations.length} items</p>
                          </div>
                        </div>
                        {components.length === 0 && patterns.length === 0 && recommendations.length === 0 && (
                          <p className="text-xs text-white/40">Agent output received. Review the architecture analysis below.</p>
                        )}
                      </div>
                    );
                  }}
                  onApprove={() => {}}
                  onReject={() => {}}
                />
              )}

              {/* Value Stream Metrics — product total + capability breakdown */}
              {(selectedProduct.digitalCapabilities ?? []).some((c) => (c.vsmMetrics?.length ?? 0) > 0) && (
                <GlassCard title="Value Stream Metrics">
                  {/* Product-level aggregate summary */}
                  {productVsmRollup && (
                    <div className="mb-4 pb-4 border-b border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium mb-3">
                        Product Total
                      </p>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wide">Process Time</p>
                          <p className="text-xl font-bold text-green-400">{formatDuration(productVsmRollup.pt)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wide">Wait Time</p>
                          <p className="text-xl font-bold text-red-400">{formatDuration(productVsmRollup.wt)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wide">Lead Time</p>
                          <p className="text-xl font-bold text-white/70">{formatDuration(productVsmRollup.lt)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wide">Flow Efficiency</p>
                          <p className={`text-xl font-bold ${productVsmRollup.fe >= 40 ? "text-green-400" : productVsmRollup.fe >= 20 ? "text-amber-400" : "text-red-400"}`}>
                            {productVsmRollup.fe.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Capability-level rows */}
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
                      By Capability
                    </p>
                    {(selectedProduct.digitalCapabilities ?? [])
                      .filter((c) => (c.vsmMetrics?.length ?? 0) > 0)
                      .map((cap) => {
                        const m = cap.vsmMetrics![0];
                        return (
                          <div key={cap.id} className="glass-panel-sm rounded-xl p-4">
                            <p className="text-sm font-medium text-white/80 mb-3">{cap.name}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-wide">Process Time</p>
                                <p className="text-lg font-bold text-green-400">{m.processTime.toFixed(1)}h</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-wide">Wait Time</p>
                                <p className="text-lg font-bold text-red-400">{m.waitTime.toFixed(1)}h</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-wide">Lead Time</p>
                                <p className="text-lg font-bold text-white/70">{m.leadTime.toFixed(1)}h</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-wide">Flow Efficiency</p>
                                <p className={`text-lg font-bold ${m.flowEfficiency >= 40 ? "text-green-400" : m.flowEfficiency >= 20 ? "text-amber-400" : "text-red-400"}`}>
                                  {m.flowEfficiency.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </GlassCard>
              )}

              {/* Capabilities & Functionalities — Editable Collapsible Tree */}
              <GlassCard
                title={`Capabilities & Functionalities (${totalCapabilities} capabilities, ${totalFunctionalities} functionalities)`}
              >
                <div className="space-y-2">
                  {(selectedProduct.digitalCapabilities ?? []).map((cap) => (
                    <CollapsibleSection
                      key={cap.id}
                      title={
                        <InlineEditText
                          value={cap.name}
                          displayClassName="text-sm font-semibold text-white/85"
                          onSave={async (val) => {
                            await fetch(`/api/digital-capabilities/${cap.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: val }),
                            });
                            await refetchProducts();
                          }}
                        />
                      }
                      badge={
                        <div className="flex items-center gap-2">
                          {cap.category && <GlassBadge variant="info">{cap.category}</GlassBadge>}
                          <GlassBadge variant="default">{cap.functionalities?.length ?? 0} funcs</GlassBadge>
                        </div>
                      }
                      defaultOpen={false}
                    >
                      {/* Editable description */}
                      <div className="mb-3">
                        <InlineEditText
                          value={cap.description ?? ""}
                          placeholder="Add capability description…"
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
                      <div className="space-y-2">
                        {(cap.functionalities ?? []).map((func) => {
                          const descText = formatFuncDesc(func.description);
                          const timing = parseFunctionalityTiming(func.description);
                          const clsColor =
                            timing?.classification === "value-adding"
                              ? "text-green-400"
                              : timing?.classification === "bottleneck"
                              ? "text-amber-400"
                              : timing?.classification === "waste"
                              ? "text-red-400"
                              : "text-white/30";
                          return (
                            <div key={func.id} className="glass-panel-sm p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                                  <InlineEditText
                                    value={func.name}
                                    displayClassName="text-xs font-medium text-white/70"
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
                              {/* Show timing if JSON, else show editable plain text */}
                              {timing ? (
                                <p className={`text-xs ml-4 ${clsColor}`}>{descText}</p>
                              ) : (
                                <div className="ml-4">
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
                        {(cap.functionalities ?? []).length === 0 && (
                          <p className="text-xs text-white/30 italic">No functionalities</p>
                        )}

                        {/* Add functionality inline */}
                        {addingFuncForCapId === cap.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              autoFocus
                              value={newFuncName}
                              onChange={(e) => setNewFuncName(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter" && newFuncName.trim()) {
                                  await fetch("/api/functionalities", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ name: newFuncName.trim(), digitalCapabilityId: cap.id }),
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
                                  body: JSON.stringify({ name: newFuncName.trim(), digitalCapabilityId: cap.id }),
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
                            onClick={() => { setAddingFuncForCapId(cap.id); setNewFuncName(""); }}
                            className="text-xs text-blue-400/60 hover:text-blue-400 flex items-center gap-1 mt-1 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add functionality
                          </button>
                        )}
                      </div>
                    </CollapsibleSection>
                  ))}
                  {(selectedProduct.digitalCapabilities ?? []).length === 0 && (
                    <p className="text-sm text-white/30 italic">No capabilities discovered yet</p>
                  )}
                </div>
              </GlassCard>

              {/* Architecture Views */}
              <GlassCard title="Architecture Views">
                <ArchitectureDiagramPanel
                  repositoryId={repositoryId}
                  organizationId={currentOrg?.id}
                  mode="current"
                  productName={selectedProduct.name}
                  capabilities={selectedProduct.digitalCapabilities ?? []}
                  onRunAgent={handleRunArchAgent}
                  agentLoading={archAgentLoading}
                />
              </GlassCard>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-white/30">
              <p>Select a product from the sidebar to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
