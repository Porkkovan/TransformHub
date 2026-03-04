"use client";

import { useState, useEffect, useCallback } from "react";

interface ValueStreamStep {
  id: string;
  name: string;
  stepOrder: number;
  stepType: string;
}

interface ProductGroup {
  id: string;
  name: string;
  description?: string;
  valueStreamSteps: ValueStreamStep[];
}

interface PersonaMapping {
  id: string;
  personaType: string;
  personaName: string;
  responsibilities: string[];
}

interface Functionality {
  id: string;
  name: string;
  description?: string;
  sourceFiles: string[];
  personaMappings?: PersonaMapping[];
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

export interface DigitalProduct {
  id: string;
  name: string;
  description?: string;
  currentState?: string;
  futureState?: string;
  businessSegment?: string;
  repositoryId: string;
  repository?: {
    id: string;
    name: string;
  };
  digitalCapabilities: DigitalCapability[];
  productGroups: ProductGroup[];
}

export function useDigitalProducts(organizationId?: string, businessSegment?: string) {
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      if (businessSegment) params.set("businessSegment", businessSegment);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/digital-products${query}`);
      if (!res.ok) throw new Error("Failed to fetch digital products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [organizationId, businessSegment]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
