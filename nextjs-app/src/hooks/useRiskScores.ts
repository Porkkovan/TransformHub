"use client";

import { useState, useEffect, useCallback } from "react";

interface RiskAssessment {
  id: string;
  entityType: string;
  entityId: string;
  riskCategory: string;
  riskScore: number;
  severity: string;
  description?: string;
  mitigationPlan?: string;
  transitionBlocked: boolean;
}

export function useRiskScores(entityType?: string, entityId?: string, organizationId?: string) {
  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);
      if (organizationId) params.set("organizationId", organizationId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/risk${query}`);
      if (!res.ok) throw new Error("Failed to fetch risk scores");
      const data = await res.json();
      setRisks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risks");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, organizationId]);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const maxScore = risks.length > 0 ? Math.max(...risks.map((r) => r.riskScore)) : 0;
  const avgScore = risks.length > 0 ? risks.reduce((sum, r) => sum + r.riskScore, 0) / risks.length : 0;
  const criticalCount = risks.filter((r) => r.severity === "CRITICAL").length;
  const blockedCount = risks.filter((r) => r.transitionBlocked).length;

  return { risks, loading, error, refetch: fetchRisks, maxScore, avgScore, criticalCount, blockedCount };
}
