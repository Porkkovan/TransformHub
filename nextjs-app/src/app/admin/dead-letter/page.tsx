"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useDeadLetter } from "@/hooks/useDeadLetter";

export default function DeadLetterPage() {
  const { jobs, loading, actionLoading, error, retryJob, deleteJob, refetch } = useDeadLetter();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dead Letter Queue</h1>
          <p className="text-white/50 mt-1">
            Failed agent jobs — retry or remove from the queue
          </p>
        </div>
        <GlassButton onClick={refetch} disabled={loading}>
          Refresh
        </GlassButton>
      </div>

      {error && (
        <div className="glass-panel p-4 border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <GlassCard title={`Failed Jobs (${jobs.length})`}>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-white/40 text-sm">Loading dead letter queue...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/40 text-sm">No failed jobs in the queue</p>
            <p className="text-white/30 text-xs mt-1">Failed agent executions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-4 px-3 py-2 text-xs text-white/40 uppercase border-b border-white/10">
              <span>Agent Type</span>
              <span>Execution ID</span>
              <span>Error Message</span>
              <span className="text-right">Attempts</span>
              <span>Created At</span>
              <span>Actions</span>
            </div>
            {jobs.map((job) => (
              <div key={job.id} className="glass-panel-sm p-3 grid grid-cols-6 gap-4 items-center">
                <span className="text-sm text-white/80">
                  {job.agentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <span className="text-xs text-white/50 font-mono truncate" title={job.executionId}>
                  {job.executionId.slice(0, 8)}...
                </span>
                <span className="text-xs text-red-400/80 truncate" title={job.errorMessage}>
                  {job.errorMessage}
                </span>
                <span className="text-sm text-white/60 text-right">
                  <GlassBadge variant={job.attempts >= 3 ? "danger" : "warning"}>
                    {job.attempts}
                  </GlassBadge>
                </span>
                <span className="text-xs text-white/40">
                  {new Date(job.createdAt).toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <GlassButton
                    onClick={() => retryJob(job.id)}
                    disabled={actionLoading}
                    className="text-xs"
                  >
                    Retry
                  </GlassButton>
                  <GlassButton
                    variant="danger"
                    onClick={() => deleteJob(job.id)}
                    disabled={actionLoading}
                    className="text-xs"
                  >
                    Delete
                  </GlassButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
