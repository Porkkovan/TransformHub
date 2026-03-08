"use client";

import React, { useState, useRef, useCallback } from "react";
import GlassButton from "@/components/ui/GlassButton";
import GlassSelect from "@/components/ui/GlassSelect";

const ALLOWED_TYPES = [".pdf", ".csv", ".json", ".txt", ".md", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const DOCUMENT_CATEGORIES = [
  { value: "CURRENT_STATE",             label: "Current State",               description: "Process docs, L0–L3 maps, SOPs, architecture diagrams, discovery outputs",       color: "text-blue-400"   },
  { value: "FUTURE_STATE",              label: "Future State",                description: "Target architectures, strategic roadmaps, vision documents",                      color: "text-purple-400" },
  { value: "VSM_BENCHMARKS",            label: "VSM Benchmarks",              description: "Industry PT/WT/FE benchmarks (Gartner, APQC, McKinsey, SWIFT reports)",          color: "text-cyan-400"   },
  { value: "TRANSFORMATION_CASE_STUDIES", label: "Transformation Case Studies", description: "Published case studies with real ROI, efficiency gains, timelines",             color: "text-emerald-400"},
  { value: "ARCHITECTURE_STANDARDS",   label: "Architecture Standards",       description: "Cloud patterns, AI/agent design patterns, tech maturity matrices",                color: "text-amber-400"  },
  { value: "COMPETITOR",               label: "Competitor Intelligence",      description: "Competitor capabilities, market positioning, benchmarking reports",               color: "text-orange-400" },
  { value: "TECH_TREND",               label: "Tech Trends",                  description: "Technology trend reports, analyst outlooks, innovation roadmaps",                 color: "text-pink-400"   },
  { value: "AGENT_OUTPUT",             label: "Agent Output (System)",        description: "Auto-saved outputs from prior agent runs — enables cross-agent context chaining", color: "text-white/40"   },
] as const;

const categoryOptions = DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

type InputMode = "file" | "url";

interface DocumentUploadAreaProps {
  organizationId?: string;
  onUpload: (file: File, category: string, subCategory?: string) => Promise<boolean>;
  onUrlFetch?: (url: string, category: string, subCategory?: string) => Promise<boolean>;
  actionLoading: boolean;
}

export default function DocumentUploadArea({ organizationId, onUpload, onUrlFetch, actionLoading }: DocumentUploadAreaProps) {
  const [mode, setMode] = useState<InputMode>("file");
  const [category, setCategory] = useState("CURRENT_STATE");
  const [subCategory, setSubCategory] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlSuccess, setUrlSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCat = DOCUMENT_CATEGORIES.find((c) => c.value === category);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) return `Unsupported: ${ext}. Allowed: ${ALLOWED_TYPES.join(", ")}`;
    if (file.size > MAX_FILE_SIZE) return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 20 MB`;
    return null;
  };

  const handleFile = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) { setValidationError(err); return; }
    setValidationError(null); setUrlSuccess(null);
    await onUpload(file, category, subCategory || undefined);
  }, [category, subCategory, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleFile]);

  const handleUrlFetch = useCallback(async () => {
    if (!urlInput.trim()) return;
    setValidationError(null); setUrlSuccess(null); setUrlLoading(true);
    try {
      if (onUrlFetch) {
        const ok = await onUrlFetch(urlInput.trim(), category, subCategory || undefined);
        if (ok) { setUrlSuccess(`Indexed: ${urlInput.trim()}`); setUrlInput(""); }
      } else {
        const res = await fetch("/api/context/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlInput.trim(), organizationId, category, subCategory: subCategory || undefined }),
        });
        if (res.ok) { setUrlSuccess(`Fetched & indexed: ${urlInput.trim()}`); setUrlInput(""); }
        else { const d = await res.json(); setValidationError(d.error || "Failed to fetch URL"); }
      }
    } finally { setUrlLoading(false); }
  }, [urlInput, category, subCategory, onUrlFetch, organizationId]);

  return (
    <div className="glass-panel p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Add Document</h3>

      {/* Category + Sub-category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <GlassSelect label="Category" value={category}
            onChange={(e) => { setCategory(e.target.value); setValidationError(null); setUrlSuccess(null); }}
            options={categoryOptions}
          />
          {selectedCat && <p className={`text-xs mt-1 ${selectedCat.color}`}>{selectedCat.description}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Sub-Category (optional)</label>
          <input type="text" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}
            placeholder="e.g., KYC Process, Cloud Architecture, ROI Study"
            className="glass-input"
          />
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 glass-panel-sm w-fit rounded-lg">
        {(["file", "url"] as InputMode[]).map((m) => (
          <button key={m} onClick={() => { setMode(m); setValidationError(null); setUrlSuccess(null); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === m ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-white/50 hover:text-white/80"
            }`}
          >
            {m === "file" ? "📄 Upload File" : "🔗 Fetch URL / Repo"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? "border-blue-400 bg-blue-500/10" : "border-white/20 hover:border-white/40 hover:bg-white/5"
          }`}
        >
          <input ref={fileInputRef} type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleFileInput} className="hidden" />
          <svg className="w-10 h-10 mx-auto mb-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {actionLoading ? (
            <p className="text-blue-400 text-sm">Uploading and indexing...</p>
          ) : (
            <>
              <p className="text-white/60 text-sm">Drag & drop, or <span className="text-blue-400">click to browse</span></p>
              <p className="text-white/30 text-xs mt-2">PDF, CSV, XLSX, JSON, TXT, MD — max 20 MB</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="url" value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setValidationError(null); setUrlSuccess(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleUrlFetch(); }}
              placeholder="https://example.com/report.pdf  or  GitHub file URL..."
              className="glass-input flex-1"
            />
            <GlassButton onClick={handleUrlFetch} disabled={!urlInput.trim() || urlLoading} variant="default">
              {urlLoading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Fetching…
                </span>
              ) : "Fetch & Index"}
            </GlassButton>
          </div>
          <div className="text-xs text-white/30 space-y-0.5">
            <p>• Publicly accessible web pages, HTML reports, plain-text files</p>
            <p>• Direct PDF links (Gartner, McKinsey, APQC, WEF, Deloitte, IBM, BCG public reports)</p>
            <p>• GitHub URLs auto-converted to raw content (github.com → raw.githubusercontent.com)</p>
            <p>• For private or paywalled content — download first, then upload as a file</p>
          </div>
        </div>
      )}

      {validationError && <p className="text-red-400 text-sm">{validationError}</p>}
      {urlSuccess && (
        <p className="text-emerald-400 text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          {urlSuccess}
        </p>
      )}
    </div>
  );
}
