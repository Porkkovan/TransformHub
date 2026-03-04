"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface AgentExecution {
  id: string;
  agentType: string;
  status: string;
  output?: Record<string, unknown> | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export function useCompetitorIntelligence(organizationId?: string) {
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [latestExecution, setLatestExecution] = useState<AgentExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrg = useCallback(async () => {
    if (!organizationId) {
      setCompetitors([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/organizations/${organizationId}`);
      if (!res.ok) throw new Error("Failed to fetch organization");
      const data = await res.json();
      setCompetitors(data.competitors || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load competitors");
    }
  }, [organizationId]);

  const fetchLatestExecution = useCallback(async () => {
    if (!organizationId) {
      setLatestExecution(null);
      return;
    }
    try {
      const params = new URLSearchParams({
        agentType: "market_intelligence",
        limit: "1",
      });
      const res = await fetch(`/api/agents/executions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch executions");
      const data = await res.json();
      setLatestExecution(data[0] || null);
    } catch {
      // Non-critical — silently ignore
    }
  }, [organizationId]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchOrg(), fetchLatestExecution()]);
  }, [fetchOrg, fetchLatestExecution]);

  useEffect(() => {
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const updateCompetitors = useCallback(
    async (newCompetitors: string[]) => {
      if (!organizationId) return false;
      setActionLoading(true);
      try {
        const res = await fetch(`/api/organizations/${organizationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competitors: newCompetitors }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to update competitors");
        }
        setCompetitors(newCompetitors);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update competitors");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [organizationId]
  );

  const runMarketIntelligence = useCallback(async () => {
    if (!organizationId) return false;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: "market_intelligence",
          inputData: { competitors },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to start market intelligence");
      }
      const { executionId } = await res.json();

      // Set initial execution state
      setLatestExecution({
        id: executionId,
        agentType: "market_intelligence",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      });

      // Poll for completion
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/agents/status/${executionId}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();

          if (statusData.status === "COMPLETED" || statusData.status === "FAILED") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            // Refetch full execution with output
            await fetchLatestExecution();
            setActionLoading(false);
          } else {
            setLatestExecution((prev) =>
              prev ? { ...prev, status: statusData.status } : prev
            );
          }
        } catch {
          // Polling error — will retry on next interval
        }
      }, 3000);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run market intelligence");
      setActionLoading(false);
      return false;
    }
  }, [organizationId, competitors, fetchLatestExecution]);

  return {
    competitors,
    latestExecution,
    loading,
    error,
    actionLoading,
    updateCompetitors,
    runMarketIntelligence,
    refetch,
  };
}
