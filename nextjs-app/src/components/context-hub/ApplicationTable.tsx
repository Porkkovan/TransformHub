"use client";

import React, { useState, useRef, useCallback } from "react";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import type { ContextApplication } from "@/hooks/useApplicationPortfolio";

interface ApplicationTableProps {
  applications: ContextApplication[];
  onAdd: (app: {
    name: string;
    vendor?: string;
    status?: string;
    businessSegment?: string;
    technologyStack?: string[];
    businessCriticality?: string;
    annualCost?: number | null;
    userCount?: number | null;
  }) => Promise<boolean>;
  onBulkImport: (apps: { name: string; vendor?: string; status?: string; businessSegment?: string; technologyStack?: string[]; businessCriticality?: string }[]) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  actionLoading: boolean;
}

const statusVariant: Record<string, "info" | "success" | "warning" | "danger" | "default"> = {
  active: "success",
  planned: "info",
  deprecated: "warning",
  sunset: "danger",
};

const criticalityVariant: Record<string, "danger" | "warning" | "default"> = {
  high: "danger",
  medium: "warning",
  low: "default",
};

export default function ApplicationTable({
  applications,
  onAdd,
  onBulkImport,
  onDelete,
  actionLoading,
}: ApplicationTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApp, setNewApp] = useState({
    name: "",
    vendor: "",
    status: "active",
    businessSegment: "",
    technologyStack: "",
    businessCriticality: "medium",
    annualCost: "",
    userCount: "",
  });
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(async () => {
    if (!newApp.name.trim()) return;
    const success = await onAdd({
      name: newApp.name.trim(),
      vendor: newApp.vendor.trim() || undefined,
      status: newApp.status,
      businessSegment: newApp.businessSegment.trim() || undefined,
      technologyStack: newApp.technologyStack
        ? newApp.technologyStack.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      businessCriticality: newApp.businessCriticality,
      annualCost: newApp.annualCost ? parseFloat(newApp.annualCost) : null,
      userCount: newApp.userCount ? parseInt(newApp.userCount, 10) : null,
    });
    if (success) {
      setNewApp({ name: "", vendor: "", status: "active", businessSegment: "", technologyStack: "", businessCriticality: "medium", annualCost: "", userCount: "" });
      setShowAddForm(false);
    }
  }, [newApp, onAdd]);

  const handleCSVImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) return;

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = headers.indexOf("name");
        if (nameIdx === -1) return;

        const vendorIdx = headers.indexOf("vendor");
        const statusIdx = headers.indexOf("status");
        const segmentIdx = headers.indexOf("businesssegment") !== -1 ? headers.indexOf("businesssegment") : headers.indexOf("segment");
        const techIdx = headers.indexOf("technologystack") !== -1 ? headers.indexOf("technologystack") : headers.indexOf("tech");
        const critIdx = headers.indexOf("businesscriticality") !== -1 ? headers.indexOf("businesscriticality") : headers.indexOf("criticality");

        const apps = lines.slice(1).map((line) => {
          const cols = line.split(",").map((c) => c.trim());
          return {
            name: cols[nameIdx] || "",
            vendor: vendorIdx >= 0 ? cols[vendorIdx] : undefined,
            status: statusIdx >= 0 ? cols[statusIdx] : "active",
            businessSegment: segmentIdx >= 0 ? cols[segmentIdx] : undefined,
            technologyStack: techIdx >= 0 && cols[techIdx] ? cols[techIdx].split(";").map((s) => s.trim()) : [],
            businessCriticality: critIdx >= 0 ? cols[critIdx] : "medium",
          };
        }).filter((a) => a.name);

        if (apps.length > 0) {
          await onBulkImport(apps);
        }
      };
      reader.readAsText(file);
      if (csvInputRef.current) csvInputRef.current.value = "";
    },
    [onBulkImport]
  );

  const formatCost = (cost: number | null | undefined) => {
    if (cost == null) return "—";
    return `$${cost.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <GlassButton onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "Add Application"}
        </GlassButton>
        <GlassButton onClick={() => csvInputRef.current?.click()} disabled={actionLoading}>
          Import CSV
        </GlassButton>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          onChange={handleCSVImport}
          className="hidden"
        />
      </div>

      {showAddForm && (
        <div className="glass-panel p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">New Application</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="glass-input"
              placeholder="Name *"
              value={newApp.name}
              onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
            />
            <input
              className="glass-input"
              placeholder="Vendor"
              value={newApp.vendor}
              onChange={(e) => setNewApp({ ...newApp, vendor: e.target.value })}
            />
            <select
              className="glass-input appearance-none"
              value={newApp.status}
              onChange={(e) => setNewApp({ ...newApp, status: e.target.value })}
            >
              <option value="active" className="bg-[#0a0e12]">Active</option>
              <option value="planned" className="bg-[#0a0e12]">Planned</option>
              <option value="deprecated" className="bg-[#0a0e12]">Deprecated</option>
              <option value="sunset" className="bg-[#0a0e12]">Sunset</option>
            </select>
            <input
              className="glass-input"
              placeholder="Business Segment"
              value={newApp.businessSegment}
              onChange={(e) => setNewApp({ ...newApp, businessSegment: e.target.value })}
            />
            <input
              className="glass-input"
              placeholder="Tech Stack (comma-separated)"
              value={newApp.technologyStack}
              onChange={(e) => setNewApp({ ...newApp, technologyStack: e.target.value })}
            />
            <select
              className="glass-input appearance-none"
              value={newApp.businessCriticality}
              onChange={(e) => setNewApp({ ...newApp, businessCriticality: e.target.value })}
            >
              <option value="high" className="bg-[#0a0e12]">High</option>
              <option value="medium" className="bg-[#0a0e12]">Medium</option>
              <option value="low" className="bg-[#0a0e12]">Low</option>
            </select>
            <input
              className="glass-input"
              type="number"
              placeholder="Annual Cost ($)"
              value={newApp.annualCost}
              onChange={(e) => setNewApp({ ...newApp, annualCost: e.target.value })}
            />
            <input
              className="glass-input"
              type="number"
              placeholder="User Count"
              value={newApp.userCount}
              onChange={(e) => setNewApp({ ...newApp, userCount: e.target.value })}
            />
          </div>
          <GlassButton onClick={handleAdd} disabled={actionLoading || !newApp.name.trim()}>
            Save Application
          </GlassButton>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/40 text-sm">No applications in portfolio. Add one above or import from CSV.</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Segment</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Tech Stack</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Criticality</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Users</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-200 font-medium">{app.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{app.vendor || "—"}</td>
                    <td className="px-4 py-3">
                      <GlassBadge variant={statusVariant[app.status] || "default"}>{app.status}</GlassBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{app.businessSegment || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {app.technologyStack.slice(0, 3).map((tech, i) => (
                          <span key={i} className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded">
                            {tech}
                          </span>
                        ))}
                        {app.technologyStack.length > 3 && (
                          <span className="text-xs text-white/40">+{app.technologyStack.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <GlassBadge variant={criticalityVariant[app.businessCriticality] || "default"}>
                        {app.businessCriticality}
                      </GlassBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{formatCost(app.annualCost)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{app.userCount?.toLocaleString() || "—"}</td>
                    <td className="px-4 py-3">
                      <GlassButton
                        variant="danger"
                        onClick={() => onDelete(app.id)}
                        disabled={actionLoading}
                        className="text-xs !px-3 !py-1"
                      >
                        Delete
                      </GlassButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
