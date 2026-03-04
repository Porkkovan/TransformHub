"use client";

import React, { useState } from "react";

export interface LeanVSMStep {
  id?: string;
  name: string;
  processTime: number; // hours
  waitTime: number;    // hours
  classification: "value-adding" | "bottleneck" | "waste";
}

interface LeanVSMBoardProps {
  steps: LeanVSMStep[];
  /** Label prefix for mode-specific display (e.g. "Future State") */
  mode?: "current" | "future";
}

function formatTime(h: number): string {
  if (h <= 0) return "0";
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}

export default function LeanVSMBoard({ steps, mode = "current" }: LeanVSMBoardProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (steps.length === 0) {
    return (
      <p className="text-xs text-white/25 py-6 text-center">
        No steps to display
      </p>
    );
  }

  // Aggregate metrics
  const totalPt = steps.reduce((s, x) => s + x.processTime, 0);
  const totalWt = steps.reduce((s, x) => s + x.waitTime, 0);
  const totalLt = totalPt + totalWt || 0.001;
  const fe = (totalPt / totalLt) * 100;

  const feColor =
    fe >= 40 ? "text-green-400" : fe >= 20 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-3">
      {/* ── Metrics header ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Total Lead Time", value: formatTime(totalLt), cls: "text-white" },
          { label: "Process Time",    value: formatTime(totalPt), cls: "text-blue-400" },
          { label: "Wait Time",       value: formatTime(totalWt), cls: "text-amber-400" },
          { label: "Flow Efficiency", value: `${fe.toFixed(1)}%`, cls: feColor },
        ].map(({ label, value, cls }) => (
          <div key={label} className="glass-panel-sm rounded-xl p-3">
            <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
            <p className={`text-base font-bold mt-0.5 ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Horizontal step flow ── */}
      <div className="overflow-x-auto pb-3">
        <div className="flex items-stretch min-w-max gap-0 py-1">
          {steps.map((step, i) => {
            const isFirst = i === 0;
            const isLast  = i === steps.length - 1;
            const lt      = step.processTime + step.waitTime || 0.001;
            const ptPct   = (step.processTime / lt) * 100;
            const stepFe  = ptPct;
            const isBottleneck = step.classification === "bottleneck";
            const isWaste      = step.classification === "waste";
            const isExpanded   = expandedIdx === i;

            // Border color
            const borderCls = isFirst
              ? "border-green-500"
              : isLast
              ? "border-blue-400"
              : isBottleneck
              ? "border-orange-500"
              : isWaste
              ? "border-red-500"
              : "border-blue-500/40";

            // Type label
            const typeLabel = isFirst ? "START" : isLast ? "END" : "PROCESS";
            const typeLabelCls = isFirst
              ? "text-green-400"
              : isLast
              ? "text-blue-400"
              : "text-white/35";

            return (
              <React.Fragment key={i}>
                {/* ── Step card ── */}
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className={`w-48 shrink-0 border-2 ${borderCls} rounded-xl p-3 glass-panel-sm text-left space-y-2 transition-colors hover:bg-white/3 ${
                    isExpanded ? "ring-1 ring-white/10" : ""
                  } ${isBottleneck ? "bg-orange-500/5" : ""}`}
                >
                  {/* Type chip */}
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${typeLabelCls}`}>
                    {typeLabel}
                  </p>

                  {/* Step name */}
                  <p className="text-[11px] font-semibold text-white leading-snug min-h-[2rem] line-clamp-2">
                    {step.name}
                  </p>

                  {/* Bottleneck indicator */}
                  {isBottleneck && (
                    <p className="text-[9px] text-orange-400 flex items-center gap-0.5">
                      ⚠ Bottleneck
                    </p>
                  )}

                  {/* Process time row */}
                  <div>
                    <div className="flex justify-between items-center text-[10px] mb-0.5">
                      <span className="text-white/40">Process</span>
                      <span className="text-blue-300 font-medium">
                        {formatTime(step.processTime)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${ptPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Wait time row */}
                  <div>
                    <div className="flex justify-between items-center text-[10px] mb-0.5">
                      <span className="text-white/40">Wait</span>
                      <span className="text-amber-300 font-medium">
                        {formatTime(step.waitTime)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${100 - ptPct}%` }}
                      />
                    </div>
                  </div>

                  {/* FE indicator */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-medium ${
                        stepFe >= 40
                          ? "text-green-400"
                          : stepFe >= 20
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      FE {stepFe.toFixed(0)}%
                    </span>
                    <div className="flex items-center gap-1">
                      {step.classification === "value-adding" && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/20 font-medium">
                          VA
                        </span>
                      )}
                      {(isBottleneck || isWaste) && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 font-medium">
                          BNVA
                        </span>
                      )}
                      {mode === "future" && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 font-medium">
                          Future
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-white/5 text-[10px] text-white/50 space-y-1">
                      <p>
                        Lead time:{" "}
                        <span className="text-white/75 font-medium">{formatTime(lt)}</span>
                      </p>
                      <p>
                        % of total LT:{" "}
                        <span className="text-white/75 font-medium">
                          {((lt / totalLt) * 100).toFixed(1)}%
                        </span>
                      </p>
                    </div>
                  )}
                </button>

                {/* Arrow connector */}
                {!isLast && (
                  <div className="flex items-center justify-center w-5 shrink-0">
                    <svg
                      className="w-4 h-4 text-white/20"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 text-[10px] text-white/30 border-t border-white/5 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-1.5 bg-blue-500 rounded" />
          <span>Process time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-1.5 bg-amber-400 rounded" />
          <span>Wait time</span>
        </div>
        <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/20 font-medium ml-2">
          VA
        </span>
        <span className="text-white/30">Value-add</span>
        <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 font-medium">
          BNVA
        </span>
        <span className="text-white/30">Non-value-add</span>
        <span className="ml-auto italic">Click a step to expand details</span>
      </div>
    </div>
  );
}
