"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface StreamEvent {
  type: string;
  status?: string;
  execution_id?: string;
  node?: string;
  output?: Record<string, unknown>;
  error?: string;
  timestamp?: string;
}

interface AgentStreamState {
  execution_id: string | null;
  status: string;
  events: StreamEvent[];
  output: Record<string, unknown> | null;
  error: string | null;
  currentNode: string | null;
}

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    execution_id: null,
    status: "IDLE",
    events: [],
    output: null,
    error: null,
    currentNode: null,
  });
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connectStream = useCallback((executionId: string) => {
    closeStream();

    const es = new EventSource(`/api/agents/stream/${executionId}`);
    eventSourceRef.current = es;

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data) as StreamEvent;
      setState((prev) => ({
        ...prev,
        status: data.status || prev.status,
        events: [...prev.events, data],
      }));
    });

    es.addEventListener("node_start", (e) => {
      const data = JSON.parse(e.data) as StreamEvent;
      setState((prev) => ({
        ...prev,
        currentNode: data.node || null,
        events: [...prev.events, data],
      }));
    });

    es.addEventListener("node_end", (e) => {
      const data = JSON.parse(e.data) as StreamEvent;
      setState((prev) => ({
        ...prev,
        events: [...prev.events, data],
      }));
    });

    es.addEventListener("completed", (e) => {
      const data = JSON.parse(e.data) as StreamEvent;
      setState((prev) => ({
        ...prev,
        status: "COMPLETED",
        output: data.output || null,
        currentNode: null,
        events: [...prev.events, data],
      }));
      closeStream();
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as StreamEvent;
        setState((prev) => ({
          ...prev,
          status: "FAILED",
          error: data.error || "Agent execution failed",
          currentNode: null,
          events: [...prev.events, data],
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          status: "FAILED",
          error: "Stream connection lost",
        }));
      }
      closeStream();
    });

    es.addEventListener("close", () => {
      closeStream();
    });

    es.onerror = () => {
      // EventSource will auto-reconnect; we just log the transient error
    };
  }, [closeStream]);

  const execute = useCallback(async (
    agentType: string,
    inputData: Record<string, unknown> = {},
    repositoryId?: string,
    organizationId?: string,
  ) => {
    setLoading(true);
    setState({
      execution_id: null,
      status: "PENDING",
      events: [],
      output: null,
      error: null,
      currentNode: null,
    });

    try {
      const res = await fetch("/api/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType, inputData, repositoryId, organizationId }),
      });

      if (!res.ok) throw new Error("Failed to execute agent");
      const data = await res.json();

      setState((prev) => ({
        ...prev,
        execution_id: data.executionId,
      }));

      connectStream(data.executionId);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "FAILED",
        error: err instanceof Error ? err.message : "Execution failed",
      }));
    } finally {
      setLoading(false);
    }
  }, [connectStream]);

  useEffect(() => {
    return () => closeStream();
  }, [closeStream]);

  return {
    ...state,
    loading,
    execute,
    closeStream,
  };
}
