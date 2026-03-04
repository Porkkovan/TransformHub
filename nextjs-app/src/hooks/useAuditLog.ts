"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  previousHash: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

export function useAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const skip = page * PAGE_SIZE;
      const res = await fetch(`/api/audit-log?take=${PAGE_SIZE}&skip=${skip}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const data = await res.json();

      // Support both { data, total } and plain array responses
      if (data.data && typeof data.total === "number") {
        setLogs(data.data);
        setTotal(data.total);
      } else if (Array.isArray(data)) {
        setLogs(data);
        setTotal(data.length);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    page,
    totalPages,
    total,
    setPage,
    refetch: fetchLogs,
  };
}
