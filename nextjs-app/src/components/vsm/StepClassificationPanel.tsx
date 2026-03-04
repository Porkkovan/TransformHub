"use client";

import { useMemo } from "react";
import { formatDuration } from "@/lib/format-duration";

interface Step {
  name: string;
  classification: "value-adding" | "bottleneck" | "waste";
  duration: number;
  percentOfLeadTime: number;
  /** Actual process time from Excel (if available) */
  processTime?: number;
  /** Actual wait time from Excel (if available) */
  waitTime?: number;
}

interface StepClassificationPanelProps {
  steps: Step[];
}

const classificationConfig: Record<
  Step["classification"],
  { border: string; bg: string; text: string; label: string }
> = {
  "value-adding": {
    border: "border-l-green-500",
    bg: "bg-green-500/10",
    text: "text-green-400",
    label: "Value-Adding",
  },
  bottleneck: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    label: "Bottleneck",
  },
  waste: {
    border: "border-l-red-500",
    bg: "bg-red-500/10",
    text: "text-red-400",
    label: "Waste",
  },
};

export default function StepClassificationPanel({
  steps,
}: StepClassificationPanelProps) {
  const counts = useMemo(() => {
    const result = { "value-adding": 0, bottleneck: 0, waste: 0 };
    for (const step of steps) {
      result[step.classification]++;
    }
    return result;
  }, [steps]);

  return (
    <div className="space-y-4">
      {/* Summary line */}
      <div className="flex flex-wrap items-center gap-4">
        {(
          ["value-adding", "bottleneck", "waste"] as Step["classification"][]
        ).map((classification) => {
          const config = classificationConfig[classification];
          return (
            <div key={classification} className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${config.bg} border ${
                  classification === "value-adding"
                    ? "border-green-500/30"
                    : classification === "bottleneck"
                    ? "border-amber-500/30"
                    : "border-red-500/30"
                }`}
              />
              <span className="text-xs text-white/40">
                {config.label}
              </span>
              <span className={`text-sm font-semibold ${config.text}`}>
                {counts[classification]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step cards */}
      <div className="flex flex-wrap gap-3">
        {steps.map((step, i) => {
          const config = classificationConfig[step.classification];

          return (
            <div
              key={`${i}-${step.name}`}
              className={`glass-panel-sm border-l-[3px] ${config.border} p-4 min-w-[200px] flex-1 max-w-[320px]`}
            >
              {/* Step name */}
              <p className="text-sm font-medium text-white truncate" title={step.name}>
                {step.name}
              </p>

              {/* Classification badge */}
              <span
                className={`inline-block mt-1.5 text-[10px] font-medium uppercase tracking-wider ${config.text}`}
              >
                {config.label}
              </span>

              {/* Timing — show PT/WT split when available, else combined duration */}
              {step.processTime !== undefined && step.waitTime !== undefined ? (
                <div className="mt-3 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-white/40">Process Time</span>
                    <span className="text-sm font-semibold text-green-400">{formatDuration(step.processTime)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-white/40">Wait Time</span>
                    <span className="text-sm font-semibold text-red-400">{formatDuration(step.waitTime)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-white/40">Duration</span>
                  <span className="text-sm font-semibold text-white">
                    {formatDuration(step.duration)}
                  </span>
                </div>
              )}

              {/* Percentage bar */}
              <div className="mt-2">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-white/40">Lead time</span>
                  <span className={`text-xs font-medium ${config.text}`}>
                    {step.percentOfLeadTime.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${config.bg} ${
                      step.classification === "value-adding"
                        ? "bg-green-500/40"
                        : step.classification === "bottleneck"
                        ? "bg-amber-500/40"
                        : "bg-red-500/40"
                    }`}
                    style={{ width: `${Math.min(step.percentOfLeadTime, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
