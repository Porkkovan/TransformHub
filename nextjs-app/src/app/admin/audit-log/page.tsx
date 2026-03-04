"use client";

import { useAuditLog } from "@/hooks/useAuditLog";
import GlassButton from "@/components/ui/GlassButton";

export default function AuditLogPage() {
  const { logs, loading, error, page, totalPages, total, setPage, refetch } = useAuditLog();

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const truncateJson = (obj: Record<string, unknown>, maxLen = 120) => {
    const str = JSON.stringify(obj);
    return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-white/50 mt-1">
            Track all system actions and changes
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-orange-500">
          <p className="text-xs text-white/40 uppercase">Total Events</p>
          <p className="text-3xl font-bold text-orange-400 mt-1">
            {loading ? "..." : total}
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
          <p className="text-xs text-white/40 uppercase">Current Page</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">
            {page + 1} / {totalPages}
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Showing</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {loading ? "..." : logs.length}
          </p>
          <p className="text-xs text-white/30 mt-1">entries on this page</p>
        </div>
      </div>

      {/* Log Table */}
      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-white/40 text-sm">No audit log entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs text-white/40 uppercase font-semibold">
              <div className="col-span-2">Timestamp</div>
              <div className="col-span-2">Action</div>
              <div className="col-span-2">Entity Type</div>
              <div className="col-span-2">Entity ID</div>
              <div className="col-span-1">Actor</div>
              <div className="col-span-3">Metadata</div>
            </div>

            {/* Table Rows */}
            {logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 glass-panel-sm items-center text-sm"
              >
                <div className="col-span-2 text-white/50 text-xs">
                  {formatDate(log.createdAt)}
                </div>
                <div className="col-span-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/80 border border-white/10">
                    {log.action}
                  </span>
                </div>
                <div className="col-span-2 text-white/60 text-xs font-mono">
                  {log.entityType}
                </div>
                <div className="col-span-2 text-white/50 text-xs font-mono truncate" title={log.entityId}>
                  {log.entityId.length > 12 ? log.entityId.slice(0, 12) + "..." : log.entityId}
                </div>
                <div className="col-span-1 text-white/50 text-xs truncate" title={log.actor}>
                  {log.actor}
                </div>
                <div className="col-span-3 text-white/40 text-xs font-mono truncate" title={JSON.stringify(log.payload)}>
                  {truncateJson(log.payload)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <GlassButton
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            Previous
          </GlassButton>
          <span className="text-sm text-white/50">
            Page {page + 1} of {totalPages}
          </span>
          <GlassButton
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </GlassButton>
        </div>
      )}
    </div>
  );
}
