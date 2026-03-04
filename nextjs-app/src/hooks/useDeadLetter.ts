"use client";

import { useState, useEffect, useCallback } from "react";

export interface DeadLetterJob {
  id: string;
  agentType: string;
  executionId: string;
  errorMessage: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export function useDeadLetter() {
  const [jobs, setJobs] = useState<DeadLetterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/dead-letter");
      if (!res.ok) throw new Error("Failed to fetch dead letter jobs");
      const data = await res.json();
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dead letter queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const retryJob = useCallback(async (jobId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/dead-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error("Failed to retry job");
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionLoading(false);
    }
  }, [fetchJobs]);

  const deleteJob = useCallback(async (jobId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dead-letter/${jobId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete job");
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionLoading(false);
    }
  }, [fetchJobs]);

  return { jobs, loading, actionLoading, error, retryJob, deleteJob, refetch: fetchJobs };
}
