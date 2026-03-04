"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface AgentExecution {
  execution_id: string;
  agent_type: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  output?: Record<string, unknown>;
}

const STORAGE_KEY = "lastAgentExecution";

function saveExecution(exec: AgentExecution | null) {
  if (typeof window === "undefined") return;
  if (exec) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exec));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadExecution(): AgentExecution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const exec: AgentExecution = JSON.parse(raw);
    // Don't restore terminal states older than 30 minutes
    if (exec.status === "COMPLETED" || exec.status === "FAILED") {
      const completedAt = exec.completed_at ? new Date(exec.completed_at).getTime() : 0;
      if (Date.now() - completedAt > 30 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    return exec;
  } catch {
    return null;
  }
}

export function useAgentExecution() {
  const [execution, setExecutionState] = useState<AgentExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const setExecution = useCallback((exec: AgentExecution | null | ((prev: AgentExecution | null) => AgentExecution | null)) => {
    setExecutionState((prev) => {
      const next = typeof exec === "function" ? exec(prev) : exec;
      saveExecution(next);
      return next;
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (executionId: string) => {
    try {
      const res = await fetch(`/api/agents/status/${executionId}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setExecution(data);

      if (data.status === "COMPLETED" || data.status === "FAILED") {
        stopPolling();
        if (data.status === "COMPLETED") {
          const resultsRes = await fetch(`/api/agents/results/${executionId}`);
          if (resultsRes.ok) {
            const results = await resultsRes.json();
            setExecution((prev) => prev ? { ...prev, output: results.output } : prev);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polling failed");
    }
  }, [stopPolling, setExecution]);

  // On mount: restore persisted execution and resume polling if still running
  useEffect(() => {
    const saved = loadExecution();
    if (!saved) return;
    setExecutionState(saved);

    if (saved.status !== "COMPLETED" && saved.status !== "FAILED") {
      // Still in-flight — resume polling
      setLoading(true);
      intervalRef.current = setInterval(() => pollStatus(saved.execution_id), 2000);
      pollStatus(saved.execution_id).finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const execute = useCallback(async (agentType: string, inputData: Record<string, unknown> = {}, repositoryId?: string, organizationId?: string) => {
    setLoading(true);
    setError(null);
    setExecution(null);
    stopPolling();

    try {
      const res = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType, inputData, repositoryId, organizationId }),
      });
      if (!res.ok) throw new Error("Failed to execute agent");
      const data = await res.json();

      const initial: AgentExecution = {
        execution_id: data.executionId,
        agent_type: agentType,
        status: "PENDING",
      };
      setExecution(initial);

      intervalRef.current = setInterval(() => pollStatus(data.executionId), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setLoading(false);
    }
  }, [pollStatus, stopPolling, setExecution]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { execution, loading, error, execute, stopPolling };
}
