"use client";

import { useMemo } from "react";

type AgentStatus = "pending" | "running" | "completed" | "failed";

interface PipelineAgent {
  agentType: string;
  status: AgentStatus;
  errorMessage?: string | null;
}

interface PipelineGraphProps {
  /** Layers of agents that run in parallel within each layer */
  layers: string[][];
  /** Current status of each agent in the pipeline */
  agentStatuses: PipelineAgent[];
  className?: string;
}

const statusConfig: Record<
  AgentStatus,
  { bg: string; border: string; text: string; ring: string; icon: string }
> = {
  pending: {
    bg: "bg-white/5",
    border: "border-white/10",
    text: "text-white/40",
    ring: "",
    icon: "",
  },
  running: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    ring: "ring-2 ring-blue-500/20 animate-pulse",
    icon: "",
  },
  completed: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    ring: "",
    icon: "\u2713",
  },
  failed: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    ring: "ring-2 ring-red-500/20",
    icon: "\u2717",
  },
};

export default function PipelineGraph({
  layers,
  agentStatuses,
  className = "",
}: PipelineGraphProps) {
  // Build a lookup map for agent statuses
  const statusMap = useMemo(() => {
    const map: Record<string, PipelineAgent> = {};
    for (const agent of agentStatuses) {
      map[agent.agentType] = agent;
    }
    return map;
  }, [agentStatuses]);

  const getAgentStatus = (agentType: string): AgentStatus => {
    return (statusMap[agentType]?.status as AgentStatus) || "pending";
  };

  const getAgentError = (agentType: string): string | null => {
    return statusMap[agentType]?.errorMessage || null;
  };

  const formatAgentName = (agentType: string): string => {
    return agentType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Compute overall layer status
  const getLayerStatus = (layer: string[]): AgentStatus => {
    const statuses = layer.map(getAgentStatus);
    if (statuses.some((s) => s === "failed")) return "failed";
    if (statuses.some((s) => s === "running")) return "running";
    if (statuses.every((s) => s === "completed")) return "completed";
    return "pending";
  };

  return (
    <div className={`glass-panel p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-6">
        Pipeline Execution Graph
      </h3>

      <div className="space-y-3">
        {layers.map((layer, layerIdx) => {
          const layerStatus = getLayerStatus(layer);
          const layerConfig = statusConfig[layerStatus];

          return (
            <div key={layerIdx}>
              {/* Layer connector */}
              {layerIdx > 0 && (
                <div className="flex justify-center py-2">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-0.5 h-6 ${
                        getLayerStatus(layers[layerIdx - 1]) === "completed"
                          ? "bg-green-500/40"
                          : "bg-white/10"
                      }`}
                    />
                    <svg
                      className={`w-3 h-3 -mt-0.5 ${
                        getLayerStatus(layers[layerIdx - 1]) === "completed"
                          ? "text-green-500/40"
                          : "text-white/10"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 16l-6-6h12z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Layer label */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
                  Layer {layerIdx + 1}
                </span>
                <div className="flex-1 h-px bg-white/5" />
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider ${layerConfig.text}`}
                >
                  {layerStatus}
                </span>
              </div>

              {/* Agent nodes */}
              <div className="flex flex-wrap gap-3">
                {layer.map((agentType) => {
                  const status = getAgentStatus(agentType);
                  const config = statusConfig[status];
                  const error = getAgentError(agentType);

                  return (
                    <div
                      key={agentType}
                      className={`
                        relative group flex-1 min-w-[140px] max-w-[220px]
                        rounded-xl border p-4
                        ${config.bg} ${config.border} ${config.ring}
                        transition-all duration-300
                      `}
                    >
                      {/* Status icon */}
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${config.bg} ${config.text} border ${config.border}`}
                        >
                          {config.icon ||
                            (status === "running" ? (
                              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            ) : (
                              <span className="text-[10px]">
                                {layerIdx + 1}
                              </span>
                            ))}
                        </div>

                        {status === "running" && (
                          <div className="flex gap-0.5">
                            <div className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" />
                            <div
                              className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            />
                            <div
                              className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Agent name */}
                      <p
                        className={`text-xs font-medium ${config.text} truncate`}
                        title={formatAgentName(agentType)}
                      >
                        {formatAgentName(agentType)}
                      </p>

                      {/* Error tooltip */}
                      {error && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-red-900/90 backdrop-blur-sm border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-200 max-w-[200px] whitespace-pre-wrap shadow-xl">
                            {error}
                          </div>
                          <div className="w-2 h-2 bg-red-900/90 border-r border-b border-red-500/30 rotate-45 mx-auto -mt-1" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-6 pt-4 border-t border-white/5">
        {(["pending", "running", "completed", "failed"] as AgentStatus[]).map(
          (status) => {
            const config = statusConfig[status];
            return (
              <div key={status} className="flex items-center gap-1.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${config.bg} border ${config.border} ${
                    status === "running" ? "animate-pulse" : ""
                  }`}
                />
                <span className="text-[10px] text-white/40 capitalize">
                  {status}
                </span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
