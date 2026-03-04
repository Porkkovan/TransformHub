"use client";

import { useState, useRef, useEffect } from "react";

interface ExportDropdownProps {
  endpoint: string; // e.g. "/api/export/discovery"
  params: Record<string, string | undefined>; // query params (undefined values are omitted)
  label?: string;
  disabled?: boolean;
}

async function downloadFile(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackName;
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export default function ExportDropdown({
  endpoint,
  params,
  label = "Export",
  disabled = false,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"xlsx" | "pdf" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buildUrl = (format: "xlsx" | "pdf") => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    sp.set("format", format);
    return `${endpoint}?${sp.toString()}`;
  };

  const handle = async (format: "xlsx" | "pdf") => {
    if (loading) return;
    setLoading(format);
    setOpen(false);
    try {
      const ts = new Date().toISOString().slice(0, 10);
      const base = endpoint.split("/").pop() || "export";
      await downloadFile(buildUrl(format), `transformhub-${base}-${ts}.${format}`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled || !!loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
          ${disabled || loading
            ? "opacity-40 cursor-not-allowed border-white/10 text-white/30"
            : "border-white/15 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
          }`}
        title={label}
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        <span className="hidden sm:inline">{loading ? "Exporting…" : label}</span>
        {!loading && (
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-xl glass-panel-sm border border-white/10 shadow-2xl z-50 overflow-hidden">
          <button
            onClick={() => handle("xlsx")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/8 transition-colors text-left"
          >
            <span className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-white/90">Excel (XLSX)</p>
              <p className="text-[10px] text-white/40">Multi-sheet workbook</p>
            </div>
          </button>
          <div className="h-px bg-white/5 mx-3" />
          <button
            onClick={() => handle("pdf")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/8 transition-colors text-left"
          >
            <span className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="font-medium text-white/90">PDF Report</p>
              <p className="text-[10px] text-white/40">Formatted document</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
