"use client";

import React from "react";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassButton from "@/components/ui/GlassButton";
import type { ContextDocument } from "@/hooks/useContextDocuments";

interface DocumentListProps {
  documents: ContextDocument[];
  onProcess: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  actionLoading: boolean;
}

const statusVariant: Record<string, "info" | "success" | "warning" | "danger" | "default"> = {
  UPLOADED: "info",
  PROCESSING: "warning",
  INDEXED: "success",
  FAILED: "danger",
};

const categoryLabels: Record<string, string> = {
  CURRENT_STATE: "Current State",
  FUTURE_STATE: "Future State",
  COMPETITOR: "Competitor",
  TECH_TREND: "Tech Trend",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentList({ documents, onProcess, onDelete, actionLoading }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-white/40 text-sm">No documents uploaded yet. Upload a document above to get started.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">File Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Category</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Size</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Chunks</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-200 max-w-[200px] truncate" title={doc.fileName}>
                  {doc.fileName}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400 uppercase">{doc.fileType}</td>
                <td className="px-4 py-3">
                  <GlassBadge variant="info">{categoryLabels[doc.category] || doc.category}</GlassBadge>
                </td>
                <td className="px-4 py-3">
                  <GlassBadge variant={statusVariant[doc.status] || "default"}>{doc.status}</GlassBadge>
                  {doc.errorMessage && (
                    <p className="text-red-400 text-xs mt-1 max-w-[200px] truncate" title={doc.errorMessage}>
                      {doc.errorMessage}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{formatFileSize(doc.fileSize)}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{doc.chunkCount || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {doc.status === "UPLOADED" && (
                      <GlassButton
                        onClick={() => onProcess(doc.id)}
                        disabled={actionLoading}
                        className="text-xs !px-3 !py-1"
                      >
                        Process
                      </GlassButton>
                    )}
                    {doc.status === "FAILED" && (
                      <GlassButton
                        onClick={() => onProcess(doc.id)}
                        disabled={actionLoading}
                        className="text-xs !px-3 !py-1"
                      >
                        Retry
                      </GlassButton>
                    )}
                    <GlassButton
                      variant="danger"
                      onClick={() => onDelete(doc.id)}
                      disabled={actionLoading}
                      className="text-xs !px-3 !py-1"
                    >
                      Delete
                    </GlassButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
