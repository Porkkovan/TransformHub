"use client";

import React from "react";

interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: "info" | "success" | "warning" | "danger" | "default";
}

const variantStyles: Record<string, string> = {
  info: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
  success: "bg-green-500/20 text-green-300 border border-green-500/30",
  warning: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  danger: "bg-red-500/20 text-red-300 border border-red-500/30",
  default: "bg-white/10 text-slate-300 border border-white/10",
};

export default function GlassBadge({
  children,
  variant = "default",
}: GlassBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
