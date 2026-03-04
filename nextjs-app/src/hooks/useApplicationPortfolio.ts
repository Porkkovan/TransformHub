"use client";

import { useState, useEffect, useCallback } from "react";

export interface ContextApplication {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  vendor?: string | null;
  version?: string | null;
  status: string;
  businessSegment?: string | null;
  technologyStack: string[];
  integrations: string[];
  annualCost?: number | null;
  userCount?: number | null;
  businessCriticality: string;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

interface AddApplicationInput {
  name: string;
  description?: string;
  vendor?: string;
  version?: string;
  status?: string;
  businessSegment?: string;
  technologyStack?: string[];
  integrations?: string[];
  annualCost?: number | null;
  userCount?: number | null;
  businessCriticality?: string;
}

export function useApplicationPortfolio(organizationId?: string) {
  const [applications, setApplications] = useState<ContextApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchApplications = useCallback(async () => {
    if (!organizationId) {
      setApplications([]);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ organizationId });
      const res = await fetch(`/api/context/applications?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch applications");
      const data = await res.json();
      setApplications(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const addApplication = useCallback(
    async (input: AddApplicationInput) => {
      if (!organizationId) return false;
      setActionLoading(true);
      try {
        const res = await fetch("/api/context/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, organizationId }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to add application");
        }
        await fetchApplications();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add application");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [organizationId, fetchApplications]
  );

  const bulkImport = useCallback(
    async (apps: AddApplicationInput[]) => {
      if (!organizationId) return false;
      setActionLoading(true);
      try {
        const res = await fetch("/api/context/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, applications: apps }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to import applications");
        }
        await fetchApplications();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import applications");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [organizationId, fetchApplications]
  );

  const deleteApplication = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/context/applications/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete application");
        await fetchApplications();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete application");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchApplications]
  );

  return {
    applications,
    loading,
    error,
    actionLoading,
    addApplication,
    bulkImport,
    deleteApplication,
    refetch: fetchApplications,
  };
}
