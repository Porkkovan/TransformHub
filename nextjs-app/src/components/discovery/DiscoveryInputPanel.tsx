"use client";

import React, { useState } from "react";
import GlassButton from "@/components/ui/GlassButton";

export interface RepoEntry {
  name: string;
  url: string;
  openapiUrl?: string;
}

export interface DiscoveryInputData {
  repos: RepoEntry[];
  mode: "full" | "multipass";
  // Enrichment sources
  dbSchemaText: string;
  githubToken: string;
  // Pre-discovery questionnaire
  domainContext: string;
  knownProducts: string;
  knownCapabilities: string;
}

interface DiscoveryInputPanelProps {
  onSubmit: (data: DiscoveryInputData) => void;
  disabled?: boolean;
}

export default function DiscoveryInputPanel({ onSubmit, disabled }: DiscoveryInputPanelProps) {
  const [repos, setRepos] = useState<RepoEntry[]>([{ name: "", url: "", openapiUrl: "" }]);
  const [mode, setMode] = useState<"full" | "multipass">("full");
  const [showEnrichment, setShowEnrichment] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [dbSchemaText, setDbSchemaText] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [domainContext, setDomainContext] = useState("");
  const [knownProducts, setKnownProducts] = useState("");
  const [knownCapabilities, setKnownCapabilities] = useState("");

  const updateRepo = (i: number, field: keyof RepoEntry, value: string) => {
    setRepos((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const addRepo = () => setRepos((p) => [...p, { name: "", url: "", openapiUrl: "" }]);
  const removeRepo = (i: number) => setRepos((p) => p.filter((_, idx) => idx !== i));

  const hasValidRepo = repos.some((r) => r.name.trim());
  const enrichmentActive = dbSchemaText.trim() || githubToken.trim() || repos.some((r) => r.openapiUrl?.trim());
  const questionnaireActive = domainContext.trim() || knownProducts.trim() || knownCapabilities.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = repos.filter((r) => r.name.trim());
    if (valid.length === 0) return;
    onSubmit({ repos: valid, mode, dbSchemaText, githubToken, domainContext, knownProducts, knownCapabilities });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Mode selector ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 p-1 glass-panel-sm w-fit rounded-lg">
        {(["full", "multipass"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === m
                ? "bg-blue-500/25 text-blue-300 border border-blue-500/40"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            {m === "full" ? "Full (Single Pass)" : "Multi-Pass (L1 → L2 → L3)"}
          </button>
        ))}
      </div>
      {mode === "multipass" && (
        <p className="text-[11px] text-amber-400/70 bg-amber-400/5 border border-amber-400/15 rounded-lg px-3 py-2">
          Multi-pass runs three sequential discovery rounds with a human review between each level —
          L1 Products → approve → L2 Capabilities → approve → L3 Functionalities.
          Achieves significantly higher accuracy through iterative human confirmation.
        </p>
      )}

      {/* ── Repository rows ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/60">Repositories</label>
        {repos.map((repo, i) => (
          <div key={i} className="space-y-1.5 p-3 glass-panel-sm rounded-lg border border-white/5">
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  placeholder="Repository name (e.g. core-banking)"
                  value={repo.name}
                  onChange={(e) => updateRepo(i, "name", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
                />
              </div>
              <div className="flex-1">
                <input
                  placeholder="GitHub / App URL"
                  value={repo.url}
                  onChange={(e) => updateRepo(i, "url", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
                />
              </div>
              {repos.length > 1 && (
                <button type="button" onClick={() => removeRepo(i)} className="text-red-400/50 hover:text-red-400 mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {showEnrichment && (
              <input
                placeholder="OpenAPI / Swagger spec URL (optional, e.g. https://api.example.com/openapi.json)"
                value={repo.openapiUrl || ""}
                onChange={(e) => updateRepo(i, "openapiUrl", e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
            )}
          </div>
        ))}
        <button type="button" onClick={addRepo} className="text-xs text-blue-400/70 hover:text-blue-400 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Repository
        </button>
      </div>

      {/* ── Enrichment sources (collapsible) ─────────────────────────────── */}
      <div className="border border-white/8 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowEnrichment((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Enrichment Sources</span>
            <span className="text-[10px] text-white/30">(optional — improves accuracy)</span>
            {enrichmentActive && (
              <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded border border-green-400/20">
                active
              </span>
            )}
          </div>
          <svg className={`w-4 h-4 text-white/30 transition-transform ${showEnrichment ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showEnrichment && (
          <div className="px-4 pb-4 pt-3 space-y-4 bg-white/[0.02]">
            {/* Accuracy gain guide */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              {[
                { label: "OpenAPI Spec", gain: "+20%", color: "text-blue-400" },
                { label: "GitHub Tests", gain: "+15%", color: "text-emerald-400" },
                { label: "DB Schema", gain: "+20%", color: "text-orange-400" },
                { label: "GitHub Token", gain: "+15%", color: "text-gray-400" },
              ].map((item) => (
                <div key={item.label} className="glass-panel-sm px-2 py-1.5 rounded text-center">
                  <p className={`font-bold ${item.color}`}>{item.gain}</p>
                  <p className="text-white/40">{item.label}</p>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-white/30">
              OpenAPI spec URLs are entered per-repository above (expand each repo). Additional sources:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">GitHub Token <span className="text-white/25">(for private repos)</span></label>
                <input
                  type="password"
                  placeholder="ghp_••••••••••••"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
                />
                <p className="text-[10px] text-white/25 mt-1">Enables folder structure + README + test file analysis</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">Database Schema <span className="text-white/25">(paste SQL CREATE TABLE statements or JSON schema)</span></label>
              <textarea
                rows={4}
                placeholder={"CREATE TABLE accounts (\n  id UUID PRIMARY KEY,\n  customer_id UUID,\n  balance DECIMAL\n);\n..."}
                value={dbSchemaText}
                onChange={(e) => setDbSchemaText(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-blue-500/40 font-mono resize-y"
              />
              <p className="text-[10px] text-white/25 mt-1">Table/entity names reveal business domain structure (+20% at L1/L2)</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Pre-discovery questionnaire (collapsible) ────────────────────── */}
      <div className="border border-white/8 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowQuestionnaire((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Domain Questionnaire</span>
            <span className="text-[10px] text-white/30">(optional — anchors the hierarchy)</span>
            {questionnaireActive && (
              <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded border border-green-400/20">
                active
              </span>
            )}
          </div>
          <svg className={`w-4 h-4 text-white/30 transition-transform ${showQuestionnaire ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showQuestionnaire && (
          <div className="px-4 pb-4 pt-3 space-y-3 bg-white/[0.02]">
            <p className="text-[10px] text-white/30">
              Human-provided context prevents the agent from guessing your domain and naming conventions.
              Known products/capabilities are used as hard constraints during clustering.
            </p>
            <div>
              <label className="block text-xs text-white/50 mb-1">Application Domain</label>
              <input
                placeholder="e.g. Core Banking platform serving retail and SMB customers — handles accounts, payments, lending"
                value={domainContext}
                onChange={(e) => setDomainContext(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Known Products <span className="text-white/25">(comma-separated)</span></label>
              <input
                placeholder="e.g. Mobile Banking App, Internet Banking, API Gateway"
                value={knownProducts}
                onChange={(e) => setKnownProducts(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Known Capabilities <span className="text-white/25">(comma-separated)</span></label>
              <input
                placeholder="e.g. Authentication, Payments, Account Management, Reporting"
                value={knownCapabilities}
                onChange={(e) => setKnownCapabilities(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <GlassButton type="submit" disabled={disabled || !hasValidRepo}>
        {disabled
          ? "Analyzing..."
          : mode === "multipass"
          ? `Run Multi-Pass Discovery — Step 1: Products (${repos.filter((r) => r.name.trim()).length} repos)`
          : `Run Discovery Agent (${repos.filter((r) => r.name.trim()).length} repos)`}
      </GlassButton>
    </form>
  );
}
