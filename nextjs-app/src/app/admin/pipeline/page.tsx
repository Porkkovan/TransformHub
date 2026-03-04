"use client";

import { useMemo } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePipeline, AgentStatus } from "@/hooks/usePipeline";

// Pipeline DAG layers: sequential execution order
const PIPELINE_LAYERS: { label: string; agents: string[] }[] = [
  { label: "Layer 1 - Source", agents: ["git"] },
  { label: "Layer 2 - Discovery", agents: ["discovery"] },
  { label: "Layer 3 - Analysis (Parallel)", agents: ["vsm", "risk", "arch", "market", "data_gov"] },
  { label: "Layer 4 - Strategy (Parallel)", agents: ["fiduciary", "product_transform"] },
  { label: "Layer 5 - Planning", agents: ["backlog"] },
  { label: "Layer 6 - Vision", agents: ["future_state"] },
];

const AGENT_LABELS: Record<string, string> = {
  git: "Git Ingestion",
  discovery: "Discovery",
  vsm: "Value Stream Mapping",
  risk: "Risk & Compliance",
  arch: "Architecture Review",
  market: "Market Analysis",
  data_gov: "Data Governance",
  fiduciary: "Fiduciary Analysis",
  product_transform: "Product Transformation",
  backlog: "Backlog & OKR",
  future_state: "Future State Vision",
};

