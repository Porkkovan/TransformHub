"use client";

import { useState, useRef, useEffect } from "react";

interface ExportButtonProps {
  executionId?: string;
  reportType?: string;
  className?: string;
}

export default function ExportButton({
  executionId,
  reportType = "full_report",
  className = "",
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (format: "pdf" | "csv") => {
    setDownloading(format);
    try {
      const params = new URLSearchParams({ reportType });
      if (executionId) params.set("executionId", executionId);

      const url = `/api/export/${format}?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;

      // Extract filename from Content-Disposition or generate one
      const disposition = res.headers.get("Content-Disposition");
      let filename = `transformhub-${reportType}.${format === "pdf" ? "html" : "csv"}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setIsOpen(false);
    } catch (error) {
      console.error(`Export ${format} failed:`, error);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-button flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Export
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 z-50 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <button
            onClick={() => handleExport("pdf")}
            disabled={downloading !== null}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
          >
            <svg
              className="w-4 h-4 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            {downloading === "pdf" ? "Generating..." : "Download PDF"}
          </button>
          <div className="border-t border-white/5" />
          <button
            onClick={() => handleExport("csv")}
            disabled={downloading !== null}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
          >
            <svg
              className="w-4 h-4 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {downloading === "csv" ? "Generating..." : "Download CSV"}
          </button>
        </div>
      )}
    </div>
  );
}
