"use client";

import { useState, useMemo, useEffect } from "react";
import GlassButton from "@/components/ui/GlassButton";
import ModuleAccuracyBadge from "@/components/ui/ModuleAccuracyBadge";
import GlassCard from "@/components/ui/GlassCard";
import GlassSelect from "@/components/ui/GlassSelect";
import GlassBadge from "@/components/ui/GlassBadge";
import EntityListSidebar from "@/components/ui/EntityListSidebar";
import RoadmapTimeline from "@/components/product-roadmap/RoadmapTimeline";
import RoadmapSummaryPanel from "@/components/product-roadmap/RoadmapSummaryPanel";
import AddCapabilityModal from "@/components/product-roadmap/AddCapabilityModal";
import BusinessSegmentSelector from "@/components/shared/BusinessSegmentSelector";
import AgentOutputReviewPanel from "@/components/shared/AgentOutputReviewPanel";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useProductRoadmap } from "@/hooks/useProductRoadmap";
import { useDigitalProducts, DigitalProduct } from "@/hooks/useDigitalProducts";
import { useOrganization } from "@/contexts/OrganizationContext";
import ExportDropdown from "@/components/ui/ExportDropdown";

type RoadmapTab = "capabilities" | "functionalities";
type StrategyTab = "modernization" | "agentification";

const STRATEGY_CATEGORIES: Record<StrategyTab, string[]> = {
  modernization: ["RPA_AUTOMATION", "AI_ML_INTEGRATION", "ADVANCED_ANALYTICS"],
  agentification: ["AGENT_BASED", "CONVERSATIONAL_AI"],
};

const STRATEGY_META: Record<StrategyTab, { label: string; color: string; description: string }> = {
  modernization: {
    label: "Modernization",
    color: "text-blue-300 border-blue-500/30 bg-blue-500/15",
    description: "RPA automation, AI/ML integration & advanced analytics capabilities",
  },
  agentification: {
    label: "Agentification",
    color: "text-purple-300 border-purple-500/30 bg-purple-500/15",
    description: "Autonomous agent-based & conversational AI capabilities",
  },
};

