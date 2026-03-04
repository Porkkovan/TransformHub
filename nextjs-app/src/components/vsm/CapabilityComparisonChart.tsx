"use client";

import { useMemo } from "react";

interface CapabilityMetric {
  name: string;
  processTime: number;
  waitTime: number;
  flowEfficiency: number;
}

interface CapabilityComparisonChartProps {
  capabilities: CapabilityMetric[];
}

export default function CapabilityComparisonChart({
  capabilities,
}: CapabilityComparisonChartProps) {
  const sorted = useMemo(
    () => [...capabilities].sort((a, b) => b.flowEfficiency - a.flowEfficiency),
    [capabilities]
  );

  // Compute max total time to normalise bar widths
  const maxTotal = useMemo(() => {
    let max = 0;
    for (const cap of sorted) {
      const total = cap.processTime + cap.waitTime;
      if (total > max) max = total;
    }
    return max || 1;
  }, [sorted]);

  return (
    <div className="glass-panel-sm p-6">
      <h3 className="text-lg font-semibold text-white mb-1">
        Capability Comparison
      </h3>
      <p className="text-xs text-white/40 mb-6">
        Flow efficiency across capabilities — sorted highest first
      </p>

      <div className="space-y-4">
        {sorted.map((cap, i) => {
          const total = cap.processTime + cap.waitTime;
          const processPercent = total > 0 ? (cap.processTime / total) * 100 : 0;
          const waitPercent = total > 0 ? (cap.waitTime / total) * 100 : 0;
          const barWidth = (total / maxTotal) * 100;

          return (
            <div key={`${i}-${cap.name}`}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-sm font-medium text-white truncate max-w-[60%]"
                  title={cap.name}
                >
                  {cap.name}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    cap.flowEfficiency >= 40
                      ? "text-green-400"
                      : cap.flowEfficiency >= 20
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {cap.flowEfficiency.toFixed(1)}%
                </span>
              </div>

              {/* Stacked bar */}
              <div className="w-full h-5 rounded-md bg-white/5 overflow-hidden">
                <div
                  className="h-full flex"
                  style={{ width: `${barWidth}%` }}
                >
                  {/* Process time (green) */}
                  <div
                    className="h-full bg-green-500/50 transition-all duration-300"
                    style={{ width: `${processPercent}%` }}
                    title={`Process: ${cap.processTime}h`}
                  />
                  {/* Wait time (red) */}
                  <div
                    className="h-full bg-red-500/40 transition-all duration-300"
                    style={{ width: `${waitPercent}%` }}
                    title={`Wait: ${cap.waitTime}h`}
                  />
                </div>
              </div>

              {/* Detail line */}
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[10px] text-green-400/70">
                  Process {cap.processTime}h
                </span>
                <span className="text-[10px] text-red-400/70">
                  Wait {cap.waitTime}h
                </span>
                <span className="text-[10px] text-white/30">
                  Total {total}h
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-5 mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-green-500/50" />
          <span className="text-[10px] text-white/40">Process Time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-red-500/40" />
          <span className="text-[10px] text-white/40">Wait Time</span>
        </div>
      </div>
    </div>
  );
}
