import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useApprovals } from "../useApprovals";

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleApiApprovals = [
  {
    id: "appr-1",
    execution_id: "exec-100",
    gate_name: "transition_approval",
    agent_type: "discovery",
    status: "PENDING",
    data_for_review: { summary: "Review transition plan" },
    reviewer_id: null,
    reviewer_note: null,
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "appr-2",
    execution_id: "exec-100",
    gate_name: "risk_approval",
    agent_type: "risk_compliance",
    status: "APPROVED",
    data_for_review: { risk_score: 7 },
    reviewer_id: "user-42",
    reviewer_note: "Looks good",
    created_at: "2026-01-15T09:00:00Z",
    updated_at: "2026-01-15T09:30:00Z",
  },
  {
    id: "appr-3",
    execution_id: "exec-101",
    gate_name: "deploy_approval",
    agent_type: "architecture",
    status: "REJECTED",
    data_for_review: { reason: "Not ready" },
    reviewer_id: "user-43",
    reviewer_note: "Missing compliance docs",
    created_at: "2026-01-14T08:00:00Z",
    updated_at: "2026-01-14T08:15:00Z",
  },
];

describe("useApprovals", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Initial fetch
  // -----------------------------------------------------------------------

  it("fetches approvals on mount and maps snake_case to camelCase", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals,
    });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/approvals");
    expect(result.current.approvals).toHaveLength(3);

    // Verify camelCase mapping
    const first = result.current.approvals[0];
    expect(first.executionId).toBe("exec-100");
    expect(first.gateName).toBe("transition_approval");
    expect(first.agentType).toBe("discovery");
    expect(first.dataForReview).toEqual({ summary: "Review transition plan" });
    expect(first.createdAt).toBe("2026-01-15T10:00:00Z");
    expect(first.updatedAt).toBe("2026-01-15T10:00:00Z");
  });

  // -----------------------------------------------------------------------
  // Status counts
  // -----------------------------------------------------------------------

  it("computes pendingCount, approvedCount, rejectedCount correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals,
    });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.approvedCount).toBe(1);
    expect(result.current.rejectedCount).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Filtering via query params
  // -----------------------------------------------------------------------

  it("passes status filter as query parameter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [sampleApiApprovals[0]],
    });

    const { result } = renderHook(() =>
      useApprovals({ status: "PENDING" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/approvals?status=PENDING");
  });

  it("passes executionId filter as query parameter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [sampleApiApprovals[0], sampleApiApprovals[1]],
    });

    const { result } = renderHook(() =>
      useApprovals({ executionId: "exec-100" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/approvals?execution_id=exec-100"
    );
  });

  it("passes both status and executionId filters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() =>
      useApprovals({ status: "PENDING", executionId: "exec-100" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/approvals?status=PENDING&execution_id=exec-100"
    );
  });

  // -----------------------------------------------------------------------
  // Fetch error
  // -----------------------------------------------------------------------

  it("sets error when fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch approvals");
    expect(result.current.approvals).toEqual([]);
  });

  it("sets error when fetch throws network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Connection refused");
  });

  // -----------------------------------------------------------------------
  // approveGate
  // -----------------------------------------------------------------------

  it("approveGate sends POST to /api/approvals/{id}/approve and refetches", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals,
    });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Approve call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "APPROVED" }),
    });
    // Refetch after approve
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals.map((a) =>
        a.id === "appr-1" ? { ...a, status: "APPROVED" } : a
      ),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.approveGate("appr-1", "user-99", "Approved!");
    });

    expect(success).toBe(true);

    // Verify the approve POST call
    expect(mockFetch).toHaveBeenCalledWith("/api/approvals/appr-1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer_id: "user-99", note: "Approved!" }),
    });

    // actionLoading should be cleared
    expect(result.current.actionLoading).toBeNull();
  });

  it("approveGate returns false and sets error on failure", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals,
    });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Approve fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Gate already resolved" }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.approveGate("appr-1", "user-99");
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("Gate already resolved");
    expect(result.current.actionLoading).toBeNull();
  });

  // -----------------------------------------------------------------------
  // rejectGate
  // -----------------------------------------------------------------------

  it("rejectGate sends POST to /api/approvals/{id}/reject and refetches", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals,
    });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Reject call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "REJECTED" }),
    });
    // Refetch after reject
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals.map((a) =>
        a.id === "appr-1" ? { ...a, status: "REJECTED" } : a
      ),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.rejectGate(
        "appr-1",
        "user-99",
        "Not ready for production"
      );
    });

    expect(success).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith("/api/approvals/appr-1/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewer_id: "user-99",
        note: "Not ready for production",
      }),
    });
  });

  it("rejectGate returns false and sets error on failure", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals,
    });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Reject fails with network error
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.rejectGate("appr-1", "user-99");
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("Network timeout");
    expect(result.current.actionLoading).toBeNull();
  });

  // -----------------------------------------------------------------------
  // refetch
  // -----------------------------------------------------------------------

  it("refetch re-fetches approvals and clears previous error", async () => {
    // Initial fetch fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.error).toBe("Failed to fetch approvals");
    });

    // Manual refetch succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleApiApprovals,
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.approvals).toHaveLength(3);
  });

  // -----------------------------------------------------------------------
  // Default empty note
  // -----------------------------------------------------------------------

  it("approveGate uses empty string as default note", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useApprovals());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "APPROVED" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await act(async () => {
      await result.current.approveGate("appr-1", "user-99");
    });

    // Check that note defaults to ""
    const approveCall = mockFetch.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("/approve")
    );
    expect(approveCall).toBeDefined();
    const body = JSON.parse(approveCall![1].body);
    expect(body.note).toBe("");
  });
});
