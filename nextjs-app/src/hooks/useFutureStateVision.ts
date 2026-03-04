"use client";

import { useState, useEffect, useCallback } from "react";

interface AutomationMix {
  productName: string;
  rpa: number;
  aiMl: number;
  agentBased: number;
  conversational: number;
  analytics: number;
}

interface StreamStep {
  name: string;
  type: "manual" | "automated" | "ai" | "agent";
  duration: number;
}

interface FutureCapability {
  name: string;
  category: string;
  businessImpact: "HIGH" | "MEDIUM" | "LOW";
  complexity: "HIGH" | "MEDIUM" | "LOW";
  techStack: string[];
  description: string;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  riceScore?: number;
}

export interface FutureStateData {
  automationMix: AutomationMix[];
  currentSteps: StreamStep[];
  futureSteps: StreamStep[];
  capabilities: FutureCapability[];
  productStreams?: Record<string, {
    currentSteps: StreamStep[];
    futureSteps: StreamStep[];
  }>;
}

export function useFutureStateVision(organizationId?: string) {
  const [data, setData] = useState<FutureStateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/future-state${query}`);
      if (!res.ok) throw new Error("Failed to fetch future state data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load future state data");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
