"use client";

import React from "react";

interface AutomationMix {
  productName: string;
  rpa: number;
  aiMl: number;
  agentBased: number;
  conversational: number;
  analytics: number;
}

interface AutomationBreakdownPanelProps {
  products: AutomationMix[];
}

const SEGMENTS = [
  { key: "rpa" as const, label: "RPA", color: "bg-orange-500", textColor: "text-orange-300" },
  { key: "aiMl" as const, label: "AI/ML", color: "bg-blue-500", textColor: "text-blue-300" },
  { key: "agentBased" as const, label: "Agent", color: "bg-purple-500", textColor: "text-purple-300" },
  { key: "conversational" as const, label: "Conversational", color: "bg-green-500", textColor: "text-green-300" },
  { key: "analytics" as const, label: "Analytics", color: "bg-cyan-500", textColor: "text-cyan-300" },
];

export default function AutomationBreakdownPanel({
  products,
}: AutomationBreakdownPanelProps) {
  return (
    <div className="space-y-3">
      {products.map((product) => {
        const total =
          product.rpa +
          product.aiMl +
          product.agentBased +
          product.conversational +
          product.analytics;

        return (
          <div key={product.productName} className="glass-panel-sm p-4">
            {/* Product name and total */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white truncate max-w-[60%]" title={product.productName}>
                {product.productName}
              </span>
              <span className="text-xs text-white/40">
                {total}% total
              </span>
            </div>

            {/* Stacked horizontal bar */}
            <div className="w-full h-6 rounded-md bg-white/5 overflow-hidden flex">
              {SEGMENTS.map((seg) => {
                const value = product[seg.key];
                if (value <= 0) return null;
                const widthPercent = total > 0 ? (value / total) * 100 : 0;
                return (
                  <div
                    key={seg.key}
                    className={`h-full ${seg.color}/70 flex items-center justify-center transition-all duration-300`}
                    style={{ width: `${widthPercent}%` }}
                    title={`${seg.label}: ${value}%`}
                  >
                    {widthPercent >= 10 && (
                      <span className="text-[10px] font-medium text-white/90">
                        {value}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Per-segment labels */}
            <div className="flex flex-wrap gap-3 mt-2">
              {SEGMENTS.map((seg) => {
                const value = product[seg.key];
                if (value <= 0) return null;
                return (
                  <span key={seg.key} className={`text-[10px] ${seg.textColor}/70`}>
                    {seg.label} {value}%
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <div className={`w-3 h-2 rounded-sm ${seg.color}/70`} />
            <span className="text-[10px] text-white/40">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
