"use client";

import { useState, useRef } from "react";

interface ImportResult {
  productId: string;
  productName: string;
  capabilities: {
    id: string;
    name: string;
    steps: number;
    processTime: number;
    waitTime: number;
    flowEfficiency: number;
  }[];
  totalSteps: number;
  detectedUnits?: { pt: string; wt: string };
  debug?: {
    columns: { step: string | null; pt: string | null; wt: string | null };
    allHeaders: string[];
    rawSample: { pt: unknown[]; wt: unknown[] };
    parsedSample: { name: string; processTime: number; waitTime: number }[];
  };
}

interface ProcessMapImportModalProps {
  organizationId?: string;
  /** Pre-select the segment that is currently active on the VSM page */
  defaultSegment?: string;
  onClose: () => void;
  onImported: (productId: string) => void;
}

const SEGMENTS = [
  "Retail Banking",
  "Business Banking",
  "Wealth Management",
  "Insurance",
  "Digital",
  "Operations",
  "Compliance",
  "Healthcare",
  "Fintech",
];

export default function ProcessMapImportModal({
  organizationId,
  defaultSegment,
  onClose,
  onImported,
}: ProcessMapImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [productName, setProductName] = useState("Client Onboarding Management");
  const [segment, setSegment] = useState(defaultSegment || "");
  const [ptUnit, setPtUnit] = useState("");
  const [wtUnit, setWtUnit] = useState("");
  const [capabilityGroups, setCapabilityGroups] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  };

  const handleImport = async () => {
    if (!file) { setErrorMsg("Please select an Excel or CSV file."); return; }
    if (!organizationId) { setErrorMsg("No organisation selected."); return; }

    setStatus("loading");
    setErrorMsg("");

    const form = new FormData();
    form.append("file", file);
    form.append("productName", productName);
    form.append("organizationId", organizationId);
    if (segment) form.append("businessSegment", segment);
    form.append("ptUnit", ptUnit);
    form.append("wtUnit", wtUnit);
    if (capabilityGroups) form.append("capabilityGroups", capabilityGroups);

    try {
      const res = await fetch("/api/process-map/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Import failed");
        setStatus("error");
        return;
      }
      setResult(json as ImportResult);
      setStatus("success");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  };

  const handleDone = () => {
    if (result) onImported(result.productId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel rounded-2xl p-6 w-full max-w-lg mx-4 space-y-5 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Import Process Map</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Upload an Excel or CSV file with process steps, process time and wait time
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status !== "success" && (
          <>
            {/* Product Name */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g. Client Onboarding Management"
              />
            </div>

            {/* Business Segment */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
                Business Segment (optional)
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 [&>option]:bg-slate-900"
              >
                <option value="">— None —</option>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Capability Groups */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
                Split into Capabilities (optional)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={capabilityGroups}
                onChange={(e) => setCapabilityGroups(e.target.value)}
                placeholder="Auto (uses Phase column if present)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
              />
              <p className="text-[10px] text-white/30 mt-1">
                If your Excel has no Phase/Group column, enter a number to split steps evenly into that many capabilities.
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
                Process Map File
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  file
                    ? "border-cyan-500/40 bg-cyan-500/5"
                    : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-cyan-400">{file.name}</p>
                    <p className="text-xs text-white/40 mt-1">
                      {(file.size / 1024).toFixed(1)} KB — click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-white/20 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-white/50">Click to select file</p>
                    <p className="text-xs text-white/30 mt-1">.xlsx, .xls, .csv</p>
                  </div>
                )}
              </div>
            </div>

            {/* Time Unit Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
                  Process Time Unit
                </label>
                <select
                  value={ptUnit}
                  onChange={(e) => setPtUnit(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 [&>option]:bg-slate-900"
                >
                  <option value="">Auto-detect</option>
                  <option value="hours">Hours (h)</option>
                  <option value="minutes">Minutes (min)</option>
                  <option value="days">Days (8 h/day)</option>
                  <option value="weeks">Weeks (40 h/week)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
                  Wait Time Unit
                </label>
                <select
                  value={wtUnit}
                  onChange={(e) => setWtUnit(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 [&>option]:bg-slate-900"
                >
                  <option value="">Auto-detect</option>
                  <option value="hours">Hours (h)</option>
                  <option value="minutes">Minutes (min)</option>
                  <option value="days">Days (8 h/day)</option>
                  <option value="weeks">Weeks (40 h/week)</option>
                </select>
              </div>
            </div>

            {/* Expected format hint */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wide mb-1.5">
                Expected columns
              </p>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-white/30">
                <span><span className="text-white/50">Step</span> or Process Step / Activity</span>
                <span><span className="text-white/50">Process Time</span> (hrs)</span>
                <span><span className="text-white/50">Wait Time</span> (hrs)</span>
                <span><span className="text-white/50">Phase</span> (optional grouping)</span>
                <span className="col-span-2"><span className="text-white/50">Classification</span>: value-adding / bottleneck / waste (optional)</span>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={status === "loading" || !file}
                className="glass-button !text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Importing...
                  </span>
                ) : "Import"}
              </button>
            </div>
          </>
        )}

        {/* Success State */}
        {status === "success" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{result.productName}</p>
                <p className="text-xs text-white/40">
                  {result.totalSteps} steps imported into {result.capabilities.length} capabilit{result.capabilities.length > 1 ? "ies" : "y"}
                </p>
                {result.detectedUnits && (
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Units used — PT: <span className="text-cyan-400/70">{result.detectedUnits.pt}</span>
                    {" · "}WT: <span className="text-cyan-400/70">{result.detectedUnits.wt}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {result.capabilities.map((cap) => (
                <div
                  key={cap.id}
                  className="glass-panel-sm rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white/80">{cap.name}</p>
                    <p className="text-xs text-white/40">{cap.steps} steps</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      cap.flowEfficiency >= 40
                        ? "text-green-400"
                        : cap.flowEfficiency >= 20
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}>
                      {cap.flowEfficiency.toFixed(1)}% FE
                    </p>
                    <p className="text-[10px] text-white/30">
                      PT {cap.processTime}h / WT {cap.waitTime}h
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Debug panel — helps diagnose UOM issues */}
            {result.debug && (
              <div className="bg-white/5 rounded-lg p-3 border border-white/5 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">Import Debug</p>
                <div className="text-[10px] text-white/30 space-y-1">
                  <p>Columns — Step: <span className="text-white/50">{result.debug.columns.step ?? "NOT FOUND"}</span> · PT: <span className="text-white/50">{result.debug.columns.pt ?? "NOT FOUND"}</span> · WT: <span className="text-white/50">{result.debug.columns.wt ?? "NOT FOUND"}</span></p>
                  <p>All headers: <span className="text-white/40">{result.debug.allHeaders.join(" | ")}</span></p>
                  <p>Raw PT values (first 5): <span className="text-white/50">{result.debug.rawSample.pt.map(String).join(", ") || "—"}</span></p>
                  <p>Raw WT values (first 5): <span className="text-white/50">{result.debug.rawSample.wt.map(String).join(", ") || "—"}</span></p>
                  <p>Parsed steps (first 5):</p>
                  {result.debug.parsedSample.map((s, i) => (
                    <p key={i} className="pl-2">· {s.name}: PT=<span className="text-green-400/70">{s.processTime}h</span> WT=<span className="text-red-400/70">{s.waitTime}h</span></p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={handleDone} className="glass-button !text-sm">
                View in VSM
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
