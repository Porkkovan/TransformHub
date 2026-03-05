"use client";

import React, { useState, useMemo } from "react";

// ─── Types (mirrors useBmadHierarchy) ────────────────────────────────────────

interface Functionality {
  id: string;
  name: string;
  description?: string;
  sourceFiles: string[];
  personaMappings: { personaType: string; personaName: string }[];
}

interface DigitalCapability {
  id: string;
  name: string;
  description?: string;
  category?: string;
  functionalities: Functionality[];
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
  /** Pre-selected segment from the parent page's segment selector */
  selectedSegment: string;
  onSegmentChange?: (seg: string) => void;
  businessSegments: string[];
}

// ─── Flat catalog row type ────────────────────────────────────────────────────

interface CatalogRow {
  segment: string;
  appId: string;
  appName: string;
  productId: string;
  productName: string;
  productDesc: string;
  capId: string;
  capName: string;
  capCategory: string;
  funcId: string;
  funcName: string;
  funcDesc: string;
  personas: string;
  // grouping key for visual merging
  _segKey: string;
  _appKey: string;
  _prodKey: string;
  _capKey: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductCatalogView({
  repositories,
  orgId,
  selectedSegment,
  onSegmentChange,
  businessSegments,
}: ProductCatalogViewProps) {
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set(["__all__"]));
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Derive available apps for the selector (filtered by segment) ─────────
  const availableApps = useMemo(() => {
    const apps: { id: string; name: string; productCount: number }[] = [];
    for (const repo of repositories) {
      const matchingProducts = repo.digitalProducts.filter(
        (p) => !selectedSegment || p.businessSegment === selectedSegment
      );
      if (matchingProducts.length > 0) {
        apps.push({ id: repo.id, name: repo.name, productCount: matchingProducts.length });
      }
    }
    return apps;
  }, [repositories, selectedSegment]);

  // ── Filtered repositories based on both segment + app selections ─────────
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

