"use client";

import { useState, useEffect, useCallback } from "react";

export interface ProductDiagrams {
  solution: string;
  technical: string;
  sequence: string;
}

export interface ArchitectureResults {
  architecture_diagrams?: {
    functional?: string;
    technical?: string;
    solution?: string;
    products?: Record<string, ProductDiagrams>;
  };
  current_architecture?: string | Record<string, unknown>;
  target_architecture?: string | Record<string, unknown>;
  migration_plan?: string | Record<string, unknown>;
  [key: string]: unknown;
}

export function useArchitectureResults(repositoryId?: string, organizationId?: string) {
  const [architecture, setArchitecture] = useState<ArchitectureResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (repositoryId) searchParams.set("repositoryId", repositoryId);
      if (organizationId) searchParams.set("organizationId", organizationId);
      const qs = searchParams.toString();
      const res = await fetch(`/api/architecture-results${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch architecture results");
      const data = await res.json();
      setArchitecture(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load architecture");
    } finally {
      setLoading(false);
    }
  }, [repositoryId, organizationId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { architecture, loading, error, refetch: fetchResults };
}
