"use client";

import React, { useMemo } from "react";

interface RiskAssessment {
  id: string;
  riskCategory: string;
  riskScore: number;
  severity: string;
  description?: string;
  mitigationPlan?: string;
  transitionBlocked: boolean;
}

interface RiskCategoryBreakdownProps {
  risks: RiskAssessment[];
}

const CATEGORIES = ["OPERATIONAL", "REGULATORY", "TECHNOLOGY", "DATA_PRIVACY"];

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

function severityBadgeStyle(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500/20 text-red-300 border border-red-500/30";
    case "HIGH":
      return "bg-orange-500/20 text-orange-300 border border-orange-500/30";
    case "MEDIUM":
      return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    case "LOW":
      return "bg-green-500/20 text-green-300 border border-green-500/30";
    default:
      return "bg-white/10 text-slate-300 border border-white/10";
  }
}

function scoreBarColor(avgScore: number): {
  bar: string;
  text: string;
  border: string;
} {
  if (avgScore > 7) {
    return {
      bar: "bg-red-500",
      text: "text-red-400",
      border: "border-l-red-500",
    };
  }
  if (avgScore >= 4) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-400",
      border: "border-l-amber-500",
    };
  }
  return {
    bar: "bg-green-500",
    text: "text-green-400",
    border: "border-l-green-500",
  };
}

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

interface CategoryData {
  category: string;
  risks: RiskAssessment[];
  avgScore: number;
  severityCounts: Record<string, number>;
}

export default function RiskCategoryBreakdown({
  risks,
}: RiskCategoryBreakdownProps) {
  const categoryData = useMemo<CategoryData[]>(() => {
    return CATEGORIES.map((category) => {
      const categoryRisks = risks.filter(
        (r) => r.riskCategory === category
      );
      const avgScore =
        categoryRisks.length > 0
          ? categoryRisks.reduce((sum, r) => sum + r.riskScore, 0) /
            categoryRisks.length
          : 0;

      const severityCounts: Record<string, number> = {};
      for (const sev of SEVERITY_ORDER) {
        const count = categoryRisks.filter((r) => r.severity === sev).length;
        if (count > 0) {
          severityCounts[sev] = count;
        }
      }

      return { category, risks: categoryRisks, avgScore, severityCounts };
    });
  }, [risks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {categoryData.map((data) => {
        const colors = scoreBarColor(data.avgScore);
        return (
          <div
            key={data.category}
            className={`glass-panel-sm p-5 border-l-4 ${colors.border}`}
          >
            {/* Category Header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white/90">
                {formatCategory(data.category)}
              </h4>
              <span className="text-xs text-white/40">
                {data.risks.length} risk{data.risks.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Average Score + Visual Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/40 uppercase">
                  Avg Score
                </span>
                <span className={`text-lg font-bold ${colors.text}`}>
                  {data.avgScore.toFixed(1)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                  style={{ width: `${Math.min((data.avgScore / 10) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Severity Breakdown Badges */}
            {Object.keys(data.severityCounts).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {SEVERITY_ORDER.filter((sev) => data.severityCounts[sev]).map(
                  (sev) => (
                    <span
                      key={sev}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${severityBadgeStyle(sev)}`}
                    >
                      {data.severityCounts[sev]} {sev}
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="text-xs text-white/30">No risks assessed</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
