"use client";

import React, { useState } from "react";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import GlassButton from "@/components/ui/GlassButton";

export type PassStatus = "pending" | "running" | "awaiting_review" | "approved" | "skipped";

export interface PassItem {
  id: string;
  name: string;
  description?: string;
  confidence?: number;
  sources?: string[];
}

export interface PassResult {
  products_count?: number;
  capabilities_count?: number;
  functionalities_count?: number;
  active_sources?: string[];
  repository_id?: string;
  pass_number?: number;
  // Inline item lists for review (populated by page from live DB data)
  products?: PassItem[];
  capabilities?: PassItem[];
  functionalities?: PassItem[];
}

interface PassInfo {
  pass: 1 | 2 | 3;
  label: string;
  level: string;
  color: string;
  status: PassStatus;
  result?: PassResult;
}

interface MultiPassPanelProps {
  pass1Status: PassStatus;
  pass2Status: PassStatus;
  pass3Status: PassStatus;
  pass1Result?: PassResult;
  pass2Result?: PassResult;
  pass3Result?: PassResult;
  onApprovePass1: () => void;
  onApprovePass2: () => void;
  onDeleteItem?: (entityType: "digital-products" | "digital-capabilities" | "functionalities", id: string) => Promise<void>;
  onRenameItem?: (entityType: "digital-products" | "digital-capabilities" | "functionalities", id: string, name: string) => Promise<void>;
  loading: boolean;
}

function StatusChip({ status }: { status: PassStatus }) {
  const map: Record<PassStatus, { label: string; cls: string }> = {
    pending:         { label: "Pending",         cls: "text-white/30 bg-white/5 border-white/10" },
    running:         { label: "Running…",        cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30 animate-pulse" },
    awaiting_review: { label: "Review Required", cls: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
    approved:        { label: "Approved ✓",      cls: "text-green-400 bg-green-400/10 border-green-400/30" },
    skipped:         { label: "Skipped",         cls: "text-white/30 bg-white/5 border-white/10" },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 text-[10px] rounded border font-medium ${cls}`}>{label}</span>;
}

function SourcesDisplay({ sources }: { sources: string[] }) {
  const labels: Record<string, { label: string; color: string }> = {
    url_analysis:     { label: "URL",      color: "bg-white/10 text-white/40" },
    openapi_spec:     { label: "OpenAPI",  color: "bg-blue-500/20 text-blue-300" },
    github_structure: { label: "GitHub",   color: "bg-gray-500/20 text-gray-300" },
    github_tests:     { label: "Tests",    color: "bg-emerald-500/20 text-emerald-300" },
    db_schema:        { label: "DB",       color: "bg-orange-500/20 text-orange-300" },
    context_document: { label: "Docs",     color: "bg-purple-500/20 text-purple-300" },
    integration_data: { label: "Jira/CF",  color: "bg-cyan-500/20 text-cyan-300" },
    questionnaire:    { label: "Q&A",      color: "bg-amber-500/20 text-amber-300" },
  };
  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((s) => {
        const m = labels[s] || { label: s, color: "bg-white/10 text-white/40" };
        return <span key={s} className={`px-1.5 py-0.5 text-[9px] rounded ${m.color}`}>{m.label}</span>;
      })}
    </div>
  );
}

function ReviewableItem({
  item,
  entityType,
  dotColor,
  onDelete,
  onRename,
}: {
  item: PassItem;
  entityType: "digital-products" | "digital-capabilities" | "functionalities";
  dotColor: string;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  const handleSave = async () => {
    if (!onRename || editName.trim() === item.name) { setEditing(false); return; }
    setSaving(true);
    await onRename(item.id, editName.trim());
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Remove "${item.name}" from discovery results?`)) return;
    await onDelete(item.id);
    setDeleted(true);
  };

  return (
    <div className="flex items-start gap-2 py-1 group">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex gap-1.5 items-center">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              className="flex-1 bg-white/5 border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
            />
            <button onClick={handleSave} disabled={saving} className="text-[10px] text-green-400 hover:text-green-300 px-1.5 py-0.5 border border-green-500/30 rounded">
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-[10px] text-white/30 hover:text-white/60 px-1.5 py-0.5">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/70">{item.name}</span>
            {item.confidence != null && (
              <ConfidenceBadge confidence={item.confidence} sources={item.sources || []} size="xs" showSources={false} />
            )}
            <div className="hidden group-hover:flex items-center gap-1 ml-1">
              {onRename && (
                <button onClick={() => { setEditName(item.name); setEditing(true); }}
                  className="text-[9px] text-white/30 hover:text-blue-400 border border-white/10 hover:border-blue-500/30 rounded px-1 py-0.5 transition-colors">
                  edit
                </button>
              )}
              {onDelete && (
                <button onClick={handleDelete}
                  className="text-[9px] text-white/30 hover:text-red-400 border border-white/10 hover:border-red-500/30 rounded px-1 py-0.5 transition-colors">
                  remove
                </button>
              )}
            </div>
          </div>
        )}
        {item.description && !editing && (
          <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">{item.description}</p>
        )}
      </div>
    </div>
  );
}

