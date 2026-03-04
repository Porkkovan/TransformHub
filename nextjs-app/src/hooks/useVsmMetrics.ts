"use client";

import { useState, useEffect, useCallback } from "react";

interface VsmMetric {
  id: string;
  processTime: number;
  leadTime: number;
  waitTime: number;
  flowEfficiency: number;
  mermaidSource?: string;
  digitalCapabilityId: string;
  digitalCapability?: {
    id: string;
    name: string;
    category?: string;
  };
}

export function useVsmMetrics(digitalCapabilityId?: string, organizationId?: string) {
  const [metrics, setMetrics] = useState<VsmMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    // Don't fetch when no specific capability is selected — avoids returning all-org metrics
    if (!digitalCapabilityId) {
      setMetrics([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("digitalCapabilityId", digitalCapabilityId);
      if (organizationId) params.set("organizationId", organizationId);
      const query = `?${params.toString()}`;
      const res = await fetch(`/api/vsm${query}`);
      if (!res.ok) throw new Error("Failed to fetch VSM metrics");
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [digitalCapabilityId, organizationId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
}
