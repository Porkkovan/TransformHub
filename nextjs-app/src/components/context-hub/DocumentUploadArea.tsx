"use client";

import React, { useState, useRef, useCallback } from "react";
import GlassButton from "@/components/ui/GlassButton";
import GlassSelect from "@/components/ui/GlassSelect";

const ALLOWED_TYPES = [".pdf", ".csv", ".json", ".txt", ".md", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const categoryOptions = [
  { value: "CURRENT_STATE", label: "Current State" },
  { value: "FUTURE_STATE", label: "Future State" },
  { value: "COMPETITOR", label: "Competitor" },
  { value: "TECH_TREND", label: "Tech Trend" },
];

interface DocumentUploadAreaProps {
  onUpload: (file: File, category: string, subCategory?: string) => Promise<boolean>;
  actionLoading: boolean;
}

export default function DocumentUploadArea({ onUpload, actionLoading }: DocumentUploadAreaProps) {
  const [category, setCategory] = useState("CURRENT_STATE");
  const [subCategory, setSubCategory] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return `Unsupported file type: ${ext}. Allowed: ${ALLOWED_TYPES.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 20MB`;
    }
    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      const err = validateFile(file);
      if (err) {
        setValidationError(err);
        return;
      }
      setValidationError(null);
      await onUpload(file, category, subCategory || undefined);
    },
    [category, subCategory, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFile]
  );

  return (
    <div className="glass-panel p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Upload Document</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassSelect
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={categoryOptions}
        />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Sub-Category (optional)</label>
          <input
            type="text"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            placeholder="e.g., Architecture, Security, API Docs"
            className="glass-input"
          />
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-blue-400 bg-blue-500/10"
            : "border-white/20 hover:border-white/40 hover:bg-white/5"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileInput}
          className="hidden"
        />
        <svg className="w-10 h-10 mx-auto mb-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {actionLoading ? (
          <p className="text-blue-400 text-sm">Uploading and processing...</p>
        ) : (
          <>
            <p className="text-white/60 text-sm">
              Drag and drop a file here, or <span className="text-blue-400">click to browse</span>
            </p>
            <p className="text-white/30 text-xs mt-2">
              Supported: PDF, CSV, JSON, TXT, MD (max 20MB)
            </p>
          </>
        )}
      </div>

      {validationError && (
        <p className="text-red-400 text-sm">{validationError}</p>
      )}
    </div>
  );
}
