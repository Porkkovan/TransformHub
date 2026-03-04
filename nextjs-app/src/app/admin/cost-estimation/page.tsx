"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";

interface CostCategory {
  category: string;
  description: string;
  oneTimeCost: number;
  recurringCost: number;
  confidence: string;
  items: { name: string; cost: number; type: string }[];
}

interface ROIProjection {
  year: number;
  investment: number;
  savings: number;
  netBenefit: number;
  cumulativeROI: number;
}

interface CostEstimationResults {
  costBreakdown: CostCategory[];
  roiProjections: ROIProjection[];
  totalInvestment: number;
  annualSavings: number;
  paybackPeriodMonths: number;
  threeYearROI: number;
  summary: string;
}

export default function CostEstimationPage() {
  const { currentOrg } = useOrganization();
  const { execute, execution, loading: agentLoading } = useAgentExecution();
  const [results, setResults] = useState<CostEstimationResults | null>(null);

  useEffect(() => {
    if (execution?.status === "COMPLETED" && execution.output) {
      setResults(execution.output as unknown as CostEstimationResults);
    }
  }, [execution]);

  const handleRunAgent = () =>
    execute("cost_estimation", {}, undefined, currentOrg?.id);

  const confidenceVariant = (confidence: string) => {
    switch (confidence.toUpperCase()) {
      case "HIGH":
        return "success" as const;
      case "MEDIUM":
        return "warning" as const;
      case "LOW":
        return "danger" as const;
      default:
        return "default" as const;
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const totalInvestment = results?.totalInvestment ?? 0;
  const annualSavings = results?.annualSavings ?? 0;
  const paybackPeriod = results?.paybackPeriodMonths ?? 0;
  const threeYearROI = results?.threeYearROI ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cost Estimation</h1>
          <p className="text-white/50 mt-1">
            Investment analysis, cost breakdown, and ROI projections
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRunAgent} disabled={agentLoading}>
          {agentLoading ? "Analyzing..." : "Run Cost Estimation Agent"}
        </GlassButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Total Investment</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">
            {totalInvestment > 0 ? formatCurrency(totalInvestment) : "$0"}
          </p>
          <p className="text-xs text-white/30 mt-1">
            All-in transformation cost
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Annual Savings</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {annualSavings > 0 ? formatCurrency(annualSavings) : "$0"}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Projected yearly benefit
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Payback Period</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">
            {paybackPeriod > 0
              ? paybackPeriod < 12
                ? `${paybackPeriod}mo`
                : `${(paybackPeriod / 12).toFixed(1)}yr`
              : "N/A"}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Time to break even
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <p className="text-xs text-white/40 uppercase">3-Year ROI</p>
          <p
            className={`text-3xl font-bold mt-1 ${
              threeYearROI >= 100
                ? "text-green-400"
                : threeYearROI >= 50
                  ? "text-amber-400"
                  : "text-purple-400"
            }`}
          >
            {threeYearROI > 0 ? `${threeYearROI}%` : "N/A"}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Return on investment
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

      {/* Cost Breakdown */}
      <GlassCard title="Cost Breakdown">
        <div className="space-y-4">
          {results?.costBreakdown && results.costBreakdown.length > 0 ? (
            results.costBreakdown.map((category, i) => (
              <div
                key={i}
                className="glass-panel-sm p-4 border-l-4 border-l-blue-500"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white/80">
                      {category.category}
                    </h4>
                    <p className="text-xs text-white/40">
                      {category.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <GlassBadge
                      variant={confidenceVariant(category.confidence)}
                    >
                      {category.confidence} confidence
                    </GlassBadge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="px-3 py-2 rounded bg-white/5">
                    <p className="text-xs text-white/40">One-time Cost</p>
                    <p className="text-lg font-bold text-white/80">
                      {formatCurrency(category.oneTimeCost)}
                    </p>
                  </div>
                  <div className="px-3 py-2 rounded bg-white/5">
                    <p className="text-xs text-white/40">
                      Recurring (Annual)
                    </p>
                    <p className="text-lg font-bold text-white/80">
                      {formatCurrency(category.recurringCost)}
                    </p>
                  </div>
                </div>
                {category.items.length > 0 && (
                  <div className="space-y-1">
                    {category.items.map((item, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between px-3 py-1.5 rounded bg-white/5"
                      >
                        <span className="text-xs text-white/50">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/30">
                            {item.type}
                          </span>
                          <span className="text-xs font-medium text-white/70">
                            {formatCurrency(item.cost)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm">
              No cost data yet. Run the Cost Estimation agent to analyze
              investment requirements.
            </p>
          )}
        </div>
      </GlassCard>

      {/* ROI Projections */}
      <GlassCard title="ROI Projections">
        <div className="space-y-3">
          {results?.roiProjections && results.roiProjections.length > 0 ? (
            <>
              <div className="grid grid-cols-5 gap-4 px-3 py-2 text-xs text-white/40 uppercase border-b border-white/10">
                <span>Year</span>
                <span className="text-right">Investment</span>
                <span className="text-right">Savings</span>
                <span className="text-right">Net Benefit</span>
                <span className="text-right">Cumulative ROI</span>
              </div>
              {results.roiProjections.map((proj, i) => (
                <div
                  key={i}
                  className="glass-panel-sm p-3 grid grid-cols-5 gap-4 items-center"
                >
                  <span className="text-sm font-bold text-white/80">
                    Year {proj.year}
                  </span>
                  <span className="text-sm text-red-400/80 text-right">
                    -{formatCurrency(proj.investment)}
                  </span>
                  <span className="text-sm text-green-400/80 text-right">
                    +{formatCurrency(proj.savings)}
                  </span>
                  <span
                    className={`text-sm font-medium text-right ${
                      proj.netBenefit >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {proj.netBenefit >= 0 ? "+" : ""}
                    {formatCurrency(Math.abs(proj.netBenefit))}
                  </span>
                  <span
                    className={`text-sm font-bold text-right ${
                      proj.cumulativeROI >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {proj.cumulativeROI}%
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-white/40 text-sm">
              No ROI projections yet. Run the agent to generate financial
              forecasts.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
