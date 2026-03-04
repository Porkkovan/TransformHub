"use client";

import { useState, useEffect, useCallback } from "react";

interface ProductReadiness {
  productId: string;
  productName: string;
  readinessScore: number;
  factors: { name: string; score: number }[];
  migrationSteps: {
    phase: string;
    description: string;
    status: "completed" | "in-progress" | "pending";
    estimatedDuration?: string;
  }[];
  gateApproved: boolean;
  blockers: string[];
}

export function useProductReadiness(organizationId?: string) {
  const [readiness, setReadiness] = useState<ProductReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/product-readiness${query}`);
      if (!res.ok) throw new Error("Failed to fetch product readiness");
      const data = await res.json();
      setReadiness(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load product readiness"
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  return { readiness, loading, error, refetch: fetchReadiness };
}
