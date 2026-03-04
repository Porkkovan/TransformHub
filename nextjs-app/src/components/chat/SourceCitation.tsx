"use client";

import GlassBadge from "@/components/ui/GlassBadge";

interface Source {
  source: string;
  category: string;
  similarity: number;
}

interface SourceCitationProps {
  sources: Source[];
}

const categoryIcon: Record<string, string> = {
  CURRENT_STATE: "📄",
  FUTURE_STATE: "🔮",
  COMPETITOR: "🏢",
  TECH_TREND: "📈",
};

export default function SourceCitation({ sources }: SourceCitationProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {sources.map((src, i) => (
        <div
          key={i}
          className="glass-panel-sm px-3 py-1.5 flex items-center gap-1.5 text-xs"
        >
          <span>{categoryIcon[src.category] || "📎"}</span>
          <span className="text-white/60">{src.source}</span>
          <GlassBadge
            variant={src.similarity >= 0.8 ? "success" : src.similarity >= 0.6 ? "warning" : "danger"}
          >
            {(src.similarity * 100).toFixed(0)}%
          </GlassBadge>
        </div>
      ))}
    </div>
  );
}
