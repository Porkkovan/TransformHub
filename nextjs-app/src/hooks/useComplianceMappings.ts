"use client";

import { useState, useEffect, useCallback } from "react";

interface ComplianceMapping {
  id: string;
  framework: string;
  requirement: string;
  description?: string;
  status: "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT";
  entityType: string;
}

export function useComplianceMappings(organizationId?: string) {
  const [mappings, setMappings] = useState<ComplianceMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/risk/compliance${query}`);
      if (!res.ok) throw new Error("Failed to fetch compliance mappings");
      const data = await res.json();
      setMappings(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load compliance mappings"
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  return { mappings, loading, error, refetch: fetchMappings };
}