  // ── Build flat rows for counts and table ─────────────────────────────────
  const flatRows = useMemo<CatalogRow[]>(() => {
    const rows: CatalogRow[] = [];
    const q = searchQuery.toLowerCase();

    for (const repo of filteredRepos) {
      for (const prod of repo.digitalProducts) {
        const segment = prod.businessSegment || "—";

        if (prod.digitalCapabilities.length === 0) {
          const row: CatalogRow = {
            segment,
            appId: repo.id, appName: repo.name,
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
              segment,
              appId: repo.id, appName: repo.name,
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
              segment,
              appId: repo.id, appName: repo.name,
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
  const counts = useMemo(() => {
    const products = new Set(flatRows.map((r) => r.productId)).size;
    const caps = new Set(flatRows.filter((r) => r.capId).map((r) => r.capId)).size;
    const funcs = new Set(flatRows.filter((r) => r.funcId).map((r) => r.funcId)).size;
    return { products, caps, funcs };
  }, [flatRows]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  function toggleApp(id: string) {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSeg(key: string) {
    setExpandedSegments((prev) => toggle(prev, key));
  }
  function toggleApp2(key: string) {
    setExpandedApps((prev) => toggle(prev, key));
  }
  function toggleProd(key: string) {
    setExpandedProducts((prev) => toggle(prev, key));
  }
  function toggleCap(key: string) {
    setExpandedCaps((prev) => toggle(prev, key));
  }

  function toggle(s: Set<string>, key: string) {
    const next = new Set(s);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  }

  function expandAll() {
    const segs = new Set<string>();
    const apps = new Set<string>();
    const prods = new Set<string>();
    const caps = new Set<string>();
    for (const r of flatRows) {
      segs.add(r._segKey);
      apps.add(r._appKey);
      prods.add(r._prodKey);
      caps.add(r._capKey);
    }
    setExpandedSegments(segs);
    setExpandedApps(apps);
    setExpandedProducts(prods);
    setExpandedCaps(caps);
  }

  function collapseAll() {
    setExpandedSegments(new Set());
    setExpandedApps(new Set());
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

  // ── Build grouped structure for rendering ─────────────────────────────────
  // Group: segment → app → product → capability → [functionalities]
  type FuncEntry = { funcId: string; funcName: string; funcDesc: string; personas: string };
  type CapEntry = { capId: string; capName: string; capCategory: string; funcs: FuncEntry[] };
  type ProdEntry = { productId: string; productName: string; productDesc: string; caps: CapEntry[] };
  type AppEntry = { appId: string; appName: string; products: ProdEntry[] };
  type SegEntry = { segment: string; apps: AppEntry[] };

  const grouped = useMemo<SegEntry[]>(() => {
    const segMap = new Map<string, Map<string, Map<string, Map<string, FuncEntry[]>>>>();
    const segAppProdCapMeta = new Map<string, {
      apps: Map<string, {
        appName: string;
        products: Map<string, {
          productName: string; productDesc: string;
          caps: Map<string, { capName: string; capCategory: string; funcs: FuncEntry[] }>
        }>
      }>
    }>();

    for (const r of flatRows) {
      if (!segAppProdCapMeta.has(r._segKey)) {
        segAppProdCapMeta.set(r._segKey, { apps: new Map() });
      }
      const segData = segAppProdCapMeta.get(r._segKey)!;

      if (!segData.apps.has(r._appKey)) {
        segData.apps.set(r._appKey, { appName: r.appName, products: new Map() });
      }
      const appData = segData.apps.get(r._appKey)!;

      if (!appData.products.has(r._prodKey)) {
        appData.products.set(r._prodKey, { productName: r.productName, productDesc: r.productDesc, caps: new Map() });
      }
      const prodData = appData.products.get(r._prodKey)!;

      const capKey = r._capKey || `__nocap_${r._prodKey}`;
      if (!prodData.caps.has(capKey)) {
        prodData.caps.set(capKey, { capName: r.capName, capCategory: r.capCategory, funcs: [] });
      }
      const capData = prodData.caps.get(capKey)!;

      if (r.funcId) {
        capData.funcs.push({ funcId: r.funcId, funcName: r.funcName, funcDesc: r.funcDesc, personas: r.personas });
      }
    }

    // Convert to array structure
    const result: SegEntry[] = [];
    for (const [seg, segData] of segAppProdCapMeta) {
      const apps: AppEntry[] = [];
      for (const [appId, appData] of segData.apps) {
        const products: ProdEntry[] = [];
        for (const [prodId, prodData] of appData.products) {
          const caps: CapEntry[] = [];
          for (const [capId, capData] of prodData.caps) {
            caps.push({ capId, capName: capData.capName, capCategory: capData.capCategory, funcs: capData.funcs });
          }
          products.push({ productId: prodId, productName: prodData.productName, productDesc: prodData.productDesc, caps });
        }
        apps.push({ appId, appName: appData.appName, products });
      }
      result.push({ segment: seg, apps });
    }
    return result;
  }, [flatRows]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (filteredRepos.length === 0 && repositories.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-10 text-center">
        <p className="text-white/40 text-sm">No digital products yet.</p>
        <p className="text-white/25 text-xs mt-1">Run the Discovery agent to analyse URLs first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="glass-panel p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Segment filter */}
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

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-white/50 mb-1.5">Search</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter products, capabilities, functionalities…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
            />
          </div>

          {/* Download button */}
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

        {/* Application multi-select chips */}
        {availableApps.length > 0 && (
          <div>
            <p className="text-xs text-white/40 mb-2">
              Applications
              {selectedAppIds.size > 0 && (
                <button
                  onClick={() => setSelectedAppIds(new Set())}
                  className="ml-2 text-blue-400/70 hover:text-blue-400"
                >
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

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
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
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-xs text-white/40 hover:text-white/70 transition-colors">Expand All</button>
          <span className="text-white/20">|</span>
          <button onClick={collapseAll} className="text-xs text-white/40 hover:text-white/70 transition-colors">Collapse All</button>
        </div>
      </div>

      {/* ── Catalog Table ──────────────────────────────────────────────── */}
      {flatRows.length === 0 ? (
        <div className="glass-panel p-10 text-center border border-dashed border-white/10">
          <p className="text-white/40 text-sm">
            {searchQuery ? "No results match your search." : "No products in the selected segment / application."}
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1.2fr_1.2fr_1.3fr_1.5fr] gap-0 border-b border-white/10 bg-white/3">
            {[
              { label: "Application", hint: "URL / Repo" },
              { label: "Product", hint: "L1" },
              { label: "Capability", hint: "L2" },
              { label: "Functionality", hint: "L3" },
              { label: "Description / Personas", hint: "" },
            ].map((col) => (
              <div key={col.label} className="px-3 py-2.5 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white/70">{col.label}</span>
                {col.hint && (
                  <span className="text-[10px] text-white/25 font-mono bg-white/5 px-1 rounded">
                    {col.hint}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="divide-y divide-white/5">
            {grouped.map((segEntry) => (
              <div key={segEntry.segment}>
                {/* Segment header row */}
                <button
                  onClick={() => toggleSeg(segEntry.segment)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-500/8 hover:bg-blue-500/12 transition-colors text-left"
                >
                  <ChevronIcon expanded={expandedSegments.has(segEntry.segment)} />
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">
                    {segEntry.segment}
                  </span>
                  <span className="text-[10px] text-white/30 ml-1">
                    {segEntry.apps.reduce((s, a) => s + a.products.length, 0)} products
                  </span>
                </button>

                {expandedSegments.has(segEntry.segment) && segEntry.apps.map((appEntry) => (
                  <div key={appEntry.appId} className="border-t border-white/5">
                    {/* App row */}
                    <button
                      onClick={() => toggleApp2(appEntry.appId)}
                      className="w-full flex items-center gap-2 pl-6 pr-3 py-2 bg-white/3 hover:bg-white/5 transition-colors text-left"
                    >
                      <ChevronIcon expanded={expandedApps.has(appEntry.appId)} />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-white/80">{appEntry.appName}</span>
                      <span className="text-[10px] text-white/30">{appEntry.products.length} products</span>
                    </button>

                    {expandedApps.has(appEntry.appId) && appEntry.products.map((prodEntry) => (
                      <div key={prodEntry.productId} className="border-t border-white/5">
                        {/* Product row */}
                        <button
                          onClick={() => toggleProd(prodEntry.productId)}
                          className="w-full grid grid-cols-[1fr_1.2fr_1.2fr_1.3fr_1.5fr] gap-0 pl-10 pr-3 py-2 hover:bg-white/3 transition-colors text-left"
                        >
                          <span className="flex items-center gap-1.5 col-span-1">
                            <ChevronIcon expanded={expandedProducts.has(prodEntry.productId)} />
                          </span>
                          <span className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                            <span className="text-xs text-white/80 font-medium">{prodEntry.productName}</span>
                          </span>
                          <span />
                          <span />
                          <span className="text-[10px] text-white/30 self-center">{prodEntry.productDesc.slice(0, 60) || ""}</span>
                        </button>

                        {expandedProducts.has(prodEntry.productId) && prodEntry.caps.map((capEntry) => (
                          <div key={capEntry.capId} className="border-t border-white/[0.04]">
                            {/* Capability row */}
                            <button
                              onClick={() => toggleCap(capEntry.capId)}
                              className="w-full grid grid-cols-[1fr_1.2fr_1.2fr_1.3fr_1.5fr] gap-0 pl-14 pr-3 py-1.5 hover:bg-white/3 transition-colors text-left"
                            >
                              <span />
                              <span />
                              <span className="flex items-center gap-1.5">
                                <ChevronIcon expanded={expandedCaps.has(capEntry.capId)} small />
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                                <span className="text-xs text-white/65">{capEntry.capName}</span>
                                {capEntry.capCategory && capEntry.capCategory !== "—" && (
                                  <span className="text-[9px] text-cyan-400/50 bg-cyan-400/8 px-1 rounded font-mono">
                                    {capEntry.capCategory}
                                  </span>
                                )}
                              </span>
                              <span />
                              <span className="text-[10px] text-white/25 self-center">
                                {capEntry.funcs.length > 0 ? `${capEntry.funcs.length} functionalities` : ""}
                              </span>
                            </button>

                            {/* Functionality rows */}
                            {expandedCaps.has(capEntry.capId) && capEntry.funcs.map((func, fi) => (
                              <div
                                key={func.funcId || fi}
                                className="grid grid-cols-[1fr_1.2fr_1.2fr_1.3fr_1.5fr] gap-0 pl-14 pr-3 py-1 border-t border-white/[0.03] hover:bg-purple-500/3"
                              >
                                <span />
                                <span />
                                <span />
                                <span className="flex items-center gap-1.5 pl-4">
                                  <div className="w-1 h-1 rounded-full bg-purple-400/70 flex-shrink-0" />
                                  <span className="text-xs text-white/55">{func.funcName}</span>
                                </span>
                                <span className="text-[10px] text-white/30 self-center truncate">
                                  {func.personas
                                    ? <span className="text-amber-400/60">{func.personas}</span>
                                    : <span className="text-white/20">{func.funcDesc.slice(0, 60)}</span>
                                  }
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-white/5 flex flex-wrap gap-4 text-[10px] text-white/30">
            {[
              { color: "bg-blue-400", label: "Application (Repository)" },
              { color: "bg-green-400", label: "Product (L1)" },
              { color: "bg-cyan-400", label: "Capability (L2)" },
              { color: "bg-purple-400", label: "Functionality (L3)" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ expanded, small }: { expanded: boolean; small?: boolean }) {
  return (
    <svg
      className={`flex-shrink-0 text-white/30 transition-transform ${expanded ? "rotate-90" : ""} ${small ? "w-2.5 h-2.5" : "w-3 h-3"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ─── Query helper ─────────────────────────────────────────────────────────────

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
