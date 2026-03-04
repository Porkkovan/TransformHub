"use client";

import React, { useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useCompetitorIntelligence } from "@/hooks/useCompetitorIntelligence";

interface CompetitorIntelligenceProps {
  organizationId: string;
}

const positionColors: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  leading: "success",
  competitive: "info",
  behind: "warning",
  lagging: "danger",
};

export default function CompetitorIntelligence({ organizationId }: CompetitorIntelligenceProps) {
  const {
    competitors,
    latestExecution,
    loading,
    error,
    actionLoading,
    updateCompetitors,
    runMarketIntelligence,
  } = useCompetitorIntelligence(organizationId);

  const [newCompetitor, setNewCompetitor] = useState("");

  const handleAdd = async () => {
    const name = newCompetitor.trim();
    if (!name || competitors.includes(name)) return;
    await updateCompetitors([...competitors, name]);
    setNewCompetitor("");
  };

  const handleRemove = async (name: string) => {
    await updateCompetitors(competitors.filter((c) => c !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-white/40 text-sm">Loading competitor intelligence...</p>
      </div>
    );
  }

  const output = latestExecution?.output as Record<string, unknown> | undefined;
  const marketTrends = output?.market_trends as Array<Record<string, unknown>> | undefined;
  const competitorBenchmarks = output?.competitor_benchmarks as Array<Record<string, unknown>> | undefined;
  const intelligenceReport = output?.intelligence_report as string | undefined;
  const isRunning = latestExecution?.status === "PENDING" || latestExecution?.status === "RUNNING";

  return (
    <div className="space-y-6">
      {error && (
        <div className="glass-panel p-3 border border-red-500/30 bg-red-500/10">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Competitor Management */}
      <GlassCard title="Competitor Management">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {competitors.length === 0 ? (
              <p className="text-white/40 text-sm">No competitors added yet.</p>
            ) : (
              competitors.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25 text-sm"
                >
                  {name}
                  <button
                    onClick={() => handleRemove(name)}
                    disabled={actionLoading}
                    className="ml-1 text-blue-400/60 hover:text-red-400 transition-colors"
                    aria-label={`Remove ${name}`}
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a competitor..."
              className="glass-input flex-1"
              disabled={actionLoading}
            />
            <GlassButton onClick={handleAdd} disabled={actionLoading || !newCompetitor.trim()}>
              Add
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* Run Analysis */}
      <GlassCard title="Market Intelligence Analysis">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">
              Run the AI market intelligence agent to analyze competitors, identify market trends,
              and benchmark capabilities.
            </p>
            {latestExecution && (
              <p className="text-white/30 text-xs mt-2">
                Last run: {new Date(latestExecution.createdAt).toLocaleString()} &mdash;{" "}
                <GlassBadge
                  variant={
                    latestExecution.status === "COMPLETED"
                      ? "success"
                      : latestExecution.status === "FAILED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {latestExecution.status}
                </GlassBadge>
              </p>
            )}
          </div>
          <GlassButton
            onClick={runMarketIntelligence}
            disabled={actionLoading || isRunning || competitors.length === 0}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Run Market Intelligence"
            )}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Results: Market Trends */}
      {latestExecution?.status === "COMPLETED" && marketTrends && marketTrends.length > 0 && (
        <GlassCard title="Market Trends">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Capability</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Trends</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Disruption Risk</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Opportunity Score</th>
                </tr>
              </thead>
              <tbody>
                {marketTrends.map((trend, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-slate-200">{String(trend.capability || "")}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(trend.trends) ? trend.trends : []).map((t: unknown, i: number) => (
                          <GlassBadge key={i} variant="info">{String(t)}</GlassBadge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <GlassBadge
                        variant={
                          String(trend.disruption_risk) === "high"
                            ? "danger"
                            : String(trend.disruption_risk) === "medium"
                              ? "warning"
                              : "success"
                        }
                      >
                        {String(trend.disruption_risk || "N/A")}
                      </GlassBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">{String(trend.opportunity_score ?? "N/A")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Results: Competitor Benchmarks */}
      {latestExecution?.status === "COMPLETED" && competitorBenchmarks && competitorBenchmarks.length > 0 && (
        <GlassCard title="Competitor Benchmarks">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Capability</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Maturity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Benchmark</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Position</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Gap</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Investments</th>
                </tr>
              </thead>
              <tbody>
                {competitorBenchmarks.map((bench, idx) => {
                  const position = String(bench.competitive_position || "").toLowerCase();
                  return (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-slate-200">{String(bench.capability || "")}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{String(bench.maturity ?? "N/A")}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{String(bench.benchmark ?? "N/A")}</td>
                      <td className="px-4 py-3">
                        <GlassBadge variant={positionColors[position] || "default"}>
                          {String(bench.competitive_position || "N/A")}
                        </GlassBadge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{String(bench.gap ?? "N/A")}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(bench.investments) ? bench.investments : []).map((inv: unknown, i: number) => (
                            <GlassBadge key={i} variant="default">{String(inv)}</GlassBadge>
                          ))}
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

      {/* Results: Intelligence Report */}
      {latestExecution?.status === "COMPLETED" && intelligenceReport && (
        <GlassCard title="Intelligence Report">
          <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap">
            {intelligenceReport}
          </div>
        </GlassCard>
      )}

      {/* Failed execution */}
      {latestExecution?.status === "FAILED" && latestExecution.errorMessage && (
        <GlassCard title="Execution Failed">
          <p className="text-red-400 text-sm">{latestExecution.errorMessage}</p>
        </GlassCard>
      )}
    </div>
  );
}
