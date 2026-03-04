"use client";

import React from "react";
import RoadmapCapabilityCard from "./RoadmapCapabilityCard";
import type { RoadmapItem } from "@/hooks/useProductRoadmap";

interface RoadmapTimelineProps {
  items: RoadmapItem[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onEdit?: (id: string, updates: { capabilityName?: string; description?: string; quarter?: string }) => void;
}

const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];

const QUARTER_COLORS: Record<string, string> = {
  "Q1 2026": "border-blue-500/40",
  "Q2 2026": "border-green-500/40",
  "Q3 2026": "border-purple-500/40",
  "Q4 2026": "border-orange-500/40",
};

export default function RoadmapTimeline({
  items,
  onApprove,
  onReject,
  onStatusChange,
  onEdit,
}: RoadmapTimelineProps) {
  // Group items by quarter
  const grouped = QUARTERS.reduce((acc, q) => {
    acc[q] = items
      .filter((item) => item.quarter === q)
      .sort((a, b) => b.riceScore - a.riceScore);
    return acc;
  }, {} as Record<string, RoadmapItem[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {QUARTERS.map((quarter) => (
        <div key={quarter} className={`glass-panel-sm rounded-xl border-t-2 ${QUARTER_COLORS[quarter] || "border-white/20"}`}>
          {/* Quarter header */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/90">{quarter}</h3>
              <span className="text-[10px] text-white/40 font-medium">
                {grouped[quarter]?.length || 0} items
              </span>
            </div>
            {/* Mini score summary */}
            {grouped[quarter]?.length > 0 && (
              <p className="text-[10px] text-white/30 mt-1">
                Avg RICE: {(grouped[quarter].reduce((s, i) => s + i.riceScore, 0) / grouped[quarter].length).toFixed(1)}
              </p>
            )}
          </div>

          {/* Cards */}
          <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
            {grouped[quarter]?.length > 0 ? (
              grouped[quarter].map((item) => (
                <RoadmapCapabilityCard
                  key={item.id}
                  item={item}
                  onApprove={onApprove}
                  onReject={onReject}
                  onStatusChange={onStatusChange}
                  onEdit={onEdit}
                />
              ))
            ) : (
              <p className="text-xs text-white/20 text-center py-8">No items planned</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
