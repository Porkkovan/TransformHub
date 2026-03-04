"use client";

import { useState, useCallback } from "react";

export interface SearchResult {
  id: string;
  content: string;
  chunkIndex: number;
  source: string;
  category: string;
  subCategory: string | null;
  documentId: string;
  similarity: number | null;
}

export function useContextSearch(organizationId?: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string, category?: string) => {
      if (!organizationId || !query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          organizationId,
          query: query.trim(),
          limit: "20",
        });
        if (category) params.set("category", category);

        const res = await fetch(`/api/context/search?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to search context");
        const data = await res.json();
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, loading, error, search, clear };
}
