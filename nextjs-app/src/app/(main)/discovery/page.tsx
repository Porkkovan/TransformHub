"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassSelect from "@/components/ui/GlassSelect";
import GlassInput from "@/components/ui/GlassInput";
import GlassButton from "@/components/ui/GlassButton";
import StatusIndicator from "@/components/ui/StatusIndicator";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import DiscoveryInputPanel, { DiscoveryInputData } from "@/components/discovery/DiscoveryInputPanel";
import MultiPassPanel, { PassStatus, PassResult } from "@/components/discovery/MultiPassPanel";
import HierarchyDrillDown from "@/components/discovery/HierarchyDrillDown";
import EditableHierarchyItem from "@/components/discovery/EditableHierarchyItem";
import PersonaFunctionalityMatrix from "@/components/discovery/PersonaFunctionalityMatrix";
import ProductCatalogView from "@/components/discovery/ProductCatalogView";
import BusinessSegmentSelector from "@/components/shared/BusinessSegmentSelector";
import AgentOutputReviewPanel from "@/components/shared/AgentOutputReviewPanel";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useBmadHierarchy } from "@/hooks/useBmadHierarchy";
import { useOrganization } from "@/contexts/OrganizationContext";
import { computeCapabilityRollup } from "@/lib/vsm-hierarchy";
import ExportDropdown from "@/components/ui/ExportDropdown";