export default function ProductRoadmapPage() {
  const { currentOrg } = useOrganization();

  // Segment + product selection
  const [selectedSegment, setSelectedSegment] = useState("");
  const { products } = useDigitalProducts(currentOrg?.id, selectedSegment || undefined);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [strategyTab, setStrategyTab] = useState<StrategyTab>("modernization");
  const [activeTab, setActiveTab] = useState<RoadmapTab>("capabilities");

  // Fetch roadmap items scoped to selected product + tab
  const itemType = activeTab === "capabilities" ? "capability" : "functionality";
  const {
    items,
    loading,
    error,
    actionLoading,
    addItem,
    updateItem,
    approveItem,
    rejectItem,
    generateRoadmap,
  } = useProductRoadmap(
    currentOrg?.id,
    selectedProductId || undefined,
    selectedProductId ? itemType : undefined
  );

  const { execute: executeGenerate, execution: generateExecution, loading: generateAgentLoading } = useAgentExecution();
  const [generateReviewStatus, setGenerateReviewStatus] = useState<"pending_review" | "approved" | "rejected" | null>(null);

  const handleGenerateFromFutureState = async () => {
    setGenerateReviewStatus(null);
    await executeGenerate("product_transformation", { action: "generate_roadmap", organizationId: currentOrg?.id });
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterApproval, setFilterApproval] = useState("");
  const [filterQuarter, setFilterQuarter] = useState("");

  // Reset product when segment changes
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

  // Items for the active strategy tab (filter by category group)
  const strategyItems = useMemo(() => {
    const allowedCats = STRATEGY_CATEGORIES[strategyTab];
    // Show all items if none match strategy categories (e.g. older data without categories)
    const matched = items.filter((item) => allowedCats.includes(item.category));
    return matched.length > 0 ? matched : items;
  }, [items, strategyTab]);

  // Apply additional filters on top of strategy filter
  const filteredItems = useMemo(() => {
    return strategyItems.filter((item) => {
      if (filterStatus && item.status !== filterStatus) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterApproval && item.approvalStatus !== filterApproval) return false;
      if (filterQuarter && item.quarter !== filterQuarter) return false;
      return true;
    });
  }, [strategyItems, filterStatus, filterCategory, filterApproval, filterQuarter]);

  // Category options scoped to the active strategy
  const categoryOptions = useMemo(() => {
    const allowedCats = STRATEGY_CATEGORIES[strategyTab];
    const cats = [...new Set(strategyItems.map((i) => i.category))].filter((c) =>
      allowedCats.includes(c)
    );
    return cats.map((c) => ({
      value: c,
      label: c.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" "),
    }));
  }, [strategyItems, strategyTab]);

  const handleApprove = (id: string) => approveItem(id);
  const handleReject = (id: string) => rejectItem(id);
  const handleStatusChange = (id: string, status: string) => updateItem(id, { status });
  const handleEdit = (id: string, updates: { capabilityName?: string; description?: string; quarter?: string }) =>
    updateItem(id, updates);

  const handleAddItem = (data: Parameters<typeof addItem>[0]) => {
    return addItem({
      ...data,
      digitalProductId: selectedProductId || undefined,
      itemType,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Product Roadmap</h1>
            <ModuleAccuracyBadge moduleKey="productTransformation" />
          </div>
          <p className="text-white/50 mt-1">Product-centric capability and functionality roadmap</p>
        </div>
        <div className="flex items-center gap-3">
          <GlassButton onClick={() => setShowAddModal(true)} disabled={!selectedProductId}>
            Add Item
          </GlassButton>
          <GlassButton
            onClick={handleGenerateFromFutureState}
            disabled={actionLoading || generateAgentLoading || !currentOrg}
            variant="success"
          >
            {actionLoading || generateAgentLoading ? "Generating..." : "Generate from Future State"}
          </GlassButton>
          <ExportDropdown
            endpoint="/api/export/roadmap"
            params={{ orgId: currentOrg?.id, productId: selectedProductId || undefined }}
            label="Export"
            disabled={!currentOrg?.id}
          />
        </div>
      </div>

      {/* Segment Selector */}
      <div className="glass-panel-sm p-3">
        <BusinessSegmentSelector
          value={selectedSegment}
          onChange={handleSegmentChange}
        />
      </div>

      {/* HITL Review Panel for Generate */}
      {generateExecution && (
        <AgentOutputReviewPanel
          execution={generateExecution}
          loading={generateAgentLoading}
          title="Roadmap Generation Review"
          renderSummary={(output) => {
            const data = output as Record<string, unknown>;
            const generatedItems = Array.isArray(data.items) ? data.items : [];
            const quarters = Array.isArray(data.quarters) ? data.quarters : [];
            return (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Generated Roadmap Items</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-white/40">Items Generated</span>
                    <p className="text-white/80 font-medium">{generatedItems.length || items.length} items</p>
                  </div>
                  {quarters.length > 0 && (
                    <div>
                      <span className="text-white/40">Quarters Covered</span>
                      <p className="text-white/80 font-medium">{quarters.join(", ")}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-white/40">Source</span>
                    <p className="text-white/80 font-medium">Future State Vision</p>
                  </div>
                </div>
                {generatedItems.length === 0 && items.length === 0 && (
                  <p className="text-xs text-white/40">Generation complete. Review results below.</p>
                )}
              </div>
            );
          }}
          onApprove={() => {}}
          onReject={() => {}}
          onStatusChange={(status) => {
            setGenerateReviewStatus(status);
            if (status === "approved") {
              generateRoadmap();
            }
          }}
        />
      )}

      {/* Rejection notice */}
      {generateReviewStatus === "rejected" && (
        <div className="glass-panel-sm p-3 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Roadmap generation was rejected. No items were generated. Click &quot;Generate from Future State&quot; to try again.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-panel-sm p-3 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 280px)" }}>
        {/* Left Sidebar - Product List (1/4) */}
        <div className="w-1/4">
          <EntityListSidebar<DigitalProduct>
            title="Products"
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
                  {product.businessSegment || "No segment"}
                </p>
              </div>
            )}
          />
        </div>

        {/* Right Content (3/4) */}
        <div className="w-3/4 space-y-6">
          {selectedProduct ? (
            <>
              {/* Product Header */}
              <div className="glass-panel rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-white">{selectedProduct.name}</h2>
                  <div className="flex items-center gap-2">
                    {selectedProduct.businessSegment && (
                      <GlassBadge variant="info">{selectedProduct.businessSegment}</GlassBadge>
                    )}
                    <GlassBadge variant="default">
                      {selectedProduct.digitalCapabilities?.length ?? 0} capabilities
                    </GlassBadge>
                  </div>
                </div>
                <p className="text-sm text-white/50">{selectedProduct.description}</p>
              </div>

              {/* Strategy tabs — top level */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["modernization", "agentification"] as StrategyTab[]).map((st) => {
                    const meta = STRATEGY_META[st];
                    const count = items.filter((i) =>
                      STRATEGY_CATEGORIES[st].includes(i.category)
                    ).length;
                    return (
                      <button
                        key={st}
                        onClick={() => { setStrategyTab(st); setFilterCategory(""); }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                          strategyTab === st
                            ? meta.color
                            : "text-white/45 border-white/10 bg-white/3 hover:text-white/70 hover:bg-white/8"
                        }`}
                      >
                        {meta.label}
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            strategyTab === st ? "bg-white/20" : "bg-white/10 text-white/40"
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-white/35">{STRATEGY_META[strategyTab].description}</p>

                {/* Sub-tabs: Capabilities / Functionalities */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("capabilities")}
                    className={`px-5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === "capabilities"
                        ? "bg-white/10 text-white border border-white/15"
                        : "text-white/40 hover:text-white/65 hover:bg-white/5"
                    }`}
                  >
                    Capabilities
                  </button>
                  <button
                    onClick={() => setActiveTab("functionalities")}
                    className={`px-5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === "functionalities"
                        ? "bg-white/10 text-white border border-white/15"
                        : "text-white/40 hover:text-white/65 hover:bg-white/5"
                    }`}
                  >
                    Functionalities
                  </button>
                </div>
              </div>

              {/* Summary Panel */}
              <GlassCard title={`${STRATEGY_META[strategyTab].label} — ${activeTab === "capabilities" ? "Capability" : "Functionality"} Roadmap Summary`}>
                <RoadmapSummaryPanel items={strategyItems} />
              </GlassCard>

              {/* Filter Bar */}
              <div className="glass-panel-sm p-3 flex items-end gap-3 flex-wrap">
                <GlassSelect
                  label="Status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  options={[
                    { value: "planned", label: "Planned" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "completed", label: "Completed" },
                    { value: "deferred", label: "Deferred" },
                  ]}
                  placeholder="All Statuses"
                />
                <GlassSelect
                  label="Category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  options={categoryOptions}
                  placeholder="All Categories"
                />
                <GlassSelect
                  label="Approval"
                  value={filterApproval}
                  onChange={(e) => setFilterApproval(e.target.value)}
                  options={[
                    { value: "PENDING", label: "Pending" },
                    { value: "APPROVED", label: "Approved" },
                    { value: "REJECTED", label: "Rejected" },
                  ]}
                  placeholder="All Approvals"
                />
                <GlassSelect
                  label="Quarter"
                  value={filterQuarter}
                  onChange={(e) => setFilterQuarter(e.target.value)}
                  options={[
                    { value: "Q1 2026", label: "Q1 2026" },
                    { value: "Q2 2026", label: "Q2 2026" },
                    { value: "Q3 2026", label: "Q3 2026" },
                    { value: "Q4 2026", label: "Q4 2026" },
                  ]}
                  placeholder="All Quarters"
                />
                {(filterStatus || filterCategory || filterApproval || filterQuarter) && (
                  <GlassButton
                    onClick={() => {
                      setFilterStatus("");
                      setFilterCategory("");
                      setFilterApproval("");
                      setFilterQuarter("");
                    }}
                    className="!text-xs"
                  >
                    Clear Filters
                  </GlassButton>
                )}
              </div>

              {/* Timeline View */}
              {loading ? (
                <div className="flex items-center justify-center h-64 text-white/30">
                  <p>Loading roadmap...</p>
                </div>
              ) : filteredItems.length === 0 && strategyItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-white/30 gap-3">
                  <p>No {STRATEGY_META[strategyTab].label} {activeTab} roadmap items yet</p>
                  <p className="text-xs">Run &quot;Future State Vision&quot; with {STRATEGY_META[strategyTab].label} strategy, then click &quot;Generate from Future State&quot;</p>
                </div>
              ) : (
                <RoadmapTimeline
                  items={filteredItems}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onStatusChange={handleStatusChange}
                  onEdit={handleEdit}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-white/30">
              <p>Select a product from the sidebar to view its roadmap</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <AddCapabilityModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
        itemType={itemType}
      />
    </div>
  );
}
