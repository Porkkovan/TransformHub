"use client";

import { useState, useEffect, useRef } from "react";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import FeedbackPanel from "@/components/agent-monitor/FeedbackPanel";
import { useAuth } from "@/contexts/AuthContext";

interface AgentExecution {
  execution_id: string;
  agent_type: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  output?: Record<string, unknown>;
}

type ReviewStatus = "pending_review" | "approved" | "rejected";

interface AgentOutputReviewPanelProps {
  execution: AgentExecution | null;
  loading: boolean;
  renderSummary: (output: Record<string, unknown>) => React.ReactNode;
  onApprove: (note: string) => void | Promise<void>;
  onReject: (note: string) => void | Promise<void>;
  onStatusChange?: (status: "approved" | "rejected") => void;
  title?: string;
}

export default function AgentOutputReviewPanel({
  execution,
  loading,
  renderSummary,
  onApprove,
  onReject,
  onStatusChange,
  title = "Agent Output Review",
}: AgentOutputReviewPanelProps) {
  const { user } = useAuth();
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const gateCreatedForExecution = useRef<string | null>(null);

  // Auto-create approval gate when execution completes
  useEffect(() => {
    if (
      execution?.status === "COMPLETED" &&
      execution.execution_id &&
      gateCreatedForExecution.current !== execution.execution_id
    ) {
      gateCreatedForExecution.current = execution.execution_id;
      fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          execution_id: execution.execution_id,
          gate_name: title,
          agent_type: execution.agent_type,
          data_for_review: execution.output ?? {},
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.id) setApprovalId(data.id);
        })
        .catch(() => {
          // Approval gate creation failed — panel still works with local state
        });
    }
  }, [execution?.status, execution?.execution_id, execution?.agent_type, execution?.output, title]);

  // Don't render if there's no execution at all
  if (!execution && !loading) return null;

  // Running / polling state — agent hasn't completed yet
  const isRunning = loading || (execution != null && execution.status !== "COMPLETED" && execution.status !== "FAILED");
  if (isRunning) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <GlassBadge variant="info">Running</GlassBadge>
        </div>
        <p className="text-sm text-white/40 mt-2">Agent is processing... Results will appear here for review.</p>
      </div>
    );
  }

  // Failed state
  if (execution?.status === "FAILED") {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-red-500/20">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <GlassBadge variant="danger">Failed</GlassBadge>
        </div>
        <p className="text-sm text-red-400/70 mt-2">
          {execution.error_message || "Agent execution failed. Please try again."}
        </p>
      </div>
    );
  }

  // Completed state — show review panel (even if output is still loading)
  if (!execution) return null;

  const hasOutput = execution.output != null && Object.keys(execution.output).length > 0;

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      if (approvalId) {
        await fetch(`/api/approvals/${approvalId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", reviewer_id: user?.id ?? "anonymous", note: reviewNote }),
        });
      }
      await onApprove(reviewNote);
      setReviewStatus("approved");
      onStatusChange?.("approved");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      if (approvalId) {
        await fetch(`/api/approvals/${approvalId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject", reviewer_id: user?.id ?? "anonymous", note: reviewNote }),
        });
      }
      await onReject(reviewNote);
      setReviewStatus("rejected");
      onStatusChange?.("rejected");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {!reviewStatus && <GlassBadge variant="warning">Pending Review</GlassBadge>}
          {reviewStatus === "approved" && <GlassBadge variant="success">Approved</GlassBadge>}
          {reviewStatus === "rejected" && <GlassBadge variant="danger">Rejected</GlassBadge>}
        </div>
        <span className="text-xs text-white/30">
          {execution.agent_type} &middot; {execution.execution_id.slice(0, 8)}
        </span>
      </div>

      {/* Output Summary */}
      <div className="glass-panel-sm rounded-xl p-4">
        {hasOutput ? (
          renderSummary(execution.output!)
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-white/50">Loading agent results...</p>
          </div>
        )}
      </div>

      {/* Approved confirmation */}
      {reviewStatus === "approved" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-green-400">Output approved and applied.</p>
          {reviewNote && <p className="text-xs text-white/40 ml-auto">Note: {reviewNote}</p>}
        </div>
      )}

      {/* Rejected notice */}
      {reviewStatus === "rejected" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-sm text-red-400">Output rejected.</p>
          {reviewNote && <p className="text-xs text-white/40 ml-auto">Note: {reviewNote}</p>}
        </div>
      )}

      {/* Review Controls — shown only when pending */}
      {!reviewStatus && (
        <>
          <div>
            <label className="block text-sm text-white/50 mb-2">Reviewer Note (optional)</label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add context about your decision..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <GlassButton
              variant="danger"
              onClick={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Reject"}
            </GlassButton>
            <GlassButton
              variant="success"
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Approve"}
            </GlassButton>
          </div>
        </>
      )}

      {/* Feedback Panel — shown after decision */}
      {reviewStatus && (
        <FeedbackPanel executionId={execution.execution_id} />
      )}
    </div>
  );
}
