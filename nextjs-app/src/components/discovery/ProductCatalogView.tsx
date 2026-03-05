"use client";

import React, { useState, useMemo } from "react";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Functionality {
  id: string;
  name: string;
  description?: string;
  sourceFiles: string[];
  personaMappings: { personaType: string; personaName: string }[];
  confidence?: number | null;
  sources?: string[];
}

interface DigitalCapability {
  id: string;
  name: string;
  description?: string;
  category?: string;
  functionalities: Functionality[];
  confidence?: number | null;
  sources?: string[];
}

interface ProductGroup {
  id: string;
  name: string;
  description?: string;
  valueStreamSteps: { id: string; name: string; stepOrder: number; stepType: string }[];
}

interface DigitalProduct {
  id: string;
  name: string;
  description?: string;
  businessSegment?: string | null;
  digitalCapabilities: DigitalCapability[];
  productGroups: ProductGroup[];
  confidence?: number | null;
  sources?: string[];
}

interface Repository {
  id: string;
  name: string;
  url?: string;
  digitalProducts: DigitalProduct[];
}

interface ProductCatalogViewProps {
  repositories: Repository[];
  orgId: string;
  selectedSegment: string;
  onSegmentChange?: (seg: string) => void;
  businessSegments: string[];
}

// ─── Flat catalog row ─────────────────────────────────────────────────────────

interface CatalogRow {
  segment: string;
  appId: string; appName: string;
  productId: string; productName: string; productDesc: string;
  capId: string; capName: string; capCategory: string;
  funcId: string; funcName: string; funcDesc: string; personas: string;
  _segKey: string; _appKey: string; _prodKey: string; _capKey: string;
}

