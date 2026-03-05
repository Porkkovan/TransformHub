"use client";

import { useRef, useState } from "react";

interface UpdatedCap {
  name: string;
  pt: number;
  wt: number;
  lt: number;
  fe: number;
}

interface VsmMetricsImportCardProps {
  productId: string;
  productName: string;
  onImported: () => void;
}

export default function VsmMetricsImportCard({
  productId,
  productName,
  onImported,
}: VsmMetricsImportCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    updated: UpdatedCap[];
    unmatched: string[];
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Download template ────────────────────────────────────────────────────
  function handleDownloadTemplate() {
    const url = `/api/vsm/metrics-template?productId=${productId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `vsm_metrics_${productName.replace(/\s+/g, "_")}.xlsx`;
    a.click();
  }

  // ── Upload & update ──────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);

    try {
      const form = new FormData();
      form.append("productId", productId);
      form.append("file", file);

      const res = await fetch("/api/vsm/metrics-update", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch {
      setError("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Instructions */}
      <p className="text-xs text-white/40 leading-relaxed">
        Download the template, fill in <span className="text-white/60 font-medium">Process Time</span> and{" "}
        <span className="text-white/60 font-medium">Wait Time</span> (hours) for each capability, then upload.
      </p>

      {/* Step 1 — Download */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/25 font-mono w-4">1</span>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Template (.xlsx)
        </button>
      </div>

      {/* Step 2 — Choose file */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/25 font-mono w-4">2</span>
        <label className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-dashed border-white/15 hover:border-white/25 cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/5">
          <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className={file ? "text-white/70 truncate" : "text-white/30"}>
            {file ? file.name : "Choose .xlsx or .csv…"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
          />
        </label>
      </div>

      {/* Step 3 — Upload */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/25 font-mono w-4">3</span>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/25 disabled:opacity-40 transition-all"
        >
          {uploading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Updating…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Upload &amp; Update Metrics
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-lg px-3 py-2.5 bg-cyan-500/8 border border-cyan-500/20 space-y-2">
          <p className="text-xs font-medium text-cyan-400">{result.message}</p>

          {result.updated.length > 0 && (
            <div className="space-y-1">
              {result.updated.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-[10px] text-white/50">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 ml-2 tabular-nums text-white/30">
                    PT {c.pt}h · WT {c.wt}h · FE {c.fe}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.unmatched.length > 0 && (
            <div className="pt-1 border-t border-white/5">
              <p className="text-[10px] text-amber-400/70 mb-1">
                {result.unmatched.length} unmatched (check spelling):
              </p>
              <p className="text-[10px] text-white/30">{result.unmatched.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
