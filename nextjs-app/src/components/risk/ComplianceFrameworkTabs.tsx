"use client";

import React, { useState, useMemo, useEffect } from "react";

interface ComplianceMapping {
  id: string;
  framework: string;
  requirement: string;
  description?: string;
  status: "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT";
  entityType: string;
}

interface ComplianceFrameworkTabsProps {
  mappings: ComplianceMapping[];
}

function statusBadgeStyle(status: ComplianceMapping["status"]): string {
  switch (status) {
    case "COMPLIANT":
      return "bg-green-500/20 text-green-300 border border-green-500/30";
    case "PARTIAL":
      return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    case "NON_COMPLIANT":
      return "bg-red-500/20 text-red-300 border border-red-500/30";
    default:
      return "bg-white/10 text-slate-300 border border-white/10";
  }
}

function statusLabel(status: ComplianceMapping["status"]): string {
  switch (status) {
    case "COMPLIANT":
      return "Compliant";
    case "PARTIAL":
      return "Partial";
    case "NON_COMPLIANT":
      return "Non-Compliant";
    default:
      return status;
  }
}

function statusBorderColor(status: ComplianceMapping["status"]): string {
  switch (status) {
    case "COMPLIANT":
      return "border-l-green-500";
    case "PARTIAL":
      return "border-l-amber-500";
    case "NON_COMPLIANT":
      return "border-l-red-500";
    default:
      return "border-l-white/20";
  }
}

export default function ComplianceFrameworkTabs({
  mappings,
}: ComplianceFrameworkTabsProps) {
  const frameworks = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of mappings) {
      if (!seen.has(m.framework)) {
        seen.add(m.framework);
        result.push(m.framework);
      }
    }
    return result;
  }, [mappings]);

  const [activeTab, setActiveTab] = useState<string>(frameworks[0] ?? "");

  // Sync activeTab when frameworks first load (initial render has no mappings yet)
  useEffect(() => {
    if (activeTab === "" && frameworks.length > 0) {
      setActiveTab(frameworks[0]);
    }
  }, [frameworks, activeTab]);

  const filteredMappings = useMemo(
    () => mappings.filter((m) => m.framework === activeTab),
    [mappings, activeTab]
  );

  const summaryCounts = useMemo(() => {
    const compliant = filteredMappings.filter(
      (m) => m.status === "COMPLIANT"
    ).length;
    const partial = filteredMappings.filter(
      (m) => m.status === "PARTIAL"
    ).length;
    const nonCompliant = filteredMappings.filter(
      (m) => m.status === "NON_COMPLIANT"
    ).length;
    return { compliant, partial, nonCompliant };
  }, [filteredMappings]);

  if (frameworks.length === 0) {
    return (
      <div className="glass-panel-sm p-6 text-center">
        <p className="text-white/40 text-sm">
          No compliance mappings available.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {frameworks.map((fw) => (
          <button
            key={fw}
            onClick={() => setActiveTab(fw)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === fw
                ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
                : "glass-panel-sm text-white/50 hover:text-white/70 hover:bg-white/10"
            }`}
          >
            {fw}
          </button>
        ))}
      </div>

      {/* Summary Counts */}
      <div className="flex gap-4 mb-5">
        <span className="text-xs text-green-400">
          {summaryCounts.compliant} compliant
        </span>
        <span className="text-xs text-amber-400">
          {summaryCounts.partial} partial
        </span>
        <span className="text-xs text-red-400">
          {summaryCounts.nonCompliant} non-compliant
        </span>
      </div>

      {/* Requirements List */}
      <div className="space-y-3">
        {filteredMappings.map((mapping) => (
          <div
            key={mapping.id}
            className={`glass-panel-sm p-4 border-l-4 ${statusBorderColor(mapping.status)}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90">
                  {mapping.requirement}
                </p>
                {mapping.description && (
                  <p className="text-xs text-white/40 mt-1">
                    {mapping.description}
                  </p>
                )}
                <span className="inline-block mt-2 text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded">
                  {mapping.entityType}
                </span>
              </div>
              <span
                className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyle(mapping.status)}`}
              >
                {statusLabel(mapping.status)}
              </span>
            </div>
          </div>
        ))}

        {filteredMappings.length === 0 && (
          <div className="glass-panel-sm p-6 text-center">
            <p className="text-white/40 text-sm">
              No requirements mapped for {activeTab}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
