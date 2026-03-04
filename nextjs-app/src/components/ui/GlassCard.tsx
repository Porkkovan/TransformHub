"use client";

import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  padding?: string;
}

export default function GlassCard({
  children,
  className = "",
  title,
  padding = "p-6",
}: GlassCardProps) {
  return (
    <div className={`glass-panel ${padding} ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