export default function DiscoveryPage() {
  const router = useRouter();
  const { execution, loading, execute } = useAgentExecution();
  const { currentOrg } = useOrganization();
  const { repositories, refetch } = useBmadHierarchy(currentOrg?.id);

  const [viewMode, setViewMode] = useState<"products" | "drilldown" | "tree" | "catalog">("products");
  const [drilldownProductId, setDrilldownProductId] = useState<string | null>(null);
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({});
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected" | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [showAddNew, setShowAddNew] = useState(false);
  const [addNewType, setAddNewType] = useState<"capability" | "functionality">("capability");
  const [addNewParent, setAddNewParent] = useState("");
  const [addNewName, setAddNewName] = useState("");
  const [addNewDesc, setAddNewDesc] = useState("");

  // ── Multi-pass state ──────────────────────────────────────────────────────
  const [multiPassMode, setMultiPassMode] = useState(false);
  const [currentPassNumber, setCurrentPassNumber] = useState<0 | 1 | 2 | 3>(0);
  const [repositoryIdForPass, setRepositoryIdForPass] = useState<string | null>(null);
  const [pass1Status, setPass1Status] = useState<PassStatus>("pending");
  const [pass2Status, setPass2Status] = useState<PassStatus>("pending");
  const [pass3Status, setPass3Status] = useState<PassStatus>("pending");
  const [pass1Result, setPass1Result] = useState<PassResult | undefined>();
  const [pass2Result, setPass2Result] = useState<PassResult | undefined>();
  const [pass3Result, setPass3Result] = useState<PassResult | undefined>();
  // Stored input for re-use on passes 2 and 3
  const [savedDiscoveryInput, setSavedDiscoveryInput] = useState<DiscoveryInputData | null>(null);
  const [savedRepoId, setSavedRepoId] = useState<string | null>(null);

  const toggleExpand = (id: string) =>
    setTreeExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Build agent input from DiscoveryInputData ─────────────────────────────
  function buildAgentInput(data: DiscoveryInputData, passNumber: number, repoId?: string) {
    return {
      repositories: data.repos.map((r) => ({
        repositoryName: r.name,
        repositoryUrl: r.url,
      })),
      openapi_urls: data.repos
        .filter((r) => r.openapiUrl?.trim())
        .map((r) => r.openapiUrl as string),
      github_token: data.githubToken || undefined,
      db_schema_text: data.dbSchemaText || undefined,
      domain_context: data.domainContext || undefined,
      known_products: data.knownProducts || undefined,
      known_capabilities: data.knownCapabilities || undefined,
      businessSegment: selectedSegment || undefined,
      pass_number: passNumber,
      ...(repoId ? { repository_id: repoId } : {}),
    };
  }

  // ── Main submit handler ───────────────────────────────────────────────────
  const handleDiscoverySubmit = async (data: DiscoveryInputData) => {
    setReviewStatus(null);
    setSavedDiscoveryInput(data);
    const isMulti = data.mode === "multipass";
    setMultiPassMode(isMulti);

    // Create repo records
    let repoId: string | undefined;
    try {
      const createdRepos = [];
      for (const repo of data.repos) {
        const res = await fetch("/api/repositories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: repo.name, url: repo.url, organizationId: currentOrg?.id }),
        });
        if (res.ok) createdRepos.push(await res.json());
      }
      repoId = createdRepos[0]?.id;
    } catch { /* non-fatal */ }

    const passNumber = isMulti ? 1 : 0;
    setCurrentPassNumber(passNumber as 0 | 1);

    if (isMulti) {
      setPass1Status("running");
      setPass2Status("pending");
      setPass3Status("pending");
      setPass1Result(undefined);
      setPass2Result(undefined);
      setPass3Result(undefined);
    }

    await execute(
      "discovery",
      buildAgentInput(data, passNumber, repoId),
      repoId,
      currentOrg?.id,
    );
  };

  // When the current execution completes, update pass state
  const handleExecutionComplete = (output: Record<string, unknown>) => {
    const pass = (output.pass_number as number) ?? currentPassNumber;
    const result: PassResult = {
      products_count: (output.products_count as number) || 0,
      capabilities_count: (output.capabilities_count as number) || 0,
      functionalities_count: (output.functionalities_count as number) || 0,
      active_sources: (output.active_sources as string[]) || ["url_analysis"],
      repository_id: (output.repository_id as string) || undefined,
    };

    if (!repositoryIdForPass && result.repository_id) {
      setRepositoryIdForPass(result.repository_id);
      setSavedRepoId(result.repository_id);
    }

    if (pass === 1) {
      setPass1Result(result);
      setPass1Status("awaiting_review");
    } else if (pass === 2) {
      setPass2Result(result);
      setPass2Status("awaiting_review");
    } else if (pass === 3) {
      setPass3Result(result);
      setPass3Status("approved");
      refetch();
    }
    refetch();
  };

  // ── Multi-pass approval handlers ─────────────────────────────────────────
  const handleApprovePass1 = async () => {
    if (!savedDiscoveryInput) return;
    const repoId = repositoryIdForPass || savedRepoId;
    setPass1Status("approved");
    setPass2Status("running");
    setCurrentPassNumber(2);
    await execute(
      "discovery",
      buildAgentInput(savedDiscoveryInput, 2, repoId || undefined),
      repoId || undefined,
      currentOrg?.id,
    );
  };

  const handleApprovePass2 = async () => {
    if (!savedDiscoveryInput) return;
    const repoId = repositoryIdForPass || savedRepoId;
    setPass2Status("approved");
    setPass3Status("running");
    setCurrentPassNumber(3);
    await execute(
      "discovery",
      buildAgentInput(savedDiscoveryInput, 3, repoId || undefined),
      repoId || undefined,
      currentOrg?.id,
    );
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const allProductsFlat = useMemo(() => {
    type FlatProduct = {
      id: string; name: string; description?: string;
      businessSegment?: string; repositoryName: string;
      capCount: number; funcCount: number;
      pt: number; wt: number; fe: number | null;
      isProcessMap: boolean;
      confidence?: number | null; sources?: string[];
    };
    const prods: FlatProduct[] = [];
    for (const repo of repositories) {
      for (const prod of repo.digitalProducts ?? []) {
        const caps = prod.digitalCapabilities ?? [];
        const funcCount = caps.reduce((s, c) => s + (c.functionalities?.length ?? 0), 0);
        const isProcessMap = caps.some((c) => c.category === "PROCESS_MAP");
        const withVsm = caps.filter((c) => (c.vsmMetrics?.length ?? 0) > 0);
        let pt = 0, wt = 0, fe: number | null = null;
        if (withVsm.length > 0) {
          pt = withVsm.reduce((s, c) => s + c.vsmMetrics![0].processTime, 0);
          wt = withVsm.reduce((s, c) => s + c.vsmMetrics![0].waitTime, 0);
          fe = (pt / (pt + wt || 1)) * 100;
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
          confidence: prod.confidence ?? null,
          sources: prod.sources,
        });
      }
    }
    return prods;
  }, [repositories]);

  const filteredRepositories = useMemo(() => {
    if (!selectedSegment) return repositories;
    return repositories.map((repo) => ({
      ...repo,
      digitalProducts: (repo.digitalProducts ?? []).filter(
        (prod) => prod.businessSegment === selectedSegment
      ),
    })).filter((repo) => (repo.digitalProducts ?? []).length > 0);
  }, [repositories, selectedSegment]);

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

  const allFunctionalities = useMemo(() => {
    const funcs: { id: string; name: string; personaMappings: { personaType: string; personaName: string }[] }[] = [];
    for (const repo of filteredRepositories) {
      for (const prod of repo.digitalProducts ?? []) {
        for (const cap of prod.digitalCapabilities ?? []) {
          for (const func of cap.functionalities ?? []) {
            funcs.push({ id: func.id, name: func.name, personaMappings: func.personaMappings ?? [] });
          }
        }
      }
    }
    return funcs;
  }, [filteredRepositories]);

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
      } else {
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
        setAddNewName(""); setAddNewDesc(""); setAddNewParent(""); setShowAddNew(false);
        refetch();
      }
    } catch { /* silent */ }
  };

  const personas = (currentOrg?.personas as { type: string; name: string; responsibilities: string[] }[]) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
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
        <BusinessSegmentSelector value={selectedSegment} onChange={setSelectedSegment} />
      </div>

      {/* Main layout: input + pipeline stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discovery Input Panel */}
        <GlassCard title="Analyze Repositories">
          <DiscoveryInputPanel onSubmit={handleDiscoverySubmit} disabled={loading} />
          {execution && !multiPassMode && (
            <div className="mt-4 glass-panel-sm p-4">
              <div className="flex items-center gap-2">
                <StatusIndicator
                  status={
                    execution.status === "COMPLETED" ? "completed"
                    : execution.status === "FAILED" ? "failed"
                    : "running"
                  }
                />
                <span className="text-sm text-white/70">{execution.status}</span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Right column: pipeline stats + multi-pass panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Discovery Pipeline Stats */}
          <GlassCard title="Discovery Pipeline">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {[
                { label: "Repos",           count: stats.repos,  color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                { label: "Products",        count: stats.prods,  color: "bg-green-500/20 text-green-400 border-green-500/30" },
                { label: "Capabilities",    count: stats.caps,   color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
                { label: "Functionalities", count: stats.funcs,  color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
                { label: "Groups",          count: stats.groups, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
              ].map((item, i, arr) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`glass-panel-sm px-4 py-3 rounded-xl border ${item.color} text-center min-w-[90px]`}>
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

          {/* Multi-pass panel */}
          {multiPassMode && (
            <GlassCard title="">
              <MultiPassPanel
                pass1Status={pass1Status}
                pass2Status={pass2Status}
                pass3Status={pass3Status}
                pass1Result={pass1Result}
                pass2Result={pass2Result}
                pass3Result={pass3Result}
                onApprovePass1={handleApprovePass1}
                onApprovePass2={handleApprovePass2}
                loading={loading}
              />
            </GlassCard>
          )}
        </div>
      </div>

      {/* HITL Review Panel (single-pass mode only) */}
      {execution && !multiPassMode && (
        <AgentOutputReviewPanel
          execution={execution}
          loading={loading}
          title="Discovery Agent Output Review"
          renderSummary={(output) => {
            const data = output as Record<string, unknown>;
            const sources = (data.active_sources as string[]) || [];
            return (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white/80">Discovery Analysis Results</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {[
                    { label: "Products",        val: data.products_count },
                    { label: "Capabilities",    val: data.capabilities_count },
                    { label: "Functionalities", val: data.functionalities_count },
                    { label: "Persona Mappings",val: data.persona_mappings_count },
                  ].map((s) => s.val != null && (
                    <div key={s.label}>
                      <span className="text-white/40">{s.label}</span>
                      <p className="text-white/80 font-medium">{s.val as number}</p>
                    </div>
                  ))}
                </div>
                {sources.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-white/40">Evidence sources used: </span>
                    <ConfidenceBadge
                      confidence={sources.length >= 3 ? 0.85 : sources.length >= 2 ? 0.65 : 0.4}
                      sources={sources}
                      showSources={true}
                    />
                  </div>
                )}
              </div>
            );
          }}
          onApprove={async () => {
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
            // Extract result for completion handler
            const output = execution?.output as Record<string, unknown>;
            if (output) handleExecutionComplete(output);
            refetch();
          }}
          onReject={() => {}}
          onStatusChange={(status) => setReviewStatus(status)}
        />
      )}

      {/* Pending review placeholder */}
      {execution && execution.status === "COMPLETED" && reviewStatus !== "approved" && !multiPassMode && (
        <div className="glass-panel rounded-2xl p-6 text-center">
          <p className="text-white/40 text-sm">
            {reviewStatus === "rejected"
              ? "Discovery output was rejected. Re-run the agent to try again."
              : "Waiting for review approval before showing results..."}
          </p>
        </div>
      )}

      {/* View mode toggle */}
      {(allProductsFlat.length > 0 || filteredRepositories.length > 0) && (
        <div className="flex gap-2 flex-wrap">
          {(["products", "drilldown", "tree", "catalog"] as const).map((mode) => {
            const labels = {
              products: "Products View",
              drilldown: "Drill-Down View",
              tree: "Tree View",
              catalog: "Product Catalog",
            };
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

      {/* ── Products View ── */}
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
                <div key={prod.id} className="glass-panel rounded-xl p-4 space-y-3 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{prod.name}</p>
                      {prod.description && (
                        <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{prod.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {prod.businessSegment && <GlassBadge variant="info">{prod.businessSegment}</GlassBadge>}
                      {prod.isProcessMap && <GlassBadge variant="warning">Process Map</GlassBadge>}
                    </div>
                  </div>

                  {/* Confidence badge */}
                  {prod.confidence != null && (
                    <ConfidenceBadge confidence={prod.confidence} sources={prod.sources || []} size="xs" />
                  )}

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
                        <p className={`text-xs font-semibold ${prod.fe >= 40 ? "text-green-400" : prod.fe >= 20 ? "text-amber-400" : "text-red-400"}`}>
                          {prod.fe.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-white/30">Flow Eff.</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setDrilldownProductId(prod.id); setViewMode("drilldown"); }}
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

      {/* ── Drill-Down View ── */}
      {viewMode === "drilldown" && (
        <GlassCard title="Hierarchy Explorer">
          <HierarchyDrillDown repositories={filteredRepositories} initialProductId={drilldownProductId ?? undefined} />
        </GlassCard>
      )}

      {/* ── Tree View ── */}
      {viewMode === "tree" && (
        <GlassCard title="BMAD Mapping Tree">
          <div className="space-y-2">
            {filteredRepositories.map((repo) => (
              <div key={repo.id} className="space-y-1">
                <button
                  onClick={() => toggleExpand(`repo-${repo.id}`)}
                  className="flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 w-full text-left"
                >
                  <svg className={`w-3 h-3 text-white/40 transition-transform ${treeExpanded[`repo-${repo.id}`] !== false ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-sm font-medium text-white/90">{repo.name}</span>
                  <GlassBadge variant="default">{repo.language || "Unknown"}</GlassBadge>
                </button>

                {treeExpanded[`repo-${repo.id}`] !== false && (repo.digitalProducts ?? []).map((prod) => {
                  const prodConf = prod.confidence ?? null;
                  const prodSrcs = prod.sources;
                  return (
                    <div key={prod.id} className="ml-6 space-y-1">
                      <EditableHierarchyItem id={prod.id} name={prod.name} description={prod.description} entityType="digital-products" onSaved={refetch}>
                        <button
                          onClick={() => toggleExpand(`prod-${prod.id}`)}
                          className="flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 w-full text-left"
                        >
                          <svg className={`w-3 h-3 text-white/40 transition-transform ${treeExpanded[`prod-${prod.id}`] ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span className="text-sm text-white/70">{prod.name}</span>
                          {prod.businessSegment && <GlassBadge variant="info">{prod.businessSegment}</GlassBadge>}
                          {prodConf != null && <ConfidenceBadge confidence={prodConf} sources={prodSrcs || []} size="xs" showSources={false} />}
                        </button>
                      </EditableHierarchyItem>

                      {treeExpanded[`prod-${prod.id}`] && (prod.digitalCapabilities ?? []).map((cap) => {
                        const capConf = cap.confidence ?? null;
                        const capSrcs = cap.sources;
                        return (
                          <div key={cap.id} className="ml-6 space-y-1">
                            <EditableHierarchyItem id={cap.id} name={cap.name} description={cap.description} category={cap.category} entityType="digital-capabilities" onSaved={refetch}>
                              <button
                                onClick={() => toggleExpand(`cap-${cap.id}`)}
                                className="flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 w-full text-left"
                              >
                                <svg className={`w-3 h-3 text-white/40 transition-transform ${treeExpanded[`cap-${cap.id}`] ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                                <span className="text-xs text-white/60">{cap.name}</span>
                                {cap.category && <GlassBadge variant="info">{cap.category}</GlassBadge>}
                                {capConf != null && <ConfidenceBadge confidence={capConf} sources={capSrcs || []} size="xs" showSources={false} />}
                              </button>
                            </EditableHierarchyItem>

                            {treeExpanded[`cap-${cap.id}`] && (cap.functionalities ?? []).map((func) => {
                              const funcConf = func.confidence ?? null;
                              const funcSrcs = func.sources;
                              return (
                                <EditableHierarchyItem key={func.id} id={func.id} name={func.name} description={func.description} entityType="functionalities" onSaved={refetch}>
                                  <div className="ml-6 flex items-center gap-2 py-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                    <span className="text-xs text-white/50">{func.name}</span>
                                    <span className="text-[10px] text-white/20">{func.sourceFiles?.length ?? 0} files</span>
                                    {funcConf != null && <ConfidenceBadge confidence={funcConf} sources={funcSrcs || []} size="xs" showSources={false} />}
                                  </div>
                                </EditableHierarchyItem>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ── Product Catalog View ── */}
      {viewMode === "catalog" && currentOrg && (
        <ProductCatalogView
          repositories={repositories}
          orgId={currentOrg.id}
          selectedSegment={selectedSegment}
          onSegmentChange={setSelectedSegment}
          businessSegments={currentOrg.businessSegments ?? []}
        />
      )}

      {/* Add New Item */}
      {filteredRepositories.length > 0 && (
        <GlassCard title="Add New Item">
          <div className="space-y-4">
            <button onClick={() => setShowAddNew(!showAddNew)} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              {showAddNew ? "Hide" : "Add New Capability or Functionality"}
            </button>
            {showAddNew && (
              <div className="space-y-3">
                <GlassSelect
                  label="Item Type"
                  value={addNewType}
                  onChange={(e) => { setAddNewType(e.target.value as "capability" | "functionality"); setAddNewParent(""); }}
                  options={[{ value: "capability", label: "Capability" }, { value: "functionality", label: "Functionality" }]}
                />
                <GlassSelect
                  label={addNewType === "capability" ? "Parent Product" : "Parent Capability"}
                  value={addNewParent}
                  onChange={(e) => setAddNewParent(e.target.value)}
                  options={[{ value: "", label: "Select parent..." }, ...(addNewType === "capability" ? productOptions : capabilityOptions)]}
                />
                <GlassInput label="Name" placeholder="Enter name" value={addNewName} onChange={(e) => setAddNewName(e.target.value)} />
                <GlassInput label="Description" placeholder="Enter description" value={addNewDesc} onChange={(e) => setAddNewDesc(e.target.value)} />
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

      {/* Persona Matrix */}
      {personas.length > 0 && allFunctionalities.length > 0 && (
        <GlassCard title="Persona-Functionality Matrix">
          <PersonaFunctionalityMatrix personas={personas} functionalities={allFunctionalities} />
        </GlassCard>
      )}

      {/* Persona Cards */}
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
