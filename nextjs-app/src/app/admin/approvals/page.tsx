"use client";

import { useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassModal from "@/components/ui/GlassModal";
import { useApprovals, Approval } from "@/hooks/useApprovals";
import { useAuth } from "@/contexts/AuthContext";

export default function ApprovalsPage() {
  const {
    approvals,
    loading,
    error,
    actionLoading,
    refetch,
    approveGate,
    rejectGate,
    pendingCount,
    approvedCount,
    rejectedCount,
  } = useApprovals({ pollInterval: 5000 });

  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);

  const { user } = useAuth();
  const reviewerId = user?.id ?? "unknown";

  const filteredApprovals = approvals.filter((a) => {
    if (activeFilter === "ALL") return true;
    return a.status === activeFilter;
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "warning" as const;
      case "APPROVED":
        return "success" as const;
      case "REJECTED":
        return "danger" as const;
      default:
        return "default" as const;
    }
  };

  const agentTypeLabel = (agentType: string) =>
    agentType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const handleApprove = async () => {
    if (!selectedApproval) return;
    const success = await approveGate(selectedApproval.id, reviewerId, reviewNote);
    if (success) {
      setShowApproveModal(false);
      setSelectedApproval(null);
      setReviewNote("");
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    const success = await rejectGate(selectedApproval.id, reviewerId, reviewNote);
    if (success) {
      setShowRejectModal(false);
      setSelectedApproval(null);
      setReviewNote("");
    }
  };

  const openApproveModal = (approval: Approval) => {
    setSelectedApproval(approval);
    setReviewNote("");
    setShowApproveModal(true);
  };

  const openRejectModal = (approval: Approval) => {
    setSelectedApproval(approval);
    setReviewNote("");
    setShowRejectModal(true);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Gates</h1>
          <p className="text-white/50 mt-1">
            Review and manage pipeline approval requests
          </p>
        </div>
        <GlassButton onClick={refetch}>Refresh</GlassButton>
      </div>

      {error && (
        <div className="glass-panel p-4 border border-red-500/30">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Pending</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{pendingCount}</p>
          <p className="text-xs text-white/30 mt-1">Awaiting review</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Approved</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{approvedCount}</p>
          <p className="text-xs text-white/30 mt-1">Cleared to proceed</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Rejected</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{rejectedCount}</p>
          <p className="text-xs text-white/30 mt-1">Blocked</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
          <p className="text-xs text-white/40 uppercase">Total</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">{approvals.length}</p>
          <p className="text-xs text-white/30 mt-1">All gates</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeFilter === filter
                ? "bg-white/15 text-white border border-white/20"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
            {filter === "PENDING" && pendingCount > 0 && (
              <span className="ml-2 bg-amber-500/30 text-amber-300 text-xs px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Approvals List */}
      <GlassCard title="Approval Requests">
        <div className="space-y-3">
          {filteredApprovals.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-white/20 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-white/40 text-sm">
                {activeFilter === "PENDING"
                  ? "No pending approvals"
                  : "No approvals found"}
              </p>
            </div>
          ) : (
            filteredApprovals.map((approval) => (
              <div
                key={approval.id}
                className={`glass-panel-sm p-5 border-l-4 ${
                  approval.status === "PENDING"
                    ? "border-l-amber-500"
                    : approval.status === "APPROVED"
                    ? "border-l-green-500"
                    : "border-l-red-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-sm font-semibold text-white">
                        {approval.gateName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </h4>
                      <GlassBadge variant={statusVariant(approval.status)}>
                        {approval.status}
                      </GlassBadge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-white/50">
                      <div>
                        <span className="text-white/30">Agent: </span>
                        <span className="text-white/70">{agentTypeLabel(approval.agentType)}</span>
                      </div>
                      <div>
                        <span className="text-white/30">Execution: </span>
                        <span className="text-white/70 font-mono">{approval.executionId.slice(0, 8)}...</span>
                      </div>
                      <div>
                        <span className="text-white/30">Created: </span>
                        <span className="text-white/70">{formatDate(approval.createdAt)}</span>
                      </div>
                      {approval.reviewerId && (
                        <div>
                          <span className="text-white/30">Reviewer: </span>
                          <span className="text-white/70">{approval.reviewerId}</span>
                        </div>
                      )}
                    </div>

                    {/* Data for review preview */}
                    {approval.dataForReview && (
                      <div className="mt-3 glass-panel-sm p-3 max-h-32 overflow-y-auto">
                        <p className="text-xs text-white/30 mb-1">Review Data:</p>
                        <pre className="text-xs text-white/60 whitespace-pre-wrap break-words">
                          {JSON.stringify(approval.dataForReview, null, 2).slice(0, 500)}
                          {JSON.stringify(approval.dataForReview, null, 2).length > 500 && "..."}
                        </pre>
                      </div>
                    )}

                    {/* Reviewer note */}
                    {approval.reviewerNote && (
                      <div className="mt-2 text-xs">
                        <span className="text-white/30">Note: </span>
                        <span className="text-white/60 italic">{approval.reviewerNote}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {approval.status === "PENDING" && (
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <GlassButton
                        variant="success"
                        onClick={() => openApproveModal(approval)}
                        disabled={actionLoading === approval.id}
                      >
                        {actionLoading === approval.id ? "..." : "Approve"}
                      </GlassButton>
                      <GlassButton
                        variant="danger"
                        onClick={() => openRejectModal(approval)}
                        disabled={actionLoading === approval.id}
                      >
                        {actionLoading === approval.id ? "..." : "Reject"}
                      </GlassButton>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* Approve Modal */}
      <GlassModal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setSelectedApproval(null);
        }}
        title="Approve Gate"
      >
        <div className="space-y-4">
          {selectedApproval && (
            <div className="glass-panel-sm p-4">
              <div className="text-sm text-white/70">
                <p>
                  <span className="text-white/40">Gate: </span>
                  {selectedApproval.gateName.replace(/_/g, " ")}
                </p>
                <p className="mt-1">
                  <span className="text-white/40">Agent: </span>
                  {agentTypeLabel(selectedApproval.agentType)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-white/50 mb-2">
              Note (optional)
            </label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-green-500/50"
              placeholder="Add a note for the approval..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <GlassButton
              onClick={() => {
                setShowApproveModal(false);
                setSelectedApproval(null);
              }}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="success"
              onClick={handleApprove}
              disabled={actionLoading !== null}
            >
              {actionLoading ? "Approving..." : "Confirm Approve"}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Reject Modal */}
      <GlassModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedApproval(null);
        }}
        title="Reject Gate"
      >
        <div className="space-y-4">
          {selectedApproval && (
            <div className="glass-panel-sm p-4">
              <div className="text-sm text-white/70">
                <p>
                  <span className="text-white/40">Gate: </span>
                  {selectedApproval.gateName.replace(/_/g, " ")}
                </p>
                <p className="mt-1">
                  <span className="text-white/40">Agent: </span>
                  {agentTypeLabel(selectedApproval.agentType)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-white/50 mb-2">
              Reason for rejection
            </label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500/50"
              placeholder="Explain why this gate is being rejected..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <GlassButton
              onClick={() => {
                setShowRejectModal(false);
                setSelectedApproval(null);
              }}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="danger"
              onClick={handleReject}
              disabled={actionLoading !== null}
            >
              {actionLoading ? "Rejecting..." : "Confirm Reject"}
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
