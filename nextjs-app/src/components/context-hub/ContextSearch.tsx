"use client";

import { useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassSelect from "@/components/ui/GlassSelect";
import { useContextSearch } from "@/hooks/useContextSearch";

const categoryOptions = [
  { value: "", label: "All Categories" },
  { value: "CURRENT_STATE", label: "Current State" },
  { value: "FUTURE_STATE", label: "Future State" },
  { value: "COMPETITOR", label: "Competitor" },
  { value: "TECH_TREND", label: "Tech Trend" },
];

interface ContextSearchProps {
  organizationId: string;
}

export default function ContextSearch({ organizationId }: ContextSearchProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const { results, loading, error, search, clear } = useContextSearch(organizationId);

  const handleSearch = () => {
    if (query.trim()) {
      search(query, category || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const similarityVariant = (score: number): "success" | "warning" | "danger" => {
    if (score >= 0.8) return "success";
    if (score >= 0.6) return "warning";
    return "danger";
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <GlassCard>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-white/40 mb-1">Search Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search your context documents..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs text-white/40 mb-1">Category</label>
            <GlassSelect
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions}
            />
          </div>
          <GlassButton onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? "Searching..." : "Search"}
          </GlassButton>
          {results.length > 0 && (
            <GlassButton
              variant="default"
              onClick={() => {
                clear();
                setQuery("");
              }}
            >
              Clear
            </GlassButton>
          )}
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <div className="glass-panel p-4 border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <GlassCard title={`Results (${results.length})`}>
          <div className="space-y-3">
            {results.map((result) => (
              <div key={result.id} className="glass-panel-sm p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <p className="text-sm text-white/80 flex-1">
                    {result.content.length > 200
                      ? result.content.slice(0, 200) + "..."
                      : result.content}
                  </p>
                  {result.similarity != null && (
                    <GlassBadge variant={similarityVariant(result.similarity)}>
                      {(result.similarity * 100).toFixed(1)}%
                    </GlassBadge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">{result.source}</span>
                  <GlassBadge variant="info">{result.category}</GlassBadge>
                  {result.subCategory && (
                    <span className="text-xs text-white/30">{result.subCategory}</span>
                  )}
                  <span className="text-xs text-white/20">Chunk #{result.chunkIndex}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && query.trim() === "" && (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/40 text-sm">Enter a query to search across your context documents using semantic similarity.</p>
        </div>
      )}

      {/* No results after search */}
      {!loading && results.length === 0 && !error && query.trim() !== "" && (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/40 text-sm">No results found for &ldquo;{query}&rdquo;. Try a different query or category.</p>
        </div>
      )}
    </div>
  );
}
