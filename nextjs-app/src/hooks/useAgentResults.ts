"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface AgentExecution {
  execution_id: string;
  agent_type: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  output?: Record<string, unknown>;
}

export function useAgentResults(agentType: string) {
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [execution, setExecution] = useState<AgentExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/executions?agentType=${agentType}&limit=1`);
      if (!res.ok) throw new Error("Failed to fetch executions");
      const data = await res.json();
      if (data.length > 0) {
        const exec = data[0];
        setExecution(exec);
        if (exec.status === "COMPLETED" && exec.output) {
          setResults(exec.output);
        } else if (exec.status === "COMPLETED" && exec.id) {
          const resultsRes = await fetch(`/api/agents/results/${exec.id}`);
          if (resultsRes.ok) {
            const resultsData = await resultsRes.json();
            setResults(resultsData.output || null);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [agentType]);

  useEffect(() => {
    fetchLatest();
    return () => stopPolling();
  }, [fetchLatest, stopPolling]);

  const pollStatus = useCallback(async (executionId: string) => {
    try {
      const res = await fetch(`/api/agents/status/${executionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setExecution(data);

      if (data.status === "COMPLETED" || data.status === "FAILED") {
        stopPolling();
        setRunning(false);
        if (data.status === "COMPLETED") {
          const resultsRes = await fetch(`/api/agents/results/${executionId}`);
          if (resultsRes.ok) {
            const resultsData = await resultsRes.json();
            setResults(resultsData.output || null);
          }
        }
      }
    } catch {
      // polling failure, will retry
    }
  }, [stopPolling]);

  const runAgent = useCallback(async (organizationId?: string) => {
    setRunning(true);
    setError(null);
    stopPolling();

    try {
      const res = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType, inputData: {}, organizationId }),
      });
      if (!res.ok) throw new Error("Failed to execute agent");
      const data = await res.json();

      setExecution({
        execution_id: data.executionId,
        agent_type: agentType,
        status: "PENDING",
      });

      intervalRef.current = setInterval(() => pollStatus(data.executionId), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
      setRunning(false);
    }
  }, [agentType, pollStatus, stopPolling]);

  return { results, execution, loading, running, error, runAgent, refetch: fetchLatest };
}
