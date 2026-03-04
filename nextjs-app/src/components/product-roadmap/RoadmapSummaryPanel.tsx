"use client";

import React from "react";
import type { RoadmapItem } from "@/hooks/useProductRoadmap";

interface RoadmapSummaryPanelProps {
  items: RoadmapItem[];
}

export default function RoadmapSummaryPanel({ items }: RoadmapSummaryPanelProps) {
  const totalItems = items.length;
  const byStatus = {
    planned: items.filter((i) => i.status === "planned").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    completed: items.filter((i) => i.status === "completed").length,
    deferred: items.filter((i) => i.status === "deferred").length,
  };
  const byApproval = {
    PENDING: items.filter((i) => i.approvalStatus === "PENDING").length,
    APPROVED: items.filter((i) => i.approvalStatus === "APPROVED").length,
    REJECTED: items.filter((i) => i.approvalStatus === "REJECTED").length,
  };
  const avgRice = totalItems > 0 ? items.reduce((s, i) => s + i.riceScore, 0) / totalItems : 0;
  const top5 = [...items].sort((a, b) => b.riceScore - a.riceScore).slice(0, 5);

  // Category distribution
  const categories: Record<string, number> = {};
  items.forEach((i) => {
    categories[i.category] = (categories[i.category] || 0) + 1;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Stats */}
      <div className="glass-panel-sm p-4 space-y-3">
        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Overview</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-2xl font-bold text-white">{totalItems}</p>
            <p className="text-[10px] text-white/40">Total Items</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-cyan-400">{avgRice.toFixed(1)}</p>
            <p className="text-[10px] text-white/40">Avg RICE</p>
          </div>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Planned</span>
            <span className="text-white/70">{byStatus.planned}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-blue-400">In Progress</span>
            <span className="text-white/70">{byStatus.in_progress}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-green-400">Completed</span>
            <span className="text-white/70">{byStatus.completed}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-orange-400">Deferred</span>
            <span className="text-white/70">{byStatus.deferred}</span>
          </div>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-amber-400">Pending Review</span>
            <span className="text-white/70">{byApproval.PENDING}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-green-400">Approved</span>
            <span className="text-white/70">{byApproval.APPROVED}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-red-400">Rejected</span>
            <span className="text-white/70">{byApproval.REJECTED}</span>
          </div>
        </div>
      </div>

      {/* Top 5 Priorities */}
      <div className="glass-panel-sm p-4 space-y-3">
        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Top 5 Priority</h4>
        <div className="space-y-2">
          {top5.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-white/30 w-4">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/80 truncate">{item.capabilityName}</p>
                <p className="text-[10px] text-white/30">{item.quarter}</p>
              </div>
              <span className="text-xs font-bold text-cyan-400">{item.riceScore.toFixed(1)}</span>
            </div>
          ))}
          {top5.length === 0 && (
            <p className="text-xs text-white/20 text-center py-4">No items yet</p>
          )}
        </div>
      </div>

      {/* Category Distribution */}
      <div className="glass-panel-sm p-4 space-y-3">
        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Categories</h4>
        <div className="space-y-2">
          {Object.entries(categories)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => {
              const pct = totalItems > 0 ? (count / totalItems) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-white/60">
                      {cat.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                    </span>
                    <span className="text-[10px] text-white/40">{count}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div
                      className="bg-cyan-500/50 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          {Object.keys(categories).length === 0 && (
            <p className="text-xs text-white/20 text-center py-4">No data</p>
          )}
        </div>
      </div>
    </div>
  );
}
