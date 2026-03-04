"use client";

import { useState, useEffect, useCallback } from "react";

export interface RoadmapItem {
  id: string;
  capabilityName: string;
  category: string;
  description?: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;
  quarter: string;
  status: string;
  source: string;
  approvalStatus: string;
  reviewedBy?: string;
  reviewNote?: string;
  digitalProductId?: string;
  digitalCapabilityId?: string;
  functionalityId?: string;
  itemType: string;
  initiative?: string;
  digitalProduct?: { id: string; name: string };
  digitalCapability?: { id: string; name: string };
  functionality?: { id: string; name: string };
}

interface AddItemInput {
  capabilityName: string;
  category: string;
  description?: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  quarter: string;
  digitalProductId?: string;
  digitalCapabilityId?: string;
  functionalityId?: string;
  itemType?: string;
  initiative?: string;
}

export function useProductRoadmap(organizationId?: string, digitalProductId?: string, itemType?: string) {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!organizationId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ organizationId });
      if (digitalProductId) params.set("digitalProductId", digitalProductId);
      if (itemType) params.set("itemType", itemType);
      const res = await fetch(`/api/roadmap?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch roadmap items");
      const data = await res.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roadmap");
    } finally {
      setLoading(false);
    }
  }, [organizationId, digitalProductId, itemType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = useCallback(
    async (input: AddItemInput) => {
      setActionLoading(true);
      try {
        const res = await fetch("/api/roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, organizationId }),
        });
        if (!res.ok) throw new Error("Failed to add item");
        await fetchItems();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add item");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [organizationId, fetchItems]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<Pick<RoadmapItem, "status" | "quarter" | "capabilityName" | "description">>) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/roadmap/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update item");
        await fetchItems();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update item");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchItems]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/roadmap/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete item");
        await fetchItems();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete item");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchItems]
  );

  const approveItem = useCallback(
    async (itemId: string, reviewedBy?: string, reviewNote?: string) => {
      setActionLoading(true);
      try {
        const res = await fetch("/api/roadmap/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, action: "APPROVED", reviewedBy, reviewNote }),
        });
        if (!res.ok) throw new Error("Failed to approve item");
        await fetchItems();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approve failed");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchItems]
  );

  const rejectItem = useCallback(
    async (itemId: string, reviewedBy?: string, reviewNote?: string) => {
      setActionLoading(true);
      try {
        const res = await fetch("/api/roadmap/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, action: "REJECTED", reviewedBy, reviewNote }),
        });
        if (!res.ok) throw new Error("Failed to reject item");
        await fetchItems();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reject failed");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchItems]
  );

  const generateRoadmap = useCallback(
    async () => {
      if (!organizationId) return false;
      setActionLoading(true);
      try {
        const res = await fetch("/api/roadmap/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Pass digitalProductId so generated items are linked to the selected product
          body: JSON.stringify({ organizationId, digitalProductId: digitalProductId || undefined }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to generate roadmap");
        }
        await fetchItems();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generate failed");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [organizationId, digitalProductId, fetchItems]
  );

  return {
    items,
    loading,
    error,
    actionLoading,
    addItem,
    updateItem,
    deleteItem,
    approveItem,
    rejectItem,
    generateRoadmap,
    refetch: fetchItems,
  };
}
