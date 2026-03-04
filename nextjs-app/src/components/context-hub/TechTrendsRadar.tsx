"use client";

import React, { useState, useMemo } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassSelect from "@/components/ui/GlassSelect";
import { useTechTrends, type TechTrend } from "@/hooks/useTechTrends";

interface TechTrendsRadarProps {
  organizationId: string;
}

const CATEGORIES = [
  { value: "AI_ML", label: "AI / ML", color: "#60a5fa" },
  { value: "CLOUD", label: "Cloud", color: "#34d399" },
  { value: "SECURITY", label: "Security", color: "#f87171" },
  { value: "DATA", label: "Data", color: "#a78bfa" },
  { value: "DEVOPS", label: "DevOps", color: "#fbbf24" },
  { value: "OTHER", label: "Other", color: "#94a3b8" },
];

const MATURITY_LEVELS = [
  { value: "ADOPT", label: "Adopt" },
  { value: "TRIAL", label: "Trial" },
  { value: "ASSESS", label: "Assess" },
  { value: "HOLD", label: "Hold" },
];

const RINGS: Record<string, number> = {
  ADOPT: 0.2,
  TRIAL: 0.4,
  ASSESS: 0.65,
  HOLD: 0.88,
};

const categoryOptions = CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
const maturityOptions = MATURITY_LEVELS.map((m) => ({ value: m.value, label: m.label }));
const maturityVariant: Record<string, "success" | "info" | "warning" | "danger"> = {
  ADOPT: "success",
  TRIAL: "info",
  ASSESS: "warning",
  HOLD: "danger",
};

function getCategoryColor(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.color || "#94a3b8";
}

// Simple hash for deterministic jitter per trend
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export default function TechTrendsRadar({ organizationId }: TechTrendsRadarProps) {
  const {
    trends,
    loading,
    error,
    actionLoading,
    addTrend,
    deleteTrend,
  } = useTechTrends(organizationId);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "AI_ML",
    maturityLevel: "ASSESS",
    description: "",
    impactScore: 5,
    adoptionTimeline: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await addTrend({
      name: formData.name,
      category: formData.category,
      maturityLevel: formData.maturityLevel,
      description: formData.description || undefined,
      impactScore: formData.impactScore,
      adoptionTimeline: formData.adoptionTimeline || undefined,
    });
    if (success) {
      setFormData({ name: "", category: "AI_ML", maturityLevel: "ASSESS", description: "", impactScore: 5, adoptionTimeline: "" });
      setShowForm(false);
    }
  };

  // Generate positions for radar dots
  const dotPositions = useMemo(() => {
    const cx = 200;
    const cy = 200;
    const maxR = 180;

    return trends.map((trend) => {
      const ring = RINGS[trend.maturityLevel] ?? 0.65;
      const hash = simpleHash(trend.id);
      const angle = ((hash % 360) / 360) * 2 * Math.PI;
      const jitter = ((hash >> 8) % 20 - 10) / 100;
      const r = (ring + jitter) * maxR;

      return {
        trend,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        color: getCategoryColor(trend.category),
      };
    });
  }, [trends]);

  if (loading) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-white/40 text-sm">Loading tech trends...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="glass-panel p-3 border border-red-500/30 bg-red-500/10">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">
          Technology Radar
          <span className="text-white/40 text-sm font-normal ml-2">({trends.length} trends)</span>
        </h2>
        <GlassButton onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Trend"}
        </GlassButton>
      </div>

      {/* Add Form */}
      {showForm && (
        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Kubernetes, LLM Fine-Tuning"
                  className="glass-input"
                  required
                />
              </div>
              <GlassSelect
                label="Category *"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                options={categoryOptions}
              />
              <GlassSelect
                label="Maturity Level *"
                value={formData.maturityLevel}
                onChange={(e) => setFormData({ ...formData, maturityLevel: e.target.value })}
                options={maturityOptions}
              />
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Impact Score (1-10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.impactScore}
                  onChange={(e) => setFormData({ ...formData, impactScore: parseInt(e.target.value) || 5 })}
                  className="glass-input"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Adoption Timeline</label>
                <input
                  type="text"
                  value={formData.adoptionTimeline}
                  onChange={(e) => setFormData({ ...formData, adoptionTimeline: e.target.value })}
                  placeholder="e.g., Q3 2026, 6-12 months"
                  className="glass-input"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                  className="glass-input"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <GlassButton type="submit" disabled={actionLoading || !formData.name.trim()}>
                {actionLoading ? "Adding..." : "Add Trend"}
              </GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      {/* SVG Radar */}
      <GlassCard padding="p-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-shrink-0 flex justify-center">
            <svg viewBox="0 0 400 400" width="400" height="400" className="max-w-full h-auto">
              {/* Ring backgrounds */}
              {[0.88, 0.65, 0.4, 0.2].map((ring, i) => (
                <circle
                  key={i}
                  cx="200"
                  cy="200"
                  r={ring * 180}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />
              ))}

              {/* Cross lines */}
              <line x1="200" y1="20" x2="200" y2="380" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <line x1="20" y1="200" x2="380" y2="200" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

              {/* Ring labels */}
              <text x="200" y={200 - 0.2 * 180 + 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10">ADOPT</text>
              <text x="200" y={200 - 0.4 * 180 + 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10">TRIAL</text>
              <text x="200" y={200 - 0.65 * 180 + 4} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="10">ASSESS</text>
              <text x="200" y={200 - 0.88 * 180 + 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10">HOLD</text>

              {/* Trend dots */}
              {dotPositions.map(({ trend, x, y, color }) => (
                <g key={trend.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={6}
                    fill={color}
                    opacity={0.85}
                    stroke={color}
                    strokeWidth="2"
                    strokeOpacity="0.3"
                  />
                  <title>{`${trend.name} (${trend.category} - ${trend.maturityLevel})`}</title>
                </g>
              ))}
            </svg>
          </div>

          {/* Category Legend */}
          <div className="flex flex-wrap lg:flex-col gap-3 lg:gap-2 lg:pt-4">
            {CATEGORIES.map((cat) => {
              const count = trends.filter((t) => t.category === cat.value).length;
              if (count === 0) return null;
              return (
                <div key={cat.value} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-white/60 text-sm">
                    {cat.label} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Trends Table */}
      {trends.length > 0 ? (
        <GlassCard padding="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Maturity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Impact</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Timeline</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((trend: TechTrend) => (
                  <tr key={trend.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-200">{trend.name}</p>
                        {trend.description && (
                          <p className="text-xs text-white/40 mt-0.5 truncate max-w-[250px]">{trend.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getCategoryColor(trend.category) }}
                        />
                        {CATEGORIES.find((c) => c.value === trend.category)?.label || trend.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <GlassBadge variant={maturityVariant[trend.maturityLevel] || "default"}>
                        {trend.maturityLevel}
                      </GlassBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{trend.impactScore}/10</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{trend.adoptionTimeline || "—"}</td>
                    <td className="px-4 py-3">
                      <GlassButton
                        variant="danger"
                        onClick={() => deleteTrend(trend.id)}
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
        </GlassCard>
      ) : (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/40 text-sm">
            No tech trends added yet. Click &ldquo;Add Trend&rdquo; to start building your technology radar.
          </p>
        </div>
      )}
    </div>
  );
}