function ReviewItemList({
  items,
  entityType,
  dotColor,
  label,
  onDelete,
  onRename,
}: {
  items: PassItem[];
  entityType: "digital-products" | "digital-capabilities" | "functionalities";
  dotColor: string;
  label: string;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!items.length) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 mb-1"
      >
        <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {label} ({items.length}) — click to review &amp; edit
      </button>
      {expanded && (
        <div className="ml-2 pl-2 border-l border-white/10 space-y-0.5 max-h-52 overflow-y-auto">
          {items.map((item) => (
            <ReviewableItem
              key={item.id}
              item={item}
              entityType={entityType}
              dotColor={dotColor}
              onDelete={onDelete ? (id) => onDelete(id) : undefined}
              onRename={onRename ? (id, name) => onRename(id, name) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MultiPassPanel({
  pass1Status, pass2Status, pass3Status,
  pass1Result, pass2Result, pass3Result,
  onApprovePass1, onApprovePass2,
  onDeleteItem, onRenameItem,
  loading,
}: MultiPassPanelProps) {
  const passes: PassInfo[] = [
    {
      pass: 1, label: "Pass 1 — Products (L1)",
      level: "Identify all digital products",
      color: "border-green-500/30 bg-green-500/5",
      status: pass1Status, result: pass1Result,
    },
    {
      pass: 2, label: "Pass 2 — Capabilities (L2)",
      level: "Map capabilities to confirmed products",
      color: "border-cyan-500/30 bg-cyan-500/5",
      status: pass2Status, result: pass2Result,
    },
    {
      pass: 3, label: "Pass 3 — Functionalities (L3)",
      level: "Assign functionalities to confirmed capabilities",
      color: "border-purple-500/30 bg-purple-500/5",
      status: pass3Status, result: pass3Result,
    },
  ];

  const dotColors = ["bg-green-400", "bg-cyan-400", "bg-purple-400"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-sm font-semibold text-white/80">Multi-Pass Discovery Progress</span>
        <span className="text-[10px] text-white/30">Human review &amp; approval between each level</span>
      </div>

      {passes.map((p, idx) => (
        <div key={p.pass} className={`glass-panel rounded-xl p-4 border ${p.color} space-y-2`}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                p.status === "approved"        ? "bg-green-500/30 text-green-300" :
                p.status === "running"         ? "bg-yellow-500/30 text-yellow-300 animate-pulse" :
                p.status === "awaiting_review" ? "bg-amber-500/30 text-amber-300" :
                "bg-white/10 text-white/30"
              }`}>
                {p.status === "approved" ? "✓" : p.status === "running" ? "⟳" : p.pass}
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">{p.label}</p>
                <p className="text-xs text-white/40">{p.level}</p>
              </div>
            </div>
            <StatusChip status={p.status} />
          </div>

          {/* Count summary */}
          {p.result && p.status !== "pending" && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-3 text-xs">
                {(p.result.products_count ?? 0) > 0 && (
                  <span className="text-green-400/80"><span className="font-bold">{p.result.products_count}</span> products</span>
                )}
                {(p.result.capabilities_count ?? 0) > 0 && (
                  <span className="text-cyan-400/80"><span className="font-bold">{p.result.capabilities_count}</span> capabilities</span>
                )}
                {(p.result.functionalities_count ?? 0) > 0 && (
                  <span className="text-purple-400/80"><span className="font-bold">{p.result.functionalities_count}</span> functionalities</span>
                )}
              </div>
              {p.result.active_sources && p.result.active_sources.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-white/30">Evidence sources:</span>
                  <SourcesDisplay sources={p.result.active_sources} />
                </div>
              )}

              {/* Inline item lists for review */}
              {p.result.products && (
                <ReviewItemList
                  items={p.result.products}
                  entityType="digital-products"
                  dotColor={dotColors[0]}
                  label="Discovered Products"
                  onDelete={onDeleteItem ? (id) => onDeleteItem("digital-products", id) : undefined}
                  onRename={onRenameItem ? (id, name) => onRenameItem("digital-products", id, name) : undefined}
                />
              )}
              {p.result.capabilities && (
                <ReviewItemList
                  items={p.result.capabilities}
                  entityType="digital-capabilities"
                  dotColor={dotColors[1]}
                  label="Discovered Capabilities"
                  onDelete={onDeleteItem ? (id) => onDeleteItem("digital-capabilities", id) : undefined}
                  onRename={onRenameItem ? (id, name) => onRenameItem("digital-capabilities", id, name) : undefined}
                />
              )}
              {p.result.functionalities && (
                <ReviewItemList
                  items={p.result.functionalities}
                  entityType="functionalities"
                  dotColor={dotColors[2]}
                  label="Discovered Functionalities"
                  onDelete={onDeleteItem ? (id) => onDeleteItem("functionalities", id) : undefined}
                  onRename={onRenameItem ? (id, name) => onRenameItem("functionalities", id, name) : undefined}
                />
              )}
            </div>
          )}

          {/* Connector line to next pass */}
          {idx < 2 && (
            <div className={`ml-3 h-3 w-0.5 ${p.status === "approved" ? "bg-green-500/40" : "bg-white/10"}`} />
          )}
        </div>
      ))}

      {/* ── Pass 1 review gate ────────────────────────────────────────────── */}
      {pass1Status === "awaiting_review" && (
        <div className="glass-panel p-4 border border-amber-500/25 rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-amber-400 font-semibold">Review L1 — Products</p>
              <p className="text-xs text-white/40 mt-1">
                The AI has discovered the products above. Review each product name — hover to rename or remove any incorrect items.
                You can also edit them in the <strong className="text-white/60">Tree View</strong> tab below.
                When satisfied, click <strong className="text-white/60">Approve</strong> to continue to L2 Capabilities.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <GlassButton onClick={onApprovePass1} disabled={loading} variant="success">
              ✓ Approve L1 Products → Run L2 Capabilities
            </GlassButton>
          </div>
        </div>
      )}

      {/* ── Pass 2 review gate ────────────────────────────────────────────── */}
      {pass2Status === "awaiting_review" && (
        <div className="glass-panel p-4 border border-amber-500/25 rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-amber-400 font-semibold">Review L2 — Capabilities</p>
              <p className="text-xs text-white/40 mt-1">
                Capabilities have been mapped under the approved products. Review them above — hover to rename or remove.
                Use the <strong className="text-white/60">Drill-Down View</strong> below for a full hierarchy view.
                When satisfied, approve to run L3 Functionalities.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <GlassButton onClick={onApprovePass2} disabled={loading} variant="success">
              ✓ Approve L2 Capabilities → Run L3 Functionalities
            </GlassButton>
          </div>
        </div>
      )}

      {/* ── Complete ──────────────────────────────────────────────────────── */}
      {pass3Status === "approved" && (
        <div className="glass-panel p-4 border border-green-500/25 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm">✓</div>
            <div>
              <p className="text-sm text-green-400 font-semibold">Multi-Pass Discovery Complete</p>
              <p className="text-xs text-white/40 mt-0.5">
                All three levels discovered with human approval at each stage. Confidence scores reflect all active enrichment sources.
                Switch to <strong className="text-white/60">Product Catalog</strong> view to see the full hierarchy.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
