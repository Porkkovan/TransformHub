"use client";

import { useState, useEffect, useCallback } from "react";

interface Repository {
  id: string;
  name: string;
  url?: string;
  description?: string;
  language?: string;
  digitalProducts: DigitalProduct[];
}

interface DigitalProduct {
  id: string;
  name: string;
  description?: string;
  currentState?: string;
  futureState?: string;
  businessSegment?: string | null;
  digitalCapabilities: DigitalCapability[];
  productGroups: ProductGroup[];
}

interface VsmMetric {
  id: string;
  processTime: number;
  leadTime: number;
  waitTime: number;
  flowEfficiency: number;
  mermaidSource?: string;
}

interface DigitalCapability {
  id: string;
  name: string;
  description?: string;
  category?: string;
  functionalities: Functionality[];
  vsmMetrics?: VsmMetric[];
}

interface Functionality {
  id: string;
  name: string;
  description?: string;
  sourceFiles: string[];
  personaMappings: PersonaMapping[];
}

interface PersonaMapping {
  id: string;
  personaType: string;
  personaName: string;
  responsibilities: string[];
}

interface ProductGroup {
  id: string;
  name: string;
  description?: string;
  valueStreamSteps: ValueStreamStep[];
}

interface ValueStreamStep {
  id: string;
  name: string;
  stepOrder: number;
  stepType: string;
}

export function useBmadHierarchy(organizationId?: string) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async () => {
    setLoading(true);
    try {
      const params = organizationId ? `?organizationId=${organizationId}` : "";
      const res = await fetch(`/api/repositories${params}`);
      if (!res.ok) throw new Error("Failed to fetch repositories");
      const repos = await res.json();
      setRepositories(repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load hierarchy");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  return { repositories, loading, error, refetch: fetchHierarchy };
}
