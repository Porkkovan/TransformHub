"use client";

import { useState, useEffect, useCallback } from "react";

export interface ContextDocument {
  id: string;
  organizationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  category: string;
  subCategory?: string | null;
  status: string;
  errorMessage?: string | null;
  chunkCount: number;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export function useContextDocuments(organizationId?: string, category?: string) {
  const [documents, setDocuments] = useState<ContextDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!organizationId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ organizationId });
      if (category) params.set("category", category);
      const res = await fetch(`/api/context/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      setDocuments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [organizationId, category]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = useCallback(
    async (file: File, cat: string, subCategory?: string) => {
      if (!organizationId) return false;
      setActionLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("organizationId", organizationId);
        formData.append("category", cat);
        if (subCategory) formData.append("subCategory", subCategory);

        const res = await fetch("/api/context/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to upload document");
        }

        const doc = await res.json();

        // Auto-trigger processing
        await fetch(`/api/context/documents/${doc.id}/process`, {
          method: "POST",
        });

        await fetchDocuments();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload document");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [organizationId, fetchDocuments]
  );

  const processDocument = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/context/documents/${id}/process`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to process document");
        await fetchDocuments();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process document");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchDocuments]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/context/documents/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete document");
        await fetchDocuments();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete document");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchDocuments]
  );

  return {
    documents,
    loading,
    error,
    actionLoading,
    uploadDocument,
    processDocument,
    deleteDocument,
    refetch: fetchDocuments,
  };
}
