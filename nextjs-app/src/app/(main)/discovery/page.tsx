"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassSelect from "@/components/ui/GlassSelect";
import GlassInput from "@/components/ui/GlassInput";
import StatusIndicator from "@/components/ui/StatusIndicator";
import MultiRepoInput, { RepoEntry } from "@/components/discovery/MultiRepoInput";
import HierarchyDrillDown from "@/components/discovery/HierarchyDrillDown";
import EditableHierarchyItem from "@/components/discovery/EditableHierarchyItem";
import PersonaFunctionalityMatrix from "@/components/discovery/PersonaFunctionalityMatrix";
import BusinessSegmentSelector from "@/components/shared/BusinessSegmentSelector";
import AgentOutputReviewPanel from "@/components/shared/AgentOutputReviewPanel";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useBmadHierarchy } from "@/hooks/useBmadHierarchy";
import { useOrganization } from "@/contexts/OrganizationContext";
import { computeCapabilityRollup, parseFunctionalityTiming } from "@/lib/vsm-hierarchy";
import ExportDropdown from "@/components/ui/ExportDropdown";

export default function DiscoveryPage() {
  const router = useRouter();
  const { execution, loading, execute } = useAgentExecution();
  const { currentOrg } = useOrganization();
  const { repositories, refetch } = useBmadHierarchy(currentOrg?.id);
  const [viewMode, setViewMode] = useState<"products" | "drilldown" | "tree">("products");
  const [drilldownProductId, setDrilldownProductId] = useState<string | null>(null);
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({});
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected" | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [showAddNew, setShowAddNew] = useState(false);
  const [addNewType, setAddNewType] = useState<"capability" | "functionality">("capability");
  const [addNewParent, setAddNewParent] = useState("");
  const [addNewName, setAddNewName] = useState("");
  const [addNewDesc, setAddNewDesc] = useState("");

  const toggleExpand = (id: string) => {
    setTreeExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMultiRepoSubmit = async (repos: RepoEntry[]) => {
    setReviewStatus(null);
    try {
      const createdRepos = [];
      for (const repo of repos) {
        const res = await fetch("/api/repositories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: repo.name,
            url: repo.url,
            organizationId: currentOrg?.id,
          }),
        });
        if (res.ok) {
          createdRepos.push(await res.json());
        }
      }
      const repoId = createdRepos[0]?.id;
      await execute(
        "discovery",
        {
          repositories: repos.map((r) => ({
            repositoryName: r.name,
            repositoryUrl: r.url,
          })),
          businessSegment: selectedSegment || undefined,
        },
        repoId,
        currentOrg?.id
      );
    } catch {
      await execute("discovery", {
        repositories: repos.map((r) => ({
          repositoryName: r.name,
          repositoryUrl: r.url,
        })),
        businessSegment: selectedSegment || undefined,
      }, undefined, currentOrg?.id);
    }
  };

  // All products across ALL repos/segments (no filter) — used for the flat Products view
  const allProductsFlat = useMemo(() => {
    type FlatProduct = {
      id: string; name: string; description?: string;
      businessSegment?: string; repositoryName: string;
      capCount: number; funcCount: number;
      pt: number; wt: number; fe: number | null;
      isProcessMap: boolean;
    };
    const prods: FlatProduct[] = [];
    for (const repo of repositories) {
      for (const prod of repo.digitalProducts ?? []) {
        const caps = prod.digitalCapabilities ?? [];
        const funcCount = caps.reduce((s, c) => s + (c.functionalities?.length ?? 0), 0);
        const isProcessMap = caps.some((c) => c.category === "PROCESS_MAP");
        // VSM metrics: from vsmMetrics stored values, or fall back to functionality timing
        const withVsm = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
        let pt = 0, wt = 0, fe: number | null = null;
        if (withVsm.length > 0) {
          pt = withVsm.reduce((s, c) => s + c.vsmMetrics![0].processTime, 0);
          wt = withVsm.reduce((s, c) => s + c.vsmMetrics![0].waitTime, 0);
          const lt = pt + wt || 1;
          fe = (pt / lt) * 100;
        } else {
          let hasData = false;
          for (const cap of caps) {
            const r = computeCapabilityRollup(cap.functionalities ?? []);
            if (r) { pt += r.pt; wt += r.wt; hasData = true; }
          }
          if (hasData) fe = (pt / (pt + wt || 1)) * 100;
        }
        prods.push({
          id: prod.id, name: prod.name, description: prod.description,
          businessSegment: prod.businessSegment ?? undefined,
          repositoryName: repo.name,
          capCount: caps.length, funcCount, pt, wt, fe, isProcessMap,
        });
      }
    }
    return prods;
  }, [repositories]);

  // Segment-filtered repositories — used for drill-down and tree views
  const filteredRepositories = useMemo(() => {
    if (!selectedSegment) return repositories;
    return repositories.map((repo) => ({
      ...repo,
      digitalProducts: (repo.digitalProducts ?? []).filter(
        (prod) => prod.businessSegment === selectedSegment
      ),
    })).filter((repo) => (repo.digitalProducts ?? []).length > 0);
  }, [repositories, selectedSegment]);

  // Compute counts for the relationship flow stats bar
  const stats = useMemo(() => {
    let prodCount = 0, capCount = 0, funcCount = 0, groupCount = 0;
    for (const repo of filteredRepositories) {
      for (const prod of repo.digitalProducts ?? []) {
        prodCount++;
        groupCount += (prod.productGroups ?? []).length;
        for (const cap of prod.digitalCapabilities ?? []) {
          capCount++;
          funcCount += (cap.functionalities ?? []).length;
        }
      }
    }
    return { repos: filteredRepositories.length, prods: prodCount, caps: capCount, funcs: funcCount, groups: groupCount };
  }, [filteredRepositories]);

  // Flatten functionalities with persona mappings for matrix
  const allFunctionalities = useMemo(() => {
    const funcs: { id: string; name: string; personaMappings: { personaType: string; personaName: string }[] }[] = [];
    for (const repo of filteredRepositories) {
      for (const prod of repo.digitalProducts ?? []) {
        for (const cap of prod.digitalCapabilities ?? []) {
          for (const func of cap.functionalities ?? []) {
            funcs.push({
              id: func.id,
              name: func.name,
              personaMappings: func.personaMappings ?? [],
            });
          }
        }
      }
    }
    return funcs;
  }, [filteredRepositories]);

  // Collect parent options for adding new items
  const productOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const repo of repositories) {
      for (const prod of repo.digitalProducts ?? []) {
        opts.push({ value: prod.id, label: prod.name });
      }
    }
    return opts;
  }, [repositories]);

  const capabilityOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const repo of repositories) {
      for (const prod of repo.digitalProducts ?? []) {
        for (const cap of prod.digitalCapabilities ?? []) {
          opts.push({ value: cap.id, label: `${prod.name} > ${cap.name}` });
        }
      }
    }
    return opts;
  }, [repositories]);

  const handleAddNewItem = async () => {
    if (!addNewName.trim()) return;
    try {
      let endpoint = "";
      const body: Record<string, string> = { name: addNewName, description: addNewDesc };

      if (addNewType === "capability") {
        endpoint = "/api/digital-capabilities";
        body.digitalProductId = addNewParent;
      } else if (addNewType === "functionality") {
        endpoint = "/api/functionalities";
        body.digitalCapabilityId = addNewParent;
      }

      if (!endpoint) return;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setAddNewName("");
        setAddNewDesc("");
        setAddNewParent("");
        setShowAddNew(false);
        refetch();
      }
    } catch {
      // Error handling
    }
  };

  const personas = (currentOrg?.personas as { type: string; name: string; responsibilities: string[] }[]) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Discovery</h1>
          <p className="text-white/50 mt-1">Analyze repositories and discover business functionalities</p>
        </div>
        <ExportDropdown
          endpoint="/api/export/discovery"
          params={{ orgId: currentOrg?.id, segment: selectedSegment || undefined }}
          label="Export"
          disabled={!currentOrg?.id}
        />
      </div>

      {/* Segment Filter */}
      <div className="max-w-xs">
        <BusinessSegmentSelector
          value={selectedSegment}
          onChange={setSelectedSegment}
        />
      </div>

      {/* Analyze Repositories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard title="Analyze Repositories">
          <MultiRepoInput onSubmit={handleMultiRepoSubmit} disabled={loading} />
          {execution && (
            <div className="mt-4 glass-panel-sm p-4">
              <div className="flex items-center gap-2">
                <StatusIndicator status={execution.status === "COMPLETED" ? "completed" : execution.status === "FAILED" ? "failed" : "running"} />
                <span className="text-sm text-white/70">{execution.status}</span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Relationship Flow Stats Bar */}
        <div className="lg:col-span-2">
          <GlassCard title="Discovery Pipeline">
            <div className="flex items-center justify-between gap-2">
              {[
                { label: "Repos", count: stats.repos, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                { label: "Products", count: stats.prods, color: "bg-green-500/20 text-green-400 border-green-500/30" },
                { label: "Capabilities", count: stats.caps, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
                { label: "Functionalities", count: stats.funcs, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
                { label: "Groups", count: stats.groups, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
              ].map((item, i, arr) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`glass-panel-sm px-4 py-3 rounded-xl border ${item.color} text-center min-w-[100px]`}>
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-xs opacity-70">{item.label}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <svg className="w-5 h-5 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* HITL Review Panel */}
      {execution && (
        <AgentOutputReviewPanel
          execution={execution}
          loading={loading}
          title="Discovery Agent Output Review"
          renderSummary={(output) => {
            const data = output as Record<string, unknown>;
            const repos = Array.isArray(data.repositories) ? data.repositories : [];
            const products = Array.isArray(data.products) ? data.products : [];
            return (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Discovery Analysis Results</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-white/40">Repositories</span>
                    <p className="text-white/80 font-medium">{repos.length || "—"} analyzed</p>
                  </div>
                  {products.length > 0 && (
                    <div>
                      <span className="text-white/40">Products</span>
                      <p className="text-white/80 font-medium">{products.length} discovered</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }}
          onApprove={async () => {
            // Auto-tag newly created products with the selected segment
            if (selectedSegment) {
              const productsToUpdate = repositories.flatMap((repo) =>
                (repo.digitalProducts ?? []).filter((prod) => !prod.businessSegment)
              );
              await Promise.all(
                productsToUpdate.map((prod) =>
                  fetch(`/api/digital-products/${prod.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ businessSegment: selectedSegment }),
                  })
                )
              );
            }
            refetch();
          }}
          onReject={() => {}}
          onStatusChange={(status) => setReviewStatus(status)}
        />
      )}

      {/* Pending review placeholder when execution exists but not yet approved */}
      {execution && execution.status === "COMPLETED" && reviewStatus !== "approved" && (
        <div className="glass-panel rounded-2xl p-6 text-center">
          <p className="text-white/40 text-sm">
            {reviewStatus === "rejected"
              ? "Discovery output was rejected. Re-run the agent to try again."
              : "Waiting for review approval before showing results..."}
          </p>
        </div>
      )}

      {/* View Mode Toggle */}
      {(allProductsFlat.length > 0 || filteredRepositories.length > 0) && (
        <div className="flex gap-2">
          {(["products", "drilldown", "tree"] as const).map((mode) => {
            const labels = { products: "Products View", drilldown: "Drill-Down View", tree: "Tree View" };
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === mode
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Products View (default) — flat card grid across ALL repos/segments ── */}
      {viewMode === "products" && (
        <div className="space-y-4">
          {allProductsFlat.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <svg className="w-10 h-10 text-white/15 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-white/40 text-sm">No digital products yet.</p>
              <p className="text-white/25 text-xs mt-1">Run the Discovery agent to analyse URLs, or import a Process Map.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {allProductsFlat.map((prod) => (
                <div
                  key={prod.id}
                  className="glass-panel rounded-xl p-4 space-y-3 border border-white/5 hover:border-white/10 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{prod.name}</p>
                      {prod.description && (
                        <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{prod.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {prod.businessSegment && (
                        <GlassBadge variant="info">{prod.businessSegment}</GlassBadge>
                      )}
                      {prod.isProcessMap && (
                        <GlassBadge variant="warning">Process Map</GlassBadge>
                      )}
                    </div>
                  </div>

                  {/* Counts */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="glass-panel-sm rounded-lg p-2 text-center">
                      <p className="text-sm font-semibold text-white/80">{prod.capCount}</p>
                      <p className="text-[10px] text-white/40">Capabilities</p>
                    </div>
                    <div className="glass-panel-sm rounded-lg p-2 text-center">
                      <p className="text-sm font-semibold text-white/80">{prod.funcCount}</p>
                      <p className="text-[10px] text-white/40">Functionalities</p>
                    </div>
                  </div>

                  {/* VSM metrics (if available) */}
                  {prod.fe !== null && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="glass-panel-sm rounded-lg p-2">
                        <p className="text-xs font-semibold text-green-400">{prod.pt.toFixed(1)}h</p>
                        <p className="text-[10px] text-white/30">Process Time</p>
                      </div>
                      <div className="glass-panel-sm rounded-lg p-2">
                        <p className="text-xs font-semibold text-red-400">{prod.wt.toFixed(1)}h</p>
                        <p className="text-[10px] text-white/30">Wait Time</p>
                      </div>
                      <div className="glass-panel-sm rounded-lg p-2">
                        <p className={`text-xs font-semibold ${
                          prod.fe >= 40 ? "text-green-400" : prod.fe >= 20 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {prod.fe.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-white/30">Flow Eff.</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setDrilldownProductId(prod.id);
                        setViewMode("drilldown");
                      }}
                      className="flex-1 text-xs text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 rounded-lg py-1.5 transition-colors"
                    >
                      Explore hierarchy →
                    </button>
                    <button
                      onClick={() => router.push(`/vsm?productId=${prod.id}`)}
                      className="flex-1 text-xs text-cyan-400/70 hover:text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg py-1.5 transition-colors"
                    >
                      View in VSM
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interactive Hierarchy Drill-Down */}
      {viewMode === "drilldown" && (
        <GlassCard title="Hierarchy Explorer">
          <HierarchyDrillDown repositories={filteredRepositories} initialProductId={drilldownProductId ?? undefined} />
        </GlassCard>
      )}

      {/* BMAD Tree View — Repo → Products → Capabilities → Functionalities */}
      {viewMode === "tree" && (
        <GlassCard title="BMAD Mapping Tree">
          <div className="space-y-2">
            {filteredRepositories.map((repo) => (
              <div key={repo.id} className="space-y-1">
                <button
                  onClick={() => toggleExpand(`repo-${repo.id}`)}
                  className="flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 w-full text-left"
                >
                  <svg
                    className={`w-3 h-3 text-white/40 transition-transform ${treeExpanded[`repo-${repo.id}`] !== false ? "rotate-90" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-sm font-medium text-white/90">{repo.name}</span>
                  <GlassBadge variant="default">{repo.language || "Unknown"}</GlassBadge>
                </button>

                {treeExpanded[`repo-${repo.id}`] !== false && (repo.digitalProducts ?? []).map((prod) => (
                  <div key={prod.id} className="ml-6 space-y-1">
                    <EditableHierarchyItem id={prod.id} name={prod.name} description={prod.description} entityType="digital-products" onSaved={refetch}>
                      <button
                        onClick={() => toggleExpand(`prod-${prod.id}`)}
                        className="flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 w-full text-left"
                      >
                        <svg
                          className={`w-3 h-3 text-white/40 transition-transform ${treeExpanded[`prod-${prod.id}`] ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-sm text-white/70">{prod.name}</span>
                        {prod.businessSegment && (
                          <GlassBadge variant="info">{prod.businessSegment}</GlassBadge>
                        )}
                      </button>
                    </EditableHierarchyItem>

                    {treeExpanded[`prod-${prod.id}`] && (prod.digitalCapabilities ?? []).map((cap) => (
                      <div key={cap.id} className="ml-6 space-y-1">
                        <EditableHierarchyItem id={cap.id} name={cap.name} description={cap.description} category={cap.category} entityType="digital-capabilities" onSaved={refetch}>
                          <button
                            onClick={() => toggleExpand(`cap-${cap.id}`)}
                            className="flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 w-full text-left"
                          >
                            <svg
                              className={`w-3 h-3 text-white/40 transition-transform ${treeExpanded[`cap-${cap.id}`] ? "rotate-90" : ""}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span className="text-xs text-white/60">{cap.name}</span>
                            {cap.category && <GlassBadge variant="info">{cap.category}</GlassBadge>}
                          </button>
                        </EditableHierarchyItem>

                        {treeExpanded[`cap-${cap.id}`] && (cap.functionalities ?? []).map((func) => (
                          <EditableHierarchyItem key={func.id} id={func.id} name={func.name} description={func.description} entityType="functionalities" onSaved={refetch}>
                            <div className="ml-6 flex items-center gap-2 py-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              <span className="text-xs text-white/50">{func.name}</span>
                              <span className="text-[10px] text-white/20">{func.sourceFiles?.length ?? 0} files</span>
                            </div>
                          </EditableHierarchyItem>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Add New Item Section */}
      {filteredRepositories.length > 0 && (
        <GlassCard title="Add New Item">
          <div className="space-y-4">
            <button
              onClick={() => setShowAddNew(!showAddNew)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showAddNew ? "Hide" : "Add New Capability or Functionality"}
            </button>
            {showAddNew && (
              <div className="space-y-3">
                <GlassSelect
                  label="Item Type"
                  value={addNewType}
                  onChange={(e) => {
                    setAddNewType(e.target.value as "capability" | "functionality");
                    setAddNewParent("");
                  }}
                  options={[
                    { value: "capability", label: "Capability" },
                    { value: "functionality", label: "Functionality" },
                  ]}
                />
                <GlassSelect
                  label={addNewType === "capability" ? "Parent Product" : "Parent Capability"}
                  value={addNewParent}
                  onChange={(e) => setAddNewParent(e.target.value)}
                  options={[
                    { value: "", label: "Select parent..." },
                    ...(addNewType === "capability" ? productOptions : capabilityOptions),
                  ]}
                />
                <GlassInput
                  label="Name"
                  placeholder="Enter name"
                  value={addNewName}
                  onChange={(e) => setAddNewName(e.target.value)}
                />
                <GlassInput
                  label="Description"
                  placeholder="Enter description"
                  value={addNewDesc}
                  onChange={(e) => setAddNewDesc(e.target.value)}
                />
                <GlassButton onClick={handleAddNewItem} disabled={!addNewName.trim() || !addNewParent}>
                  Add {addNewType === "capability" ? "Capability" : "Functionality"}
                </GlassButton>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Proceed to VSM */}
      {reviewStatus === "approved" && (
        <div className="flex justify-end">
          <GlassButton variant="success" onClick={() => router.push("/vsm")}>
            Proceed to Value Stream
          </GlassButton>
        </div>
      )}

      {/* Persona-to-Functionality Matrix */}
      {personas.length > 0 && allFunctionalities.length > 0 && (
        <GlassCard title="Persona-Functionality Matrix">
          <PersonaFunctionalityMatrix
            personas={personas}
            functionalities={allFunctionalities}
          />
        </GlassCard>
      )}

      {/* Persona Assignment Cards */}
      {personas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {personas.map((persona) => (
            <GlassCard key={persona.type} title={persona.name}>
              <GlassBadge variant={persona.type === "FRONT_OFFICE" ? "info" : persona.type === "MIDDLE_OFFICE" ? "warning" : "success"}>
                {persona.type.replace("_", " ")}
              </GlassBadge>
              <ul className="mt-3 space-y-2">
                {persona.responsibilities.map((r, i) => (
                  <li key={i} className="text-sm text-white/60 flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-white/30" />
                    {r}
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
