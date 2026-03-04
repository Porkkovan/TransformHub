"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface AgentStatus {
  agentType: string;
  status: "PENDING" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  durationMs?: number;
}

export interface PipelineStatus {
  pipelineId: string;
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt?: string;
  completedAt?: string;
  agentStatuses: AgentStatus[];
  currentLayer?: number;
  totalLayers?: number;
}

export function usePipeline() {
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/pipeline?pipelineId=${id}`);
      if (!res.ok) throw new Error("Failed to fetch pipeline status");
      const data: PipelineStatus = await res.json();
      setStatus(data);

      if (data.status === "COMPLETED" || data.status === "FAILED" || data.status === "CANCELLED") {
        stopPolling();
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to poll pipeline status");
    }
  }, [stopPolling]);

  const execute = useCallback(async (organizationId?: string) => {
    setLoading(true);
    setError(null);
    setStatus(null);
    stopPolling();

    try {
      const res = await fetch("/api/pipeline/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error("Failed to start pipeline execution");
      const data = await res.json();

      const id = data.pipelineId;
      setPipelineId(id);
      setStatus({
        pipelineId: id,
        status: "RUNNING",
        startedAt: new Date().toISOString(),
        agentStatuses: [],
        currentLayer: 0,
        totalLayers: data.totalLayers ?? 5,
      });

      // Poll every 3 seconds
      intervalRef.current = setInterval(() => pollStatus(id), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start pipeline");
      setLoading(false);
    }
  }, [pollStatus, stopPolling]);

  // Fetch initial status on mount
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await fetch("/api/pipeline");
        if (res.ok) {
          const data: PipelineStatus = await res.json();
          if (data.pipelineId) {
            setPipelineId(data.pipelineId);
            setStatus(data);

            // If pipeline is still running, start polling
            if (data.status === "RUNNING") {
              setLoading(true);
              intervalRef.current = setInterval(() => pollStatus(data.pipelineId), 3000);
            }
          }
        }
      } catch {
        // No existing pipeline
      }
    };
    fetchInitial();

    return () => stopPolling();
  }, [pollStatus, stopPolling]);

  const [actionLoading, setActionLoading] = useState(false);

  const retryAgent = useCallback(async (agentType: string) => {
    if (!pipelineId) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/pipeline/${pipelineId}/agents/${agentType}/retry`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to retry agent");
      // Refetch pipeline status
      await pollStatus(pipelineId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry agent");
    } finally {
      setActionLoading(false);
    }
  }, [pipelineId, pollStatus]);

  const skipAgent = useCallback(async (agentType: string) => {
    if (!pipelineId) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/pipeline/${pipelineId}/agents/${agentType}/skip`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to skip agent");
      // Refetch pipeline status
      await pollStatus(pipelineId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to skip agent");
    } finally {
      setActionLoading(false);
    }
  }, [pipelineId, pollStatus]);

  const agentStatuses = status?.agentStatuses ?? [];

  return {
    pipelineId,
    status,
    agentStatuses,
    loading,
    actionLoading,
    error,
    execute,
    retryAgent,
    skipAgent,
    stopPolling,
  };
}