// 6-column grid template: App | Group(L0) | Product(L1) | Cap(L2) | Func(L3) | Desc
const GRID = "grid-cols-[0.9fr_0.8fr_1fr_1fr_1.1fr_1.3fr]";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductCatalogView({
  repositories,
  orgId,
  selectedSegment,
  onSegmentChange,
  businessSegments,
}: ProductCatalogViewProps) {
  // Collapsed semantics: nothing in the set = all expanded
  const [collapsedSegments, setCollapsedSegments] = useState<Set<string>>(new Set());
  const [collapsedApps, setCollapsedApps] = useState<Set<string>>(new Set());
  // Expanded semantics for products/caps: must click to expand
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [tableMode, setTableMode] = useState<"hierarchical" | "flat">("hierarchical");

  // ── Filtered repositories ─────────────────────────────────────────────────
  const filteredRepos = useMemo(() => {
    return repositories
      .filter((repo) => selectedAppIds.size === 0 || selectedAppIds.has(repo.id))
      .map((repo) => ({
        ...repo,
        digitalProducts: repo.digitalProducts.filter(
          (p) => !selectedSegment || p.businessSegment === selectedSegment
        ),
      }))
      .filter((repo) => repo.digitalProducts.length > 0);
  }, [repositories, selectedSegment, selectedAppIds]);

  // ── Available apps for chip selector ─────────────────────────────────────
  const availableApps = useMemo(() => {
    return repositories
      .filter((repo) =>
        repo.digitalProducts.some(
          (p) => !selectedSegment || p.businessSegment === selectedSegment
        )
      )
      .map((repo) => ({
        id: repo.id,
        name: repo.name,
        productCount: repo.digitalProducts.filter(
          (p) => !selectedSegment || p.businessSegment === selectedSegment
        ).length,
      }));
  }, [repositories, selectedSegment]);

  // ── Product Group lookup (productId → comma-separated group names) ────────
  const productGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const repo of filteredRepos) {
      for (const prod of repo.digitalProducts) {
        const names = (prod.productGroups || []).map((pg) => pg.name).join(", ");
        map.set(prod.id, names);
      }
    }
    return map;
  }, [filteredRepos]);

  // ── Confidence lookup maps ────────────────────────────────────────────────
  const confidenceMap = useMemo(() => {
    const products = new Map<string, { confidence?: number | null; sources?: string[] }>();
    const caps = new Map<string, { confidence?: number | null; sources?: string[] }>();
    const funcs = new Map<string, { confidence?: number | null; sources?: string[] }>();
    for (const repo of filteredRepos) {
      for (const prod of repo.digitalProducts) {
        products.set(prod.id, { confidence: prod.confidence, sources: prod.sources });
        for (const cap of prod.digitalCapabilities) {
          caps.set(cap.id, { confidence: cap.confidence, sources: cap.sources });
          for (const func of cap.functionalities) {
            funcs.set(func.id, { confidence: func.confidence, sources: func.sources });
          }
        }
      }
    }
    return { products, caps, funcs };
  }, [filteredRepos]);

  // ── Flat rows for counts and search ──────────────────────────────────────
  const flatRows = useMemo<CatalogRow[]>(() => {
    const rows: CatalogRow[] = [];
    const q = searchQuery.toLowerCase();

    for (const repo of filteredRepos) {
      for (const prod of repo.digitalProducts) {
        const segment = prod.businessSegment || "—";

        if (prod.digitalCapabilities.length === 0) {
          const row: CatalogRow = {
            segment, appId: repo.id, appName: repo.name,
            productId: prod.id, productName: prod.name, productDesc: prod.description || "",
            capId: "", capName: "—", capCategory: "",
            funcId: "", funcName: "—", funcDesc: "", personas: "",
            _segKey: segment, _appKey: repo.id, _prodKey: prod.id, _capKey: "",
          };
          if (!q || matchesQuery(row, q)) rows.push(row);
          continue;
        }

        for (const cap of prod.digitalCapabilities) {
          if (cap.functionalities.length === 0) {
            const row: CatalogRow = {
              segment, appId: repo.id, appName: repo.name,
              productId: prod.id, productName: prod.name, productDesc: prod.description || "",
              capId: cap.id, capName: cap.name, capCategory: cap.category || "",
              funcId: "", funcName: "—", funcDesc: "", personas: "",
              _segKey: segment, _appKey: repo.id, _prodKey: prod.id, _capKey: cap.id,
            };
            if (!q || matchesQuery(row, q)) rows.push(row);
            continue;
          }

          for (const func of cap.functionalities) {
            const personas = func.personaMappings.map((pm) => pm.personaName).join(", ");
            const row: CatalogRow = {
              segment, appId: repo.id, appName: repo.name,
              productId: prod.id, productName: prod.name, productDesc: prod.description || "",
              capId: cap.id, capName: cap.name, capCategory: cap.category || "",
              funcId: func.id, funcName: func.name, funcDesc: func.description || "", personas,
              _segKey: segment, _appKey: repo.id, _prodKey: prod.id, _capKey: cap.id,
            };
            if (!q || matchesQuery(row, q)) rows.push(row);
          }
        }
      }
    }
    return rows;
  }, [filteredRepos, searchQuery]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    products: new Set(flatRows.map((r) => r.productId)).size,
    caps: new Set(flatRows.filter((r) => r.capId).map((r) => r.capId)).size,
    funcs: new Set(flatRows.filter((r) => r.funcId).map((r) => r.funcId)).size,
  }), [flatRows]);

  // ── Grouped structure for rendering ──────────────────────────────────────
  type FuncEntry = { funcId: string; funcName: string; funcDesc: string; personas: string };
  type CapEntry = { capId: string; capName: string; capCategory: string; funcs: FuncEntry[] };
  type ProdEntry = { productId: string; productName: string; productDesc: string; caps: CapEntry[] };
  type AppEntry = { appId: string; appName: string; products: ProdEntry[] };
  type SegEntry = { segment: string; apps: AppEntry[] };

  const grouped = useMemo<SegEntry[]>(() => {
    type CapMeta = { capName: string; capCategory: string; funcs: FuncEntry[] };
    type ProdMeta = { productName: string; productDesc: string; caps: Map<string, CapMeta> };
    type AppMeta = { appName: string; products: Map<string, ProdMeta> };
    type SegMeta = { apps: Map<string, AppMeta> };
    const segMap = new Map<string, SegMeta>();

    for (const r of flatRows) {
      if (!segMap.has(r._segKey)) segMap.set(r._segKey, { apps: new Map() });
      const segData = segMap.get(r._segKey)!;

      if (!segData.apps.has(r._appKey)) segData.apps.set(r._appKey, { appName: r.appName, products: new Map() });
      const appData = segData.apps.get(r._appKey)!;

      if (!appData.products.has(r._prodKey)) appData.products.set(r._prodKey, { productName: r.productName, productDesc: r.productDesc, caps: new Map() });
      const prodData = appData.products.get(r._prodKey)!;

      const capKey = r._capKey || `__nocap_${r._prodKey}`;
      if (!prodData.caps.has(capKey)) prodData.caps.set(capKey, { capName: r.capName, capCategory: r.capCategory, funcs: [] });
      if (r.funcId) prodData.caps.get(capKey)!.funcs.push({ funcId: r.funcId, funcName: r.funcName, funcDesc: r.funcDesc, personas: r.personas });
    }

    return [...segMap.entries()].map(([seg, segData]) => ({
      segment: seg,
      apps: [...segData.apps.entries()].map(([appId, appData]) => ({
        appId, appName: appData.appName,
        products: [...appData.products.entries()].map(([prodId, prodData]) => ({
          productId: prodId, productName: prodData.productName, productDesc: prodData.productDesc,
          caps: [...prodData.caps.entries()].map(([capId, capData]) => ({
            capId, capName: capData.capName, capCategory: capData.capCategory, funcs: capData.funcs,
          })),
        })),
      })),
    }));
  }, [flatRows]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  function toggleSet(s: Set<string>, key: string) {
    const next = new Set(s);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  }

  function toggleApp(id: string) { setSelectedAppIds((p) => toggleSet(p, id)); }
  function toggleSeg(key: string) { setCollapsedSegments((p) => toggleSet(p, key)); }
  function toggleApp2(key: string) { setCollapsedApps((p) => toggleSet(p, key)); }
  function toggleProd(key: string) { setExpandedProducts((p) => toggleSet(p, key)); }
  function toggleCap(key: string) { setExpandedCaps((p) => toggleSet(p, key)); }

  function expandAll() {
    setCollapsedSegments(new Set());
    setCollapsedApps(new Set());
    const prods = new Set<string>();
    const caps = new Set<string>();
    for (const r of flatRows) { prods.add(r._prodKey); if (r._capKey) caps.add(r._capKey); }
    setExpandedProducts(prods);
    setExpandedCaps(caps);
  }

  function collapseAll() {
    const segs = new Set(grouped.map((s) => s.segment));
    const apps = new Set(grouped.flatMap((s) => s.apps.map((a) => a.appId)));
    setCollapsedSegments(segs);
    setCollapsedApps(apps);
    setExpandedProducts(new Set());
    setExpandedCaps(new Set());
  }

  // ── Download ──────────────────────────────────────────────────────────────
  async function handleDownload() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ orgId });
      if (selectedSegment) params.set("segment", selectedSegment);
      if (selectedAppIds.size > 0) params.set("appIds", [...selectedAppIds].join(","));
      const res = await fetch(`/api/export/product-catalog?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `product-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (repositories.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-10 text-center">
        <p className="text-white/40 text-sm">No digital products yet.</p>
        <p className="text-white/25 text-xs mt-1">Run the Discovery agent to analyse URLs first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Filter bar ── */}
      <div className="glass-panel p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px] max-w-xs">
            <label className="block text-xs text-white/50 mb-1.5">Business Segment</label>
            <select
              value={selectedSegment}
              onChange={(e) => onSegmentChange?.(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40"
            >
              <option value="" className="bg-gray-900">All Segments</option>
              {businessSegments.map((s) => (
                <option key={s} value={s} className="bg-gray-900">{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-white/50 mb-1.5">Search</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter products, capabilities, functionalities…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading || flatRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 transition-all text-sm font-medium whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? "Exporting…" : "Download XLSX"}
          </button>
        </div>

        {availableApps.length > 0 && (
          <div>
            <p className="text-xs text-white/40 mb-2">
              Applications
              {selectedAppIds.size > 0 && (
                <button onClick={() => setSelectedAppIds(new Set())} className="ml-2 text-blue-400/70 hover:text-blue-400">
                  Clear
                </button>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {availableApps.map((app) => {
                const active = selectedAppIds.has(app.id);
                return (
                  <button
                    key={app.id}
                    onClick={() => toggleApp(app.id)}
                    className={`px-3 py-1 rounded-full text-xs border transition-all ${
                      active
                        ? "bg-blue-500/25 text-blue-300 border-blue-500/40"
                        : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {app.name}
                    <span className="ml-1.5 opacity-60">{app.productCount}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Products (L1)", value: counts.products, color: "text-green-400" },
          { label: "Capabilities (L2)", value: counts.caps, color: "text-cyan-400" },
          { label: "Functionalities (L3)", value: counts.funcs, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="glass-panel-sm px-4 py-2 rounded-xl flex items-center gap-2">
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-white/40">{s.label}</span>
          </div>
        ))}
        <div className="flex-1" />
        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-0.5 glass-panel-sm rounded-lg">
          {(["hierarchical", "flat"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTableMode(m)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                tableMode === m
                  ? "bg-blue-500/25 text-blue-300"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {m === "hierarchical" ? "Tree" : "Flat Table"}
            </button>
          ))}
        </div>
        {tableMode === "hierarchical" && (
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="text-xs text-white/40 hover:text-white/70 transition-colors">Expand All</button>
            <span className="text-white/20">|</span>
            <button onClick={collapseAll} className="text-xs text-white/40 hover:text-white/70 transition-colors">Collapse All</button>
          </div>
        )}
      </div>

      {/* ── Flat Table View ── */}
      {tableMode === "flat" && (
        flatRows.length === 0 ? (
          <div className="glass-panel p-10 text-center border border-dashed border-white/10">
            <p className="text-white/40 text-sm">
              {searchQuery ? "No results match your search." : "No products in the selected segment / application."}
            </p>
          </div>
        ) : (
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    {["Segment", "Application", "Product Group (L0)", "Product (L1)", "Capability (L2)", "Functionality (L3)", "Personas"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-white/70 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {flatRows.map((r, i) => {
                    const groups = productGroupMap.get(r.productId) || "—";
                    return (
                      <tr key={i} className={`hover:bg-white/3 transition-colors ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                        <td className="px-3 py-1.5 text-blue-300/70 whitespace-nowrap">{r.segment}</td>
                        <td className="px-3 py-1.5 text-white/60 whitespace-nowrap">{r.appName}</td>
                        <td className="px-3 py-1.5 text-amber-400/70">{groups}</td>
                        <td className="px-3 py-1.5 text-green-400/80 font-medium whitespace-nowrap">{r.productName}</td>
                        <td className="px-3 py-1.5 text-cyan-400/70 whitespace-nowrap">{r.capName !== "—" ? r.capName : <span className="text-white/20">—</span>}</td>
                        <td className="px-3 py-1.5 text-purple-400/70">{r.funcName !== "—" ? r.funcName : <span className="text-white/20">—</span>}</td>
                        <td className="px-3 py-1.5 text-amber-400/50">{r.personas || <span className="text-white/20">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-white/5 text-[10px] text-white/25">
              {flatRows.length} rows
            </div>
          </div>
        )
      )}

      {/* ── Hierarchical Catalog Table ── */}
      {tableMode === "hierarchical" && (flatRows.length === 0 ? (
        <div className="glass-panel p-10 text-center border border-dashed border-white/10">
          <p className="text-white/40 text-sm">
            {searchQuery ? "No results match your search." : "No products in the selected segment / application."}
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          {/* Header */}
          <div className={`grid ${GRID} gap-0 border-b border-white/10 bg-white/3`}>
            {[
              { label: "Application",   hint: "URL / Repo" },
              { label: "Product Group", hint: "L0" },
              { label: "Product",       hint: "L1" },
              { label: "Capability",    hint: "L2" },
              { label: "Functionality", hint: "L3" },
              { label: "Description / Personas", hint: "" },
            ].map((col) => (
              <div key={col.label} className="px-3 py-2.5 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white/70">{col.label}</span>
                {col.hint && (
                  <span className="text-[10px] text-white/25 font-mono bg-white/5 px-1 rounded">{col.hint}</span>
                )}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="divide-y divide-white/5">
            {grouped.map((segEntry) => (
              <div key={segEntry.segment}>
                {/* Segment header */}
                <button
                  onClick={() => toggleSeg(segEntry.segment)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-500/8 hover:bg-blue-500/12 transition-colors text-left"
                >
                  <ChevronIcon expanded={!collapsedSegments.has(segEntry.segment)} />
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">{segEntry.segment}</span>
                  <span className="text-[10px] text-white/30 ml-1">
                    {segEntry.apps.reduce((s, a) => s + a.products.length, 0)} products
                  </span>
                </button>

                {!collapsedSegments.has(segEntry.segment) && segEntry.apps.map((appEntry) => (
                  <div key={appEntry.appId} className="border-t border-white/5">
                    {/* App row */}
                    <button
                      onClick={() => toggleApp2(appEntry.appId)}
                      className="w-full flex items-center gap-2 pl-6 pr-3 py-2 bg-white/3 hover:bg-white/5 transition-colors text-left"
                    >
                      <ChevronIcon expanded={!collapsedApps.has(appEntry.appId)} />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-white/80">{appEntry.appName}</span>
                      <span className="text-[10px] text-white/30">{appEntry.products.length} products</span>
                    </button>

                    {!collapsedApps.has(appEntry.appId) && appEntry.products.map((prodEntry) => {
                      const prodGroups = productGroupMap.get(prodEntry.productId) || "—";
                      const prodC = confidenceMap.products.get(prodEntry.productId);
                      return (
                        <div key={prodEntry.productId} className="border-t border-white/5">
                          {/* Product row */}
                          <button
                            onClick={() => toggleProd(prodEntry.productId)}
                            className={`w-full grid ${GRID} gap-0 pl-10 pr-3 py-2 hover:bg-white/3 transition-colors text-left`}
                          >
                            <span className="flex items-center">
                              <ChevronIcon expanded={expandedProducts.has(prodEntry.productId)} />
                            </span>
                            {/* L0 Product Group */}
                            <span className="flex items-center pr-2">
                              <span className="text-[10px] text-amber-400/70 truncate">{prodGroups}</span>
                            </span>
                            {/* L1 Product */}
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                              <span className="text-xs text-white/80 font-medium">{prodEntry.productName}</span>
                              {prodC?.confidence != null && (
                                <ConfidenceBadge confidence={prodC.confidence} sources={prodC.sources || []} size="xs" showSources={false} />
                              )}
                            </span>
                            <span /><span />
                            <span className="text-[10px] text-white/30 self-center">{prodEntry.productDesc.slice(0, 60)}</span>
                          </button>

                          {expandedProducts.has(prodEntry.productId) && prodEntry.caps.map((capEntry) => {
                            const capC = confidenceMap.caps.get(capEntry.capId);
                            return (
                              <div key={capEntry.capId} className="border-t border-white/[0.04]">
                                {/* Capability row */}
                                <button
                                  onClick={() => toggleCap(capEntry.capId)}
                                  className={`w-full grid ${GRID} gap-0 pl-14 pr-3 py-1.5 hover:bg-white/3 transition-colors text-left`}
                                >
                                  <span /><span />
                                  <span />
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <ChevronIcon expanded={expandedCaps.has(capEntry.capId)} small />
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                                    <span className="text-xs text-white/65">{capEntry.capName}</span>
                                    {capEntry.capCategory && capEntry.capCategory !== "—" && (
                                      <span className="text-[9px] text-cyan-400/50 bg-cyan-400/8 px-1 rounded font-mono">{capEntry.capCategory}</span>
                                    )}
                                    {capC?.confidence != null && (
                                      <ConfidenceBadge confidence={capC.confidence} sources={capC.sources || []} size="xs" showSources={false} />
                                    )}
                                  </span>
                                  <span />
                                  <span className="text-[10px] text-white/25 self-center">
                                    {capEntry.funcs.length > 0 ? `${capEntry.funcs.length} functionalities` : ""}
                                  </span>
                                </button>

                                {/* Functionality rows */}
                                {expandedCaps.has(capEntry.capId) && capEntry.funcs.map((func, fi) => {
                                  const funcC = confidenceMap.funcs.get(func.funcId);
                                  return (
                                    <div
                                      key={func.funcId || fi}
                                      className={`grid ${GRID} gap-0 pl-14 pr-3 py-1 border-t border-white/[0.03] hover:bg-purple-500/3`}
                                    >
                                      <span /><span /><span /><span />
                                      <span className="flex items-center gap-1.5 flex-wrap pl-4">
                                        <div className="w-1 h-1 rounded-full bg-purple-400/70 flex-shrink-0" />
                                        <span className="text-xs text-white/55">{func.funcName}</span>
                                        {funcC?.confidence != null && (
                                          <ConfidenceBadge confidence={funcC.confidence} sources={funcC.sources || []} size="xs" showSources={false} />
                                        )}
                                      </span>
                                      <span className="text-[10px] text-white/30 self-center truncate">
                                        {func.personas
                                          ? <span className="text-amber-400/60">{func.personas}</span>
                                          : <span className="text-white/20">{func.funcDesc.slice(0, 60)}</span>
                                        }
                                      </span>
                                    </div>
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
            ))}
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-white/5 flex flex-wrap gap-4 text-[10px] text-white/30">
            {[
              { color: "bg-blue-400",   label: "Application (Repository)" },
              { color: "bg-amber-400",  label: "Product Group (L0)" },
              { color: "bg-green-400",  label: "Product (L1)" },
              { color: "bg-cyan-400",   label: "Capability (L2)" },
              { color: "bg-purple-400", label: "Functionality (L3)" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ChevronIcon({ expanded, small }: { expanded: boolean; small?: boolean }) {
  return (
    <svg
      className={`flex-shrink-0 text-white/30 transition-transform ${expanded ? "rotate-90" : ""} ${small ? "w-2.5 h-2.5" : "w-3 h-3"}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function matchesQuery(r: CatalogRow, q: string) {
  return (
    r.appName.toLowerCase().includes(q) ||
    r.productName.toLowerCase().includes(q) ||
    r.capName.toLowerCase().includes(q) ||
    r.funcName.toLowerCase().includes(q) ||
    r.personas.toLowerCase().includes(q) ||
    r.funcDesc.toLowerCase().includes(q)
  );
}
