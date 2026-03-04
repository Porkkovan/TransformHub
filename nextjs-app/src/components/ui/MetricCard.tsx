"use client";

import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon?: string;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
}: MetricCardProps) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>

          {(trend || subtitle) && (
            <div className="mt-2 flex items-center gap-2">
              {trend && (
                <span
                  className={`flex items-center text-sm font-medium ${
                    trend === "up" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {trend === "up" ? (
                    <svg
                      className="h-4 w-4 mr-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4 mr-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  )}
                  {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="text-sm text-slate-400">{subtitle}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div className="flex-shrink-0 rounded-xl bg-white/5 p-3">
            <svg
              className="h-6 w-6 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d={icon}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
