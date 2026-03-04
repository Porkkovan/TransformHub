"use client";

import React from "react";

interface StatusIndicatorProps {
  status: "online" | "running" | "completed" | "failed" | "pending";
  label?: string;
}

const statusStyles: Record<string, { dot: string; animate?: string }> = {
  online: { dot: "bg-green-500" },
  completed: { dot: "bg-green-500" },
  running: { dot: "bg-blue-500", animate: "animate-pulse" },
  failed: { dot: "bg-red-500" },
  pending: { dot: "bg-amber-500" },
};

export default function StatusIndicator({
  status,
  label,
}: StatusIndicatorProps) {
  const style = statusStyles[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${style.dot} ${style.animate ?? ""}`}
      />
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </div>
  );
}
