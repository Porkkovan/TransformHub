"use client";

import React, { useMemo } from "react";
import { formatDuration } from "@/lib/format-duration";

interface StreamStep {
  name: string;
  type: "manual" | "automated" | "ai" | "agent";
  duration: number;
  product?: string;
}

interface ValueStreamComparisonPanelProps {
  currentSteps: StreamStep[];
  futureSteps: StreamStep[];
}

const TYPE_STYLES: Record<StreamStep["type"], { bg: string; border: string; label: string }> = {
  manual: {
    bg: "bg-gray-500/20",
    border: "border-gray-500/40",
    label: "Manual",
  },
  automated: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/40",
    label: "Automated",
  },
  ai: {
    bg: "bg-purple-500/20",
    border: "border-purple-500/40",
    label: "AI",
  },
  agent: {
    bg: "bg-green-500/20",
    border: "border-green-500/40",
    label: "Agent",
  },
};

function StepCard({ step }: { step: StreamStep }) {
  const style = TYPE_STYLES[step.type];
  return (
    <div className={`${style.bg} border ${style.border} rounded-lg px-4 py-3`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">{step.name}</span>
        <span className="text-xs text-white/50 ml-2 whitespace-nowrap">
          {formatDuration(step.duration)}h
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] text-white/40 uppercase tracking-wide">
          {style.label}
        </span>
        {step.product && (
          <span className="text-[10px] text-blue-300/70 bg-blue-500/10 px-1.5 py-0.5 rounded">
            {step.product}
          </span>
        )}
      </div>
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex justify-center py-1">
      <svg
        width="12"
        height="16"
        viewBox="0 0 12 16"
        fill="none"
        className="text-white/20"
      >
        <path
          d="M6 0v12M1 8l5 6 5-6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function ValueStreamComparisonPanel({
  currentSteps,
  futureSteps,
}: ValueStreamComparisonPanelProps) {
  const currentTotal = useMemo(
    () => currentSteps.reduce((sum, s) => sum + s.duration, 0),
    [currentSteps]
  );

  const futureTotal = useMemo(
    () => futureSteps.reduce((sum, s) => sum + s.duration, 0),
    [futureSteps]
  );

  const improvement = useMemo(() => {
    if (currentTotal === 0) return 0;
    return ((currentTotal - futureTotal) / currentTotal) * 100;
  }, [currentTotal, futureTotal]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Current State Column */}
      <div className="glass-panel-sm p-5 border-l-4 border-l-amber-500">
        <h4 className="text-sm font-semibold text-amber-300 mb-4">
          Current State
        </h4>
        <div className="space-y-0">
          {currentSteps.map((step, idx) => (
            <React.Fragment key={`current-${step.name}-${idx}`}>
              <StepCard step={step} />
              {idx < currentSteps.length - 1 && <ArrowDown />}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 uppercase">
              Total Duration
            </span>
            <span className="text-lg font-bold text-amber-400">
              {formatDuration(currentTotal)}h
            </span>
          </div>
        </div>
      </div>

      {/* Future State Column */}
      <div className="glass-panel-sm p-5 border-l-4 border-l-green-500">
        <h4 className="text-sm font-semibold text-green-300 mb-4">
          Future State
        </h4>
        <div className="space-y-0">
          {futureSteps.map((step, idx) => (
            <React.Fragment key={`future-${step.name}-${idx}`}>
              <StepCard step={step} />
              {idx < futureSteps.length - 1 && <ArrowDown />}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 uppercase">
              Total Duration
            </span>
            <span className="text-lg font-bold text-green-400">
              {formatDuration(futureTotal)}h
            </span>
          </div>
        </div>
      </div>

      {/* Improvement Summary */}
      <div className="md:col-span-2 glass-panel-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">
            Process Duration Improvement
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">
              {formatDuration(currentTotal)}h &rarr; {formatDuration(futureTotal)}h
            </span>
            <span
              className={`text-lg font-bold ${
                improvement >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {improvement >= 0 ? "-" : "+"}
              {Math.abs(improvement).toFixed(2)}%
            </span>
          </div>
        </div>
        {/* Visual improvement bar */}
        <div className="mt-3 w-full h-2 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{
              width: `${Math.min(Math.max(improvement, 0), 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
