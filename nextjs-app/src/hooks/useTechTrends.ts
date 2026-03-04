"use client";

import { useState, useEffect, useCallback } from "react";

export interface TechTrend {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  description?: string | null;
  maturityLevel: string;
  impactScore: number;
  adoptionTimeline?: string | null;
  source: string;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

interface AddTrendInput {
  name: string;
  category: string;
  maturityLevel: string;
  description?: string;
  impactScore?: number;
  adoptionTimeline?: string;
}

interface UpdateTrendInput {
  name?: string;
  category?: string;
  maturityLevel?: string;
  description?: string | null;
  impactScore?: number;
  adoptionTimeline?: string | null;
}

export function useTechTrends(organizationId?: string) {
  const [trends, setTrends] = useState<TechTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTrends = useCallback(async () => {
    if (!organizationId) {
      setTrends([]);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ organizationId });
      const res = await fetch(`/api/context/tech-trends?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch tech trends");
      const data = await res.json();
      setTrends(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tech trends");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const addTrend = useCallback(
    async (input: AddTrendInput) => {
      if (!organizationId) return false;
      setActionLoading(true);
      try {
        const res = await fetch("/api/context/tech-trends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, organizationId }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to add tech trend");
        }
        await fetchTrends();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add tech trend");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [organizationId, fetchTrends]
  );

  const updateTrend = useCallback(
    async (id: string, input: UpdateTrendInput) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/context/tech-trends/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to update tech trend");
        }
        await fetchTrends();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update tech trend");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchTrends]
  );

  const deleteTrend = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/context/tech-trends/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete tech trend");
        await fetchTrends();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete tech trend");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchTrends]
  );

  return {
    trends,
    loading,
    error,
    actionLoading,
    addTrend,
    updateTrend,
    deleteTrend,
    refetch: fetchTrends,
  };
}