const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; variant: "info" | "success" | "warning" | "danger" | "default" }> = {
  PENDING: { color: "text-white/40", bgColor: "bg-white/5", borderColor: "border-white/10", variant: "default" },
  QUEUED: { color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", variant: "info" },
  RUNNING: { color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", variant: "warning" },
  COMPLETED: { color: "text-green-400", bgColor: "bg-green-500/10", borderColor: "border-green-500/30", variant: "success" },
  FAILED: { color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/30", variant: "danger" },
  SKIPPED: { color: "text-white/30", bgColor: "bg-white/5", borderColor: "border-white/10", variant: "default" },
};

export default function PipelinePage() {
  const { currentOrg } = useOrganization();
  const {
    status: pipelineStatus,
    agentStatuses,
    loading,
    actionLoading,
    error,
    execute,
    retryAgent,
    skipAgent,
  } = usePipeline();

  const handleRunPipeline = () => execute(currentOrg?.id);

  // Build lookup of agent statuses by type
  const statusMap = useMemo(() => {
    const map: Record<string, AgentStatus> = {};
    for (const as of agentStatuses) {
      map[as.agentType] = as;
    }
    return map;
  }, [agentStatuses]);

  const getAgentStatus = (agentType: string): AgentStatus => {
    return statusMap[agentType] ?? { agentType, status: "PENDING" };
  };

  const pipelineOverallStatus = pipelineStatus?.status ?? "IDLE";

  const completedCount = agentStatuses.filter((a) => a.status === "COMPLETED").length;
  const totalAgents = PIPELINE_LAYERS.reduce((sum, layer) => sum + layer.agents.length, 0);
  const failedCount = agentStatuses.filter((a) => a.status === "FAILED").length;
  const runningCount = agentStatuses.filter((a) => a.status === "RUNNING").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-white/50 mt-1">
            Agent execution pipeline - visual DAG and orchestration
          </p>
        </div>
        <GlassButton
          onClick={handleRunPipeline}
          disabled={loading}
          variant={loading ? "default" : "success"}
        >
          {loading ? "Pipeline Running..." : "Run Full Analysis"}
        </GlassButton>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Pipeline Status</p>
          <p className={`text-xl font-bold mt-1 ${
            pipelineOverallStatus === "COMPLETED" ? "text-green-400" :
            pipelineOverallStatus === "RUNNING" ? "text-amber-400" :
            pipelineOverallStatus === "FAILED" ? "text-red-400" :
            "text-white/50"
          }`}>{pipelineOverallStatus}</p>
          <p className="text-xs text-white/30 mt-1">
            {pipelineStatus?.currentLayer !== undefined
              ? `Layer ${pipelineStatus.currentLayer} of ${pipelineStatus.totalLayers ?? PIPELINE_LAYERS.length}`
              : "Idle"}
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Completed</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{completedCount}/{totalAgents}</p>
          <p className="text-xs text-white/30 mt-1">Agents finished</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Running</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{runningCount}</p>
          <p className="text-xs text-white/30 mt-1">Currently executing</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Failed</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{failedCount}</p>
          <p className="text-xs text-white/30 mt-1">{failedCount === 0 ? "No failures" : "Requires attention"}</p>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Pipeline DAG Visualization */}
      <GlassCard title="Execution Pipeline">
        <div className="space-y-6">
          {PIPELINE_LAYERS.map((layer, layerIdx) => (
            <div key={layer.label}>
              {/* Layer label */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  pipelineStatus?.currentLayer !== undefined && layerIdx < (pipelineStatus.currentLayer ?? 0)
                    ? "bg-green-500/30 text-green-400"
                    : pipelineStatus?.currentLayer !== undefined && layerIdx === (pipelineStatus.currentLayer ?? 0) && pipelineOverallStatus === "RUNNING"
                    ? "bg-amber-500/30 text-amber-400"
                    : "bg-white/10 text-white/40"
                }`}>
                  {layerIdx + 1}
                </div>
                <span className="text-sm font-medium text-white/70">{layer.label}</span>
                {layer.agents.length > 1 && (
                  <GlassBadge variant="info">Parallel</GlassBadge>
                )}
              </div>

              {/* Agent cards in this layer */}
              <div className={`grid gap-4 ml-11 ${
                layer.agents.length === 1
                  ? "grid-cols-1 max-w-md"
                  : layer.agents.length <= 3
                  ? "grid-cols-1 md:grid-cols-3"
                  : "grid-cols-1 md:grid-cols-3 lg:grid-cols-5"
              }`}>
                {layer.agents.map((agentType) => {
                  const agentStatus = getAgentStatus(agentType);
                  const config = statusConfig[agentStatus.status] ?? statusConfig.PENDING;
                  const isFailed = agentStatus.status === "FAILED";
                  return (
                    <div
                      key={agentType}
                      className={`glass-panel-sm p-4 border ${config.borderColor} ${config.bgColor} rounded-xl transition-all duration-300`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white/90">
                          {AGENT_LABELS[agentType] ?? agentType}
                        </span>
                        {agentStatus.status === "RUNNING" && (
                          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <GlassBadge variant={config.variant}>
                          {agentStatus.status}
                        </GlassBadge>
                        {agentStatus.durationMs !== undefined && (
                          <span className="text-xs text-white/30">
                            {(agentStatus.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      {agentStatus.error && (
                        <p className="text-xs text-red-400/80 mt-2 truncate" title={agentStatus.error}>
                          {agentStatus.error}
                        </p>
                      )}
                      {/* Retry/Skip buttons for failed agents */}
                      {isFailed && (
                        <div className="flex gap-2 mt-3">
                          <GlassButton
                            onClick={() => retryAgent(agentType)}
                            disabled={actionLoading}
                            className="text-xs flex-1"
                          >
                            Retry
                          </GlassButton>
                          <GlassButton
                            variant="danger"
                            onClick={() => skipAgent(agentType)}
                            disabled={actionLoading}
                            className="text-xs flex-1"
                          >
                            Skip
                          </GlassButton>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Connector arrow between layers */}
              {layerIdx < PIPELINE_LAYERS.length - 1 && (
                <div className="flex justify-center ml-11 my-2">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-4 bg-white/20" />
                    <svg className="w-4 h-4 text-white/20" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Execution Logs */}
      <GlassCard title="Execution Logs">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {agentStatuses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">No execution logs yet. Run the pipeline to see agent status changes.</p>
            </div>
          ) : (
            agentStatuses
              .filter((a) => a.status !== "PENDING")
              .sort((a, b) => {
                const aTime = a.startedAt ? new Date(a.startedAt).getTime() : a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const bTime = b.startedAt ? new Date(b.startedAt).getTime() : b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return bTime - aTime;
              })
              .map((agent) => {
                const config = statusConfig[agent.status] ?? statusConfig.PENDING;
                const timestamp = agent.completedAt || agent.startedAt;
                return (
                  <div key={agent.agentType} className="glass-panel-sm p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        agent.status === "COMPLETED" ? "bg-green-400" :
                        agent.status === "RUNNING" ? "bg-amber-400 animate-pulse" :
                        agent.status === "FAILED" ? "bg-red-400" :
                        agent.status === "SKIPPED" ? "bg-white/30" :
                        "bg-blue-400"
                      }`} />
                      <span className="text-sm text-white/80">
                        {AGENT_LABELS[agent.agentType] ?? agent.agentType}
                      </span>
                      <GlassBadge variant={config.variant}>{agent.status}</GlassBadge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      {agent.error && (
                        <span className="text-red-400/70 max-w-[200px] truncate" title={agent.error}>
                          {agent.error}
                        </span>
                      )}
                      {timestamp && (
                        <span>{new Date(timestamp).toLocaleTimeString()}</span>
                      )}
                      {agent.durationMs !== undefined && (
                        <span>{(agent.durationMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </GlassCard>
    </div>
  );
}
