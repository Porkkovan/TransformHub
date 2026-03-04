"use client";

import React from "react";
import GlassBadge from "@/components/ui/GlassBadge";
import GlassButton from "@/components/ui/GlassButton";
import InlineEditText from "@/components/ui/InlineEditText";
import type { RoadmapItem } from "@/hooks/useProductRoadmap";

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  RPA_AUTOMATION: { bg: "bg-orange-500/20", text: "text-orange-300", border: "border-orange-500/30" },
  AI_ML_INTEGRATION: { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/30" },
  AGENT_BASED: { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/30" },
  CONVERSATIONAL_AI: { bg: "bg-green-500/20", text: "text-green-300", border: "border-green-500/30" },
  ADVANCED_ANALYTICS: { bg: "bg-cyan-500/20", text: "text-cyan-300", border: "border-cyan-500/30" },
};

const DEFAULT_STYLE = { bg: "bg-white/10", text: "text-slate-300", border: "border-white/10" };

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  planned: { color: "bg-slate-500/30 text-slate-300", label: "Planned" },
  in_progress: { color: "bg-blue-500/30 text-blue-300", label: "In Progress" },
  completed: { color: "bg-green-500/30 text-green-300", label: "Completed" },
  deferred: { color: "bg-orange-500/30 text-orange-300", label: "Deferred" },
};

const APPROVAL_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

function formatCategory(category: string): string {
  return category.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];

interface RoadmapCapabilityCardProps {
  item: RoadmapItem;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onEdit?: (id: string, updates: { capabilityName?: string; description?: string; quarter?: string }) => void;
}

export default function RoadmapCapabilityCard({
  item,
  onApprove,
  onReject,
  onStatusChange,
  onEdit,
}: RoadmapCapabilityCardProps) {
  const catStyle = CATEGORY_STYLES[item.category] || DEFAULT_STYLE;
  const statusInfo = STATUS_STYLES[item.status] || STATUS_STYLES.planned;

  return (
    <div className="glass-panel-sm p-4 flex flex-col gap-2.5">
      {/* Header row: category + source */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
          {formatCategory(item.category)}
        </span>
        <span className="text-[10px] text-white/30 font-medium uppercase">
          {item.source === "agent" ? "Agent" : "Manual"}
        </span>
      </div>

      {/* Capability name */}
      <InlineEditText
        value={item.capabilityName}
        onSave={(val) => onEdit?.(item.id, { capabilityName: val })}
        displayClassName="text-sm font-semibold text-white/90 leading-tight"
        disabled={!onEdit}
      />

      {/* Parent references */}
      {item.itemType === "capability" && (
        <div className="flex flex-wrap gap-1.5">
          {item.digitalProduct?.name && (
            <span className="text-[10px] text-blue-300/70 bg-blue-500/10 px-1.5 py-0.5 rounded">
              Product: {item.digitalProduct.name}
            </span>
          )}
          {item.initiative && (
            <span className="text-[10px] text-purple-300/70 bg-purple-500/10 px-1.5 py-0.5 rounded">
              {item.initiative}
            </span>
          )}
        </div>
      )}
      {item.itemType === "functionality" && (
        <div className="flex flex-wrap gap-1.5">
          {item.digitalCapability?.name && (
            <span className="text-[10px] text-green-300/70 bg-green-500/10 px-1.5 py-0.5 rounded">
              Capability: {item.digitalCapability.name}
            </span>
          )}
          {item.digitalProduct?.name && (
            <span className="text-[10px] text-blue-300/70 bg-blue-500/10 px-1.5 py-0.5 rounded">
              Product: {item.digitalProduct.name}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      <InlineEditText
        value={item.description ?? ""}
        onSave={(val) => onEdit?.(item.id, { description: val })}
        placeholder="Add description…"
        multiline
        displayClassName="text-[11px] text-white/40 leading-relaxed"
        disabled={!onEdit}
      />

      {/* RICE Score Breakdown */}
      <div className="flex items-center gap-2 text-[10px] text-white/50 font-mono">
        <span>R:{item.reach}</span>
        <span className="text-white/20">·</span>
        <span>I:{item.impact}</span>
        <span className="text-white/20">·</span>
        <span>C:{item.confidence}</span>
        <span className="text-white/20">/</span>
        <span>E:{item.effort}</span>
        <span className="text-white/20">=</span>
        <span className="text-cyan-400 font-bold text-xs">{item.riceScore.toFixed(1)}</span>
      </div>

      {/* Status + Approval */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        <GlassBadge variant={APPROVAL_VARIANT[item.approvalStatus] || "warning"}>
          {item.approvalStatus}
        </GlassBadge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {item.approvalStatus === "PENDING" && (
          <>
            {onApprove && (
              <GlassButton variant="success" onClick={() => onApprove(item.id)} className="!text-[10px] !px-2 !py-1">
                Approve
              </GlassButton>
            )}
            {onReject && (
              <GlassButton variant="danger" onClick={() => onReject(item.id)} className="!text-[10px] !px-2 !py-1">
                Reject
              </GlassButton>
            )}
          </>
        )}
        {onStatusChange && (
          <select
            value={item.status}
            onChange={(e) => onStatusChange(item.id, e.target.value)}
            className="glass-input !text-[10px] !py-1 !px-2 appearance-none cursor-pointer"
          >
            <option value="planned" className="bg-[#0a0e12]">Planned</option>
            <option value="in_progress" className="bg-[#0a0e12]">In Progress</option>
            <option value="completed" className="bg-[#0a0e12]">Completed</option>
            <option value="deferred" className="bg-[#0a0e12]">Deferred</option>
          </select>
        )}
        {onEdit && (
          <select
            value={item.quarter}
            onChange={(e) => onEdit(item.id, { quarter: e.target.value })}
            className="glass-input !text-[10px] !py-1 !px-2 appearance-none cursor-pointer"
            title="Move to quarter"
          >
            {QUARTERS.map((q) => (
              <option key={q} value={q} className="bg-[#0a0e12]">{q}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
