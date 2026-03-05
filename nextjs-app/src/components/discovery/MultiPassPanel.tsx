"use client";

import React from "react";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import GlassButton from "@/components/ui/GlassButton";

export type PassStatus = "pending" | "running" | "awaiting_review" | "approved" | "skipped";

export interface PassResult {
  products_count?: number;
  capabilities_count?: number;
  functionalities_count?: number;
  active_sources?: string[];
  repository_id?: string;
  pass_number?: number;
}

interface PassInfo {
  pass: 1 | 2 | 3;
  label: string;
  level: string;
  color: string;
  dotColor: string;
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
  loading: boolean;
}

function StatusChip({ status }: { status: PassStatus }) {
  const map: Record<PassStatus, { label: string; cls: string }> = {
    pending:         { label: "Pending",         cls: "text-white/30 bg-white/5 border-white/10" },
    running:         { label: "Running…",        cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
    awaiting_review: { label: "Review Required", cls: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
    approved:        { label: "Approved ✓",      cls: "text-green-400 bg-green-400/10 border-green-400/30" },
    skipped:         { label: "Skipped",         cls: "text-white/30 bg-white/5 border-white/10" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`px-2 py-0.5 text-[10px] rounded border font-medium ${cls}`}>{label}</span>
  );
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
    <div className="flex flex-wrap gap-1 mt-1">
      {sources.map((s) => {
        const m = labels[s] || { label: s, color: "bg-white/10 text-white/40" };
        return (
          <span key={s} className={`px-1.5 py-0.5 text-[9px] rounded ${m.color}`}>{m.label}</span>
        );
      })}
    </div>
  );
}

export default function MultiPassPanel({
  pass1Status, pass2Status, pass3Status,
  pass1Result, pass2Result, pass3Result,
  onApprovePass1, onApprovePass2,
  loading,
}: MultiPassPanelProps) {
  const passes: PassInfo[] = [
    {
      pass: 1, label: "Pass 1 — Products (L1)",
      level: "Identify all digital products",
      color: "border-green-500/30 bg-green-500/5",
      dotColor: "bg-green-400",
      status: pass1Status, result: pass1Result,
    },
    {
      pass: 2, label: "Pass 2 — Capabilities (L2)",
      level: "Map capabilities to confirmed products",
      color: "border-cyan-500/30 bg-cyan-500/5",
      dotColor: "bg-cyan-400",
      status: pass2Status, result: pass2Result,
    },
    {
      pass: 3, label: "Pass 3 — Functionalities (L3)",
      level: "Assign functionalities to confirmed capabilities",
      color: "border-purple-500/30 bg-purple-500/5",
      dotColor: "bg-purple-400",
      status: pass3Status, result: pass3Result,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-sm font-semibold text-white/80">Multi-Pass Discovery Progress</span>
      </div>

      {passes.map((p, idx) => (
        <div key={p.pass} className={`glass-panel rounded-xl p-4 border ${p.color} space-y-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Step indicator */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                p.status === "approved" ? "bg-green-500/30 text-green-300" :
                p.status === "running" ? "bg-yellow-500/30 text-yellow-300 animate-pulse" :
                p.status === "awaiting_review" ? "bg-amber-500/30 text-amber-300" :
                "bg-white/10 text-white/30"
              }`}>
                {p.status === "approved" ? "✓" : p.pass}
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">{p.label}</p>
                <p className="text-xs text-white/40">{p.level}</p>
              </div>
            </div>
            <StatusChip status={p.status} />
          </div>

          {/* Result summary */}
          {p.result && p.status !== "pending" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3 text-xs">
                {p.result.products_count != null && p.result.products_count > 0 && (
                  <span className="text-green-400/80">
                    <span className="font-bold">{p.result.products_count}</span> products
                  </span>
                )}
                {p.result.capabilities_count != null && p.result.capabilities_count > 0 && (
                  <span className="text-cyan-400/80">
                    <span className="font-bold">{p.result.capabilities_count}</span> capabilities
                  </span>
                )}
                {p.result.functionalities_count != null && p.result.functionalities_count > 0 && (
                  <span className="text-purple-400/80">
                    <span className="font-bold">{p.result.functionalities_count}</span> functionalities
                  </span>
                )}
              </div>
              {p.result.active_sources && p.result.active_sources.length > 0 && (
                <div>
                  <span className="text-[10px] text-white/30">Sources used: </span>
                  <SourcesDisplay sources={p.result.active_sources} />
                </div>
              )}
            </div>
          )}

          {/* Connector line */}
          {idx < 2 && (
            <div className={`ml-3 mt-1 h-4 w-0.5 ${
              p.status === "approved" ? "bg-green-500/40" : "bg-white/10"
            }`} />
          )}
        </div>
      ))}

      {/* Action buttons */}
      {pass1Status === "awaiting_review" && (
        <div className="glass-panel p-4 border border-amber-500/20 space-y-2">
          <p className="text-sm text-amber-400/80 font-medium">Review L1 Products</p>
          <p className="text-xs text-white/40">
            Check the Products View tab to review the discovered products. Edit names or descriptions
            if needed using inline editing in the Tree View. When satisfied, approve to continue to L2.
          </p>
          <div className="flex gap-3 mt-3">
            <GlassButton onClick={onApprovePass1} disabled={loading} variant="success">
              Approve L1 Products → Run L2 Capabilities
            </GlassButton>
          </div>
        </div>
      )}

      {pass2Status === "awaiting_review" && (
        <div className="glass-panel p-4 border border-amber-500/20 space-y-2">
          <p className="text-sm text-amber-400/80 font-medium">Review L2 Capabilities</p>
          <p className="text-xs text-white/40">
            Check the Drill-Down View to review capabilities under each product. Edit as needed.
            When satisfied, approve to continue to L3 Functionalities.
          </p>
          <div className="flex gap-3 mt-3">
            <GlassButton onClick={onApprovePass2} disabled={loading} variant="success">
              Approve L2 Capabilities → Run L3 Functionalities
            </GlassButton>
          </div>
        </div>
      )}

      {pass3Status === "approved" && (
        <div className="glass-panel p-4 border border-green-500/20">
          <p className="text-sm text-green-400 font-medium">Multi-Pass Discovery Complete ✓</p>
          <p className="text-xs text-white/40 mt-1">
            All three levels have been discovered and refined with human approval at each stage.
            Switch to the Product Catalog view to see the full hierarchy with confidence scores.
          </p>
        </div>
      )}
    </div>
  );
}
