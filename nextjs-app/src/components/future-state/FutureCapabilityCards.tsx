"use client";

import React from "react";

interface FutureCapability {
  name: string;
  category: string;
  businessImpact: "HIGH" | "MEDIUM" | "LOW";
  complexity: "HIGH" | "MEDIUM" | "LOW";
  techStack: string[];
  description: string;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  riceScore?: number;
}

interface FutureCapabilityCardsProps {
  capabilities: FutureCapability[];
  onSendToRoadmap?: () => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  RPA_AUTOMATION: {
    bg: "bg-orange-500/20",
    text: "text-orange-300",
    border: "border-orange-500/30",
  },
  AI_ML_INTEGRATION: {
    bg: "bg-blue-500/20",
    text: "text-blue-300",
    border: "border-blue-500/30",
  },
  AGENT_BASED: {
    bg: "bg-purple-500/20",
    text: "text-purple-300",
    border: "border-purple-500/30",
  },
  CONVERSATIONAL_AI: {
    bg: "bg-green-500/20",
    text: "text-green-300",
    border: "border-green-500/30",
  },
  ADVANCED_ANALYTICS: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-300",
    border: "border-cyan-500/30",
  },
};

const DEFAULT_CATEGORY_STYLE = {
  bg: "bg-white/10",
  text: "text-slate-300",
  border: "border-white/10",
};

const IMPACT_STYLES: Record<string, string> = {
  HIGH: "bg-red-500/20 text-red-300 border border-red-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  LOW: "bg-green-500/20 text-green-300 border border-green-500/30",
};

function formatCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export default function FutureCapabilityCards({
  capabilities,
  onSendToRoadmap,
}: FutureCapabilityCardsProps) {
  return (
    <div>
      {onSendToRoadmap && (
        <div className="flex justify-end mb-3">
          <button
            onClick={onSendToRoadmap}
            className="glass-button !text-xs"
          >
            Send to Roadmap
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {capabilities.map((cap, i) => {
          const catStyle = CATEGORY_STYLES[cap.category] || DEFAULT_CATEGORY_STYLE;

          return (
            <div key={`${i}-${cap.name}`} className="glass-panel-sm p-5 flex flex-col gap-3">
              {/* Category Badge + RICE Score */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                >
                  {formatCategory(cap.category)}
                </span>
                {cap.riceScore !== undefined && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    RICE: {cap.riceScore.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Capability Name */}
              <h4 className="text-sm font-semibold text-white/90">
                {cap.name}
              </h4>

              {/* Description */}
              <p className="text-xs text-white/50 leading-relaxed">
                {cap.description}
              </p>

              {/* RICE Breakdown (if present) */}
              {cap.reach !== undefined && (
                <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                  <span>R:{cap.reach}</span>
                  <span className="text-white/20">·</span>
                  <span>I:{cap.impact}</span>
                  <span className="text-white/20">·</span>
                  <span>C:{cap.confidence}</span>
                  <span className="text-white/20">/</span>
                  <span>E:{cap.effort}</span>
                </div>
              )}

              {/* Impact & Complexity Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${IMPACT_STYLES[cap.businessImpact]}`}
                >
                  Impact: {cap.businessImpact}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${IMPACT_STYLES[cap.complexity]}`}
                >
                  Complexity: {cap.complexity}
                </span>
              </div>

              {/* Tech Stack Tags */}
              <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-white/5">
                {(cap.techStack ?? []).map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/40 border border-white/5"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
