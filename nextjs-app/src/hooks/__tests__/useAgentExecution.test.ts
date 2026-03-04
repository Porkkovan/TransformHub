import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAgentExecution } from "../useAgentExecution";

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useAgentExecution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it("returns correct initial state", () => {
    const { result } = renderHook(() => useAgentExecution());

    expect(result.current.execution).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.execute).toBe("function");
    expect(typeof result.current.stopPolling).toBe("function");
  });

  // -----------------------------------------------------------------------
  // execute – happy path
  // -----------------------------------------------------------------------

  it("calls /api/agents/execute and sets PENDING execution", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-123" }),
    });

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("discovery", { org: "Acme" });
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/agents/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentType: "discovery",
        inputData: { org: "Acme" },
        repositoryId: undefined,
      }),
    });

    expect(result.current.execution).toEqual(
      expect.objectContaining({
        execution_id: "exec-123",
        agent_type: "discovery",
        status: "PENDING",
      })
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // -----------------------------------------------------------------------
  // execute – API failure
  // -----------------------------------------------------------------------

  it("sets error when execute fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("discovery");
    });

    expect(result.current.error).toBe("Failed to execute agent");
    expect(result.current.execution).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("sets error when execute fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("discovery");
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.loading).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Polling – status transitions
  // -----------------------------------------------------------------------

  it("polls for status and stops when COMPLETED, then fetches results", async () => {
    // 1. execute call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-456" }),
    });

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("lean_vsm");
    });

    // 2. First poll – still running
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        execution_id: "exec-456",
        agent_type: "lean_vsm",
        status: "RUNNING",
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    // Allow pending promises to resolve
    await act(async () => {});

    expect(result.current.execution?.status).toBe("RUNNING");

    // 3. Second poll – COMPLETED + results fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        execution_id: "exec-456",
        agent_type: "lean_vsm",
        status: "COMPLETED",
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output: { score: 42 } }),
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.execution?.status).toBe("COMPLETED");
    });

    // Verify results were fetched
    expect(mockFetch).toHaveBeenCalledWith("/api/agents/results/exec-456");
  });

  it("stops polling when status is FAILED", async () => {
    // Execute
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-789" }),
    });

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("architecture");
    });

    // First poll – FAILED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        execution_id: "exec-789",
        agent_type: "architecture",
        status: "FAILED",
        error_message: "Agent crashed",
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {});

    expect(result.current.execution?.status).toBe("FAILED");

    // No results fetch should have been attempted for FAILED status
    const resultsFetchCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/results/")
    );
    expect(resultsFetchCalls).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Polling – error during polling
  // -----------------------------------------------------------------------

  it("sets error when poll status fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-poll-err" }),
    });

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("discovery");
    });

    // Poll returns non-ok
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {});

    expect(result.current.error).toBe("Failed to fetch status");
  });

  // -----------------------------------------------------------------------
  // stopPolling
  // -----------------------------------------------------------------------

  it("stopPolling prevents further poll calls", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-stop" }),
    });

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("discovery");
    });

    const callCountAfterExecute = mockFetch.mock.calls.length;

    act(() => {
      result.current.stopPolling();
    });

    await act(async () => {
      vi.advanceTimersByTime(10000); // Advance well past several intervals
    });

    // No new fetch calls should have been made after stopping
    expect(mockFetch.mock.calls.length).toBe(callCountAfterExecute);
  });

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------

  it("cleans up polling interval on unmount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-unmount" }),
    });

    const { result, unmount } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("discovery");
    });

    const callCountAfterExecute = mockFetch.mock.calls.length;

    unmount();

    vi.advanceTimersByTime(10000);

    // No new fetch calls after unmount
    expect(mockFetch.mock.calls.length).toBe(callCountAfterExecute);
  });

  // -----------------------------------------------------------------------
  // Re-execute resets state
  // -----------------------------------------------------------------------

  it("resets state when executing a new agent", async () => {
    // First execution
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-first" }),
    });

    const { result } = renderHook(() => useAgentExecution());

    await act(async () => {
      await result.current.execute("discovery");
    });

    expect(result.current.execution?.execution_id).toBe("exec-first");

    // Second execution – should reset
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ executionId: "exec-second" }),
    });

    await act(async () => {
      await result.current.execute("architecture");
    });

    expect(result.current.execution?.execution_id).toBe("exec-second");
    expect(result.current.execution?.agent_type).toBe("architecture");
    expect(result.current.error).toBeNull();
  });
});
