"use client";

import { useState, useEffect, useCallback } from "react";

export interface Approval {
  id: string;
  executionId: string;
  gateName: string;
  agentType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  dataForReview?: Record<string, unknown>;
  reviewerId?: string;
  reviewerNote?: string;
  createdAt: string;
  updatedAt: string;
}

interface UseApprovalsOptions {
  status?: string;
  executionId?: string;
  pollInterval?: number;
}

export function useApprovals(options: UseApprovalsOptions = {}) {
  const { status: filterStatus, executionId, pollInterval } = options;
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (executionId) params.set("execution_id", executionId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/approvals${query}`);
      if (!res.ok) throw new Error("Failed to fetch approvals");
      const data = await res.json();

      // Map snake_case API response to camelCase
      const mapped: Approval[] = data.map((item: Record<string, unknown>) => ({
        id: item.id,
        executionId: item.execution_id ?? item.executionId,
        gateName: item.gate_name ?? item.gateName,
        agentType: item.agent_type ?? item.agentType,
        status: item.status,
        dataForReview: item.data_for_review ?? item.dataForReview,
        reviewerId: item.reviewer_id ?? item.reviewerId,
        reviewerNote: item.reviewer_note ?? item.reviewerNote,
        createdAt: item.created_at ?? item.createdAt,
        updatedAt: item.updated_at ?? item.updatedAt,
      }));

      setApprovals(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, executionId]);

  useEffect(() => {
    fetchApprovals();

    if (pollInterval && pollInterval > 0) {
      const interval = setInterval(fetchApprovals, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchApprovals, pollInterval]);

  const approveGate = useCallback(
    async (approvalId: string, reviewerId: string, note: string = "") => {
      setActionLoading(approvalId);
      try {
        const res = await fetch(`/api/approvals/${approvalId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewer_id: reviewerId, note }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to approve");
        }
        await fetchApprovals();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approve failed");
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [fetchApprovals]
  );

  const rejectGate = useCallback(
    async (approvalId: string, reviewerId: string, note: string = "") => {
      setActionLoading(approvalId);
      try {
        const res = await fetch(`/api/approvals/${approvalId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewer_id: reviewerId, note }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to reject");
        }
        await fetchApprovals();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reject failed");
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [fetchApprovals]
  );

  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;
  const approvedCount = approvals.filter((a) => a.status === "APPROVED").length;
  const rejectedCount = approvals.filter((a) => a.status === "REJECTED").length;

  return {
    approvals,
    loading,
    error,
    actionLoading,
    refetch: fetchApprovals,
    approveGate,
    rejectGate,
    pendingCount,
    approvedCount,
    rejectedCount,
  };
}
