"use client";

import { useMemo } from "react";
import MetricCard from "@/components/ui/MetricCard";
import { computeProductMetrics } from "@/lib/value-stream-metrics";
import { formatDuration } from "@/lib/format-duration";

interface StreamStep {
  name: string;
  type: string;
  duration: number;
}

interface ValueStreamMetricsPanelProps {
  productStreams: Record<string, { currentSteps: StreamStep[]; futureSteps: StreamStep[] }>;
  products: string[];
  mode?: "current" | "future";
}

export default function ValueStreamMetricsPanel({
  productStreams,
  products,
  mode = "current",
}: ValueStreamMetricsPanelProps) {
  const metricsPerProduct = useMemo(() => {
    return products
      .filter((name) => productStreams[name])
      .map((name) => {
        const steps = mode === "future"
          ? productStreams[name].futureSteps
          : productStreams[name].currentSteps;
        return computeProductMetrics(steps, name);
      });
  }, [productStreams, products, mode]);

  if (metricsPerProduct.length === 0) return null;

  return (
    <div className="space-y-6">
      {metricsPerProduct.map((metrics) => (
        <div key={metrics.productName} className="space-y-3">
          <h3 className="text-sm font-semibold text-white/80">{metrics.productName}</h3>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Lead Time"
              value={`${formatDuration(metrics.leadTime)}h`}
              subtitle="Total process duration"
              icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <MetricCard
              title="Manual Effort"
              value={`${formatDuration(metrics.manualPercentage)}%`}
              subtitle={`${formatDuration(metrics.manualEffort)}h of ${formatDuration(metrics.leadTime)}h`}
              icon="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
            <MetricCard
              title="Bottleneck Step"
              value={metrics.bottleneck}
              subtitle={`${formatDuration(metrics.bottleneckDuration)}h`}
              icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
            <MetricCard
              title="Step Count"
              value={metrics.stepCount}
              subtitle="Process steps"
              icon="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </div>

          {/* Bottleneck callout */}
          {metrics.bottleneck !== "N/A" && (
            <div className={`glass-panel-sm p-3 border-l-4 rounded-xl ${mode === "future" ? "border-l-green-500" : "border-l-amber-500"}`}>
              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 shrink-0 ${mode === "future" ? "text-green-400" : "text-amber-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className={`text-xs ${mode === "future" ? "text-green-300" : "text-amber-300"}`}>
                  Bottleneck: <span className={`font-semibold ${mode === "future" ? "text-green-200" : "text-amber-200"}`}>{metrics.bottleneck}</span> at {formatDuration(metrics.bottleneckDuration)}h
                  {metrics.leadTime > 0 && (
                    <> ({formatDuration((metrics.bottleneckDuration / metrics.leadTime) * 100)}% of lead time)</>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
