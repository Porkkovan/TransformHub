"use client";

import { useMemo } from "react";
import { computeImprovementMetrics, type ImprovementMetrics } from "@/lib/value-stream-metrics";
import { formatDuration } from "@/lib/format-duration";

interface StreamStep {
  name: string;
  type: string;
  duration: number;
}

interface ValueStreamImprovementPanelProps {
  productStreams: Record<string, { currentSteps: StreamStep[]; futureSteps: StreamStep[] }>;
  products: string[];
}

export default function ValueStreamImprovementPanel({
  productStreams,
  products,
}: ValueStreamImprovementPanelProps) {
  const improvements: ImprovementMetrics[] = useMemo(() => {
    return products
      .filter((name) => productStreams[name])
      .map((name) =>
        computeImprovementMetrics(
          productStreams[name].currentSteps,
          productStreams[name].futureSteps,
          name
        )
      );
  }, [productStreams, products]);

  const totals = useMemo(() => {
    const totalCurrentLead = improvements.reduce((s, m) => s + m.currentLeadTime, 0);
    const totalFutureLead = improvements.reduce((s, m) => s + m.futureLeadTime, 0);
    const overallReduction =
      totalCurrentLead > 0
        ? ((totalCurrentLead - totalFutureLead) / totalCurrentLead) * 100
        : 0;
    return { totalCurrentLead, totalFutureLead, overallReduction };
  }, [improvements]);

  if (improvements.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Overall summary row */}
      <div className="glass-panel-sm p-4 rounded-xl border-l-4 border-l-green-500">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-green-300">Overall Improvement Summary</h3>
          <span
            className={`text-lg font-bold ${
              totals.overallReduction >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {totals.overallReduction >= 0 ? "-" : "+"}
            {formatDuration(Math.abs(totals.overallReduction))}%
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white/50">
            Total Lead Time: <span className="text-amber-400 font-medium">{formatDuration(totals.totalCurrentLead)}h</span>
            {" "}&rarr;{" "}
            <span className="text-green-400 font-medium">{formatDuration(totals.totalFutureLead)}h</span>
          </span>
        </div>
        <div className="mt-3 w-full h-2 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${Math.min(Math.max(totals.overallReduction, 0), 100)}%` }}
          />
        </div>
      </div>

      {/* Per-product rows */}
      <div className="space-y-3">
        {improvements.map((m) => (
          <div key={m.productName} className="glass-panel-sm p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-white/90">{m.productName}</h4>
              <span
                className={`text-sm font-bold ${
                  m.leadTimeReduction >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {m.leadTimeReduction >= 0 ? "-" : "+"}
                {formatDuration(Math.abs(m.leadTimeReduction))}%
              </span>
            </div>

            {/* Lead time comparison */}
            <div className="flex items-center gap-3 text-xs text-white/50 mb-2">
              <span>
                Lead Time:{" "}
                <span className="text-amber-400">{formatDuration(m.currentLeadTime)}h</span>
                {" "}&rarr;{" "}
                <span className="text-green-400">{formatDuration(m.futureLeadTime)}h</span>
              </span>
            </div>

            {/* Reduction bar */}
            <div className="w-full h-1.5 rounded-full bg-white/10 mb-3">
              <div
                className="h-full rounded-full bg-green-500/60 transition-all duration-500"
                style={{ width: `${Math.min(Math.max(m.leadTimeReduction, 0), 100)}%` }}
              />
            </div>

            {/* Manual effort & bottleneck details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-white/40">Manual Effort</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-amber-400">{formatDuration(m.currentManualPercent)}%</span>
                  <span className="text-white/30">&rarr;</span>
                  <span className="text-green-400">{formatDuration(m.futureManualPercent)}%</span>
                  {m.automationGain > 0 && (
                    <span className="text-green-400/70 ml-1">
                      (-{formatDuration(m.automationGain)}pp)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-white/40">Bottleneck</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-amber-400 truncate max-w-[100px]" title={m.currentBottleneck}>
                    {m.currentBottleneck}
                  </span>
                  <span className="text-white/30">&rarr;</span>
                  <span className="text-green-400 truncate max-w-[100px]" title={m.futureBottleneck}>
                    {m.futureBottleneck}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
