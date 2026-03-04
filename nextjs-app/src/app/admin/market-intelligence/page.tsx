"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";

interface MarketTrend {
  name: string;
  direction: string;
  impact: string;
  description: string;
}

interface CompetitorBenchmark {
  name: string;
  marketShare: string;
  strengths: string[];
  weaknesses: string[];
  threatLevel: string;
}

interface MarketOpportunity {
  title: string;
  potential: string;
  timeframe: string;
  description: string;
}

interface MarketIntelligenceResults {
  trends: MarketTrend[];
  competitors: CompetitorBenchmark[];
  opportunities: MarketOpportunity[];
  overallThreatLevel: string;
  summary: string;
}

export default function MarketIntelligencePage() {
  const { currentOrg } = useOrganization();
  const { execute, execution, loading: agentLoading } = useAgentExecution();
  const [results, setResults] = useState<MarketIntelligenceResults | null>(null);

  useEffect(() => {
    if (execution?.status === "COMPLETED" && execution.output) {
      setResults(execution.output as unknown as MarketIntelligenceResults);
    }
  }, [execution]);

  const handleRunAgent = () =>
    execute("market_intelligence", {}, undefined, currentOrg?.id);

  const threatVariant = (level: string) => {
    switch (level.toUpperCase()) {
      case "CRITICAL":
        return "danger" as const;
      case "HIGH":
        return "warning" as const;
      case "MEDIUM":
        return "info" as const;
      case "LOW":
        return "success" as const;
      default:
        return "default" as const;
    }
  };

  const impactVariant = (impact: string) => {
    switch (impact.toUpperCase()) {
      case "HIGH":
        return "danger" as const;
      case "MEDIUM":
        return "warning" as const;
      case "LOW":
        return "success" as const;
      default:
        return "default" as const;
    }
  };

  const trendsFound = results?.trends?.length ?? 0;
  const competitorsAnalyzed = results?.competitors?.length ?? 0;
  const marketOpportunities = results?.opportunities?.length ?? 0;
  const threatLevel = results?.overallThreatLevel ?? "N/A";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Market Intelligence
          </h1>
          <p className="text-white/50 mt-1">
            Competitive landscape analysis and market trend monitoring
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRunAgent} disabled={agentLoading}>
          {agentLoading ? "Analyzing..." : "Run Market Intelligence Agent"}
        </GlassButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
          <p className="text-xs text-white/40 uppercase">Trends Found</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">
            {trendsFound}
          </p>
          <p className="text-xs text-white/30 mt-1">Market signals detected</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <p className="text-xs text-white/40 uppercase">
            Competitors Analyzed
          </p>
          <p className="text-3xl font-bold text-purple-400 mt-1">
            {competitorsAnalyzed}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Benchmarked organizations
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">
            Market Opportunities
          </p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {marketOpportunities}
          </p>
          <p className="text-xs text-white/30 mt-1">Growth vectors identified</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Threat Level</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{threatLevel}</p>
          <p className="text-xs text-white/30 mt-1">
            Overall competitive threat
          </p>
        </div>
      </div>

      {/* Agent Status */}
      {execution && execution.status !== "COMPLETED" && (
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-white/80 text-sm">
              Agent is {execution.status.toLowerCase()}...
            </p>
          </div>
        </GlassCard>
      )}

      {/* Market Trends */}
      <GlassCard title="Market Trends">
        <div className="space-y-3">
          {results?.trends && results.trends.length > 0 ? (
            results.trends.map((trend, i) => (
              <div
                key={i}
                className={`glass-panel-sm p-4 flex items-center justify-between border-l-4 ${
                  trend.direction === "UP"
                    ? "border-l-green-500"
                    : trend.direction === "DOWN"
                      ? "border-l-red-500"
                      : "border-l-amber-500"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white">
                      {trend.direction === "UP"
                        ? "\u2191"
                        : trend.direction === "DOWN"
                          ? "\u2193"
                          : "\u2192"}
                    </span>
                    <div>
                      <p className="text-sm text-white/80">{trend.name}</p>
                      <p className="text-xs text-white/40">
                        {trend.description}
                      </p>
                    </div>
                  </div>
                </div>
                <GlassBadge variant={impactVariant(trend.impact)}>
                  {trend.impact} IMPACT
                </GlassBadge>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm">
              No trends data yet. Run the Market Intelligence agent to analyze
              trends.
            </p>
          )}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitor Benchmarks */}
        <GlassCard title="Competitor Benchmarks">
          <div className="space-y-3">
            {results?.competitors && results.competitors.length > 0 ? (
              results.competitors.map((competitor, i) => (
                <div key={i} className="glass-panel-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-white/80">
                      {competitor.name}
                    </h4>
                    <GlassBadge variant={threatVariant(competitor.threatLevel)}>
                      {competitor.threatLevel}
                    </GlassBadge>
                  </div>
                  <p className="text-xs text-white/50 mb-2">
                    Market Share: {competitor.marketShare}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-green-400/70 mb-1">
                        Strengths
                      </p>
                      {competitor.strengths.map((s, j) => (
                        <p key={j} className="text-xs text-white/40">
                          + {s}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-red-400/70 mb-1">
                        Weaknesses
                      </p>
                      {competitor.weaknesses.map((w, j) => (
                        <p key={j} className="text-xs text-white/40">
                          - {w}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-white/40 text-sm">
                No competitor data yet. Run the agent to analyze competitors.
              </p>
            )}
          </div>
        </GlassCard>

        {/* Intelligence Report / Opportunities */}
        <GlassCard title="Intelligence Report">
          <div className="space-y-3">
            {results?.summary && (
              <div className="glass-panel-sm p-4 border-l-4 border-l-cyan-500">
                <p className="text-xs text-white/40 uppercase mb-2">
                  Executive Summary
                </p>
                <p className="text-sm text-white/80">{results.summary}</p>
              </div>
            )}
            {results?.opportunities && results.opportunities.length > 0 ? (
              results.opportunities.map((opp, i) => (
                <div
                  key={i}
                  className="glass-panel-sm p-4 border-l-4 border-l-green-500"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-white/80">
                      {opp.title}
                    </h4>
                    <GlassBadge variant="success">{opp.potential}</GlassBadge>
                  </div>
                  <p className="text-xs text-white/40">{opp.description}</p>
                  <p className="text-xs text-white/30 mt-1">
                    Timeframe: {opp.timeframe}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-white/40 text-sm">
                No opportunities identified yet. Run the agent to discover
                market opportunities.
              </p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
