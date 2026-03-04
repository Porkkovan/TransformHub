"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industryType: string;
  description?: string;
  competitors: string[];
  businessSegments: string[];
  regulatoryFrameworks: string[];
  personas: { type: string; name: string; responsibilities: string[] }[];
}

interface OrganizationContextValue {
  organizations: Organization[];
  currentOrg: Organization | null;
  loading: boolean;
  switchOrg: (orgId: string) => void;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organizations: [],
  currentOrg: null,
  loading: true,
  switchOrg: () => {},
  refetch: async () => {},
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      const data = await res.json();
      setOrganizations(data);

      // Restore selection from localStorage or default to US Bank, then first org
      const savedId = typeof window !== "undefined" ? localStorage.getItem("currentOrgId") : null;
      if (savedId && data.some((o: Organization) => o.id === savedId)) {
        setCurrentOrgId(savedId);
      } else if (data.length > 0 && !currentOrgId) {
        const usBank = data.find((o: Organization) => o.name === "US Bank");
        setCurrentOrgId((usBank ?? data[0]).id);
      }
    } catch {
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
    if (typeof window !== "undefined") {
      localStorage.setItem("currentOrgId", orgId);
    }
  }, []);

  const currentOrg = organizations.find((o) => o.id === currentOrgId) ?? null;

  return (
    <OrganizationContext.Provider value={{ organizations, currentOrg, loading, switchOrg, refetch: fetchOrgs }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
