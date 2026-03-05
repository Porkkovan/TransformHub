"use client";

import React from "react";

interface ConfidenceBadgeProps {
  confidence?: number | null;
  sources?: string[];
  showSources?: boolean;
  size?: "sm" | "xs";
}

const SOURCE_LABELS: Record<string, string> = {
  url_analysis:     "URL",
  openapi_spec:     "API",
  github_structure: "GH",
  github_tests:     "Tests",
  db_schema:        "DB",
  context_document: "Docs",
  integration_data: "Jira/Conf",
  questionnaire:    "Q",
};

const SOURCE_COLORS: Record<string, string> = {
  url_analysis:     "bg-white/10 text-white/50",
  openapi_spec:     "bg-blue-500/20 text-blue-300",
  github_structure: "bg-gray-500/20 text-gray-300",
  github_tests:     "bg-emerald-500/20 text-emerald-300",
  db_schema:        "bg-orange-500/20 text-orange-300",
  context_document: "bg-purple-500/20 text-purple-300",
  integration_data: "bg-cyan-500/20 text-cyan-300",
  questionnaire:    "bg-amber-500/20 text-amber-300",
};

function confidenceColor(c: number): string {
  if (c >= 0.8) return "text-green-400 bg-green-400/10 border-green-400/30";
  if (c >= 0.6) return "text-amber-400 bg-amber-400/10 border-amber-400/30";
  return "text-red-400 bg-red-400/10 border-red-400/30";
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return "High";
  if (c >= 0.6) return "Medium";
  return "Low";
}

export default function ConfidenceBadge({
  confidence,
  sources = [],
  showSources = true,
  size = "sm",
}: ConfidenceBadgeProps) {
  if (confidence == null) return null;

  const pct = Math.round(confidence * 100);
  const colorClass = confidenceColor(confidence);
  const textSize = size === "xs" ? "text-[9px]" : "text-[10px]";
  const padClass = size === "xs" ? "px-1.5 py-0.5" : "px-2 py-0.5";

  // Deduplicate sources, omit url_analysis if other sources present
  const displaySources =
    sources.length > 1 ? sources.filter((s) => s !== "url_analysis") : sources;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {/* Confidence score chip */}
      <span
        className={`inline-flex items-center gap-1 rounded border font-mono font-medium ${colorClass} ${textSize} ${padClass}`}
        title={`Confidence: ${pct}% (${confidenceLabel(confidence)})`}
      >
        <span>{pct}%</span>
        <span className="opacity-60">{confidenceLabel(confidence)}</span>
      </span>

      {/* Source chips */}
      {showSources && displaySources.length > 0 && displaySources.map((src) => (
        <span
          key={src}
          className={`inline-flex items-center rounded ${textSize} px-1.5 py-0.5 ${SOURCE_COLORS[src] || "bg-white/10 text-white/50"}`}
          title={src.replace(/_/g, " ")}
        >
          {SOURCE_LABELS[src] || src}
        </span>
      ))}
    </span>
  );
}
