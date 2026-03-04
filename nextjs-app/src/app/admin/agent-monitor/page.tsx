"use client";

import { useEffect, useState, useCallback } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";

interface AgentExecutionRecord {
  id: string;
  agentType: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

const AGENT_CONFIGS = [
  { type: "discovery", name: "Discovery Agent", description: "Analyzes repositories and discovers business functionalities", nodes: 6 },
  { type: "lean_vsm", name: "Lean VSM Agent", description: "Maps value streams and calculates flow efficiency metrics", nodes: 5 },
  { type: "risk_compliance", name: "Risk & Compliance Agent", description: "Assesses risks and maps regulatory compliance for configured frameworks", nodes: 6 },
  { type: "fiduciary", name: "Regulatory Deep-Dive Agent", description: "Deep-dive analysis of regulatory obligations and compliance gaps", nodes: 5 },
  { type: "market_intelligence", name: "Market Intelligence Agent", description: "Analyzes market trends and competitive landscape", nodes: 5 },
  { type: "architecture", name: "Architecture Agent", description: "Designs target architecture and migration paths", nodes: 6 },
  { type: "data_governance", name: "Data Governance Agent", description: "Manages data quality, lineage, and governance policies", nodes: 5 },
  { type: "product_transformation", name: "Product Transformation Agent", description: "Plans product transformation roadmaps", nodes: 7 },
  { type: "backlog_okr", name: "Backlog & OKR Agent", description: "Generates backlogs and OKRs from transformation plans", nodes: 5 },
  { type: "future_state_vision", name: "Future State Vision Agent", description: "Envisions RPA, AI/ML, and agent-based future capabilities", nodes: 5 },
  { type: "testing_validation", name: "Testing & Validation Agent", description: "Generates test cases and validates transformation coverage", nodes: 5 },
  { type: "documentation", name: "Documentation Agent", description: "Generates API docs, runbooks, ADRs, and onboarding guides", nodes: 5 },
  { type: "monitoring", name: "Monitoring Agent", description: "Defines KPIs, detects drift, and analyzes trends", nodes: 6 },
  { type: "security", name: "Security Agent", description: "Scans dependencies, analyzes code security, and plans remediation", nodes: 6 },
  { type: "skill_gap", name: "Skill Gap Agent", description: "Assesses team skills, identifies gaps, and recommends training", nodes: 5 },
  { type: "change_impact", name: "Change Impact Agent", description: "Analyzes change ripple effects and risk across the hierarchy", nodes: 5 },
  { type: "data_governance_deep", name: "Data Governance Deep Agent", description: "Classifies data, assesses privacy, and generates governance policies", nodes: 5 },
];

const DEMO_AGENT_STATUSES: Record<string, string> = {
  discovery: "COMPLETED",
  lean_vsm: "COMPLETED",
  risk_compliance: "RUNNING",
  fiduciary: "COMPLETED",
  market_intelligence: "FAILED",
  architecture: "RUNNING",
  data_governance: "COMPLETED",
  product_transformation: "IDLE",
  backlog_okr: "COMPLETED",
  future_state_vision: "IDLE",
  testing_validation: "COMPLETED",
  documentation: "RUNNING",
  monitoring: "COMPLETED",
  security: "FAILED",
  skill_gap: "IDLE",
  change_impact: "COMPLETED",
  data_governance_deep: "IDLE",
};

const DEMO_EXECUTIONS: AgentExecutionRecord[] = [
  { id: "demo-001", agentType: "discovery", status: "COMPLETED", startedAt: "2026-02-26T09:00:00Z", completedAt: "2026-02-26T09:02:34Z", createdAt: "2026-02-26T09:00:00Z" },
  { id: "demo-002", agentType: "risk_compliance", status: "RUNNING", startedAt: "2026-02-26T09:05:00Z", createdAt: "2026-02-26T09:05:00Z" },
  { id: "demo-003", agentType: "lean_vsm", status: "COMPLETED", startedAt: "2026-02-26T08:50:00Z", completedAt: "2026-02-26T08:53:12Z", createdAt: "2026-02-26T08:50:00Z" },
  { id: "demo-004", agentType: "market_intelligence", status: "FAILED", startedAt: "2026-02-26T08:45:00Z", completedAt: "2026-02-26T08:45:47Z", errorMessage: "Upstream market data API returned 503 — retry limit exceeded", createdAt: "2026-02-26T08:45:00Z" },
  { id: "demo-005", agentType: "architecture", status: "RUNNING", startedAt: "2026-02-26T09:03:00Z", createdAt: "2026-02-26T09:03:00Z" },
  { id: "demo-006", agentType: "fiduciary", status: "COMPLETED", startedAt: "2026-02-26T08:40:00Z", completedAt: "2026-02-26T08:43:21Z", createdAt: "2026-02-26T08:40:00Z" },
  { id: "demo-007", agentType: "data_governance", status: "COMPLETED", startedAt: "2026-02-26T08:30:00Z", completedAt: "2026-02-26T08:34:05Z", createdAt: "2026-02-26T08:30:00Z" },
  { id: "demo-008", agentType: "security", status: "FAILED", startedAt: "2026-02-26T08:25:00Z", completedAt: "2026-02-26T08:25:58Z", errorMessage: "SAST scan timed out after 60s — container memory limit reached", createdAt: "2026-02-26T08:25:00Z" },
  { id: "demo-009", agentType: "backlog_okr", status: "COMPLETED", startedAt: "2026-02-26T08:20:00Z", completedAt: "2026-02-26T08:22:45Z", createdAt: "2026-02-26T08:20:00Z" },
  { id: "demo-010", agentType: "documentation", status: "RUNNING", startedAt: "2026-02-26T09:04:00Z", createdAt: "2026-02-26T09:04:00Z" },
  { id: "demo-011", agentType: "monitoring", status: "COMPLETED", startedAt: "2026-02-26T08:10:00Z", completedAt: "2026-02-26T08:14:30Z", createdAt: "2026-02-26T08:10:00Z" },
  { id: "demo-012", agentType: "change_impact", status: "COMPLETED", startedAt: "2026-02-26T08:00:00Z", completedAt: "2026-02-26T08:03:55Z", createdAt: "2026-02-26T08:00:00Z" },
];

export default function AgentMonitorPage() {
  const [executions, setExecutions] = useState<AgentExecutionRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const { execute, loading } = useAgentExecution();
  const { currentOrg } = useOrganization();

  const [isDemoMode, setIsDemoMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("agentMonitor:demoMode") === "true";
    }
    return false;
  });
  const [demoRunning, setDemoRunning] = useState<Set<string>>(new Set());
  const [demoExecHistory, setDemoExecHistory] = useState<AgentExecutionRecord[]>(DEMO_EXECUTIONS);

  const fetchExecutions = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/agents/executions?limit=50");
      if (!res.ok) {
        throw new Error(`Failed to fetch executions: ${res.status}`);
      }
      const data = await res.json();
      setExecutions(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load execution history");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Persist demo mode to localStorage
  useEffect(() => {
    localStorage.setItem("agentMonitor:demoMode", String(isDemoMode));
  }, [isDemoMode]);

  // Only fetch live data when not in demo mode
  useEffect(() => {
    if (!isDemoMode) {
      fetchExecutions();
    }
  }, [isDemoMode, fetchExecutions]);

  // Reset demo history when entering demo mode
  useEffect(() => {
    if (isDemoMode) {
      setDemoExecHistory(DEMO_EXECUTIONS);
      setDemoRunning(new Set());
    }
  }, [isDemoMode]);

  const handleTrigger = async (agentType: string) => {
    if (isDemoMode) {
      setDemoRunning((prev) => new Set(prev).add(agentType));
      const delay = 2000 + Math.random() * 1000;
      setTimeout(() => {
        setDemoRunning((prev) => {
          const next = new Set(prev);
          next.delete(agentType);
          return next;
        });
        const newRecord: AgentExecutionRecord = {
          id: crypto.randomUUID(),
          agentType,
          status: "COMPLETED",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        setDemoExecHistory((prev) => [newRecord, ...prev]);
      }, delay);
      return;
    }
    await execute(agentType, {}, undefined, currentOrg?.id);
    setTimeout(fetchExecutions, 1000);
  };

  const getStatusForAgent = (type: string) => {
    if (isDemoMode) {
      if (demoRunning.has(type)) return "RUNNING";
      return DEMO_AGENT_STATUSES[type] || "IDLE";
    }
    const exec = executions.find((e) => e.agentType === type);
    return exec?.status || "IDLE";
  };

  const displayedExecutions = isDemoMode ? demoExecHistory : executions;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Monitor</h1>
          <p className="text-white/50 mt-1">Monitor and trigger agent executions</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isDemoMode ? "text-amber-300" : "text-white/40"}`}>Demo</span>
            <button
              onClick={() => setIsDemoMode((prev) => !prev)}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{
                backgroundColor: isDemoMode ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)",
                border: `1px solid ${isDemoMode ? "rgba(245,158,11,0.5)" : "rgba(34,197,94,0.5)"}`,
              }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ left: isDemoMode ? "2px" : "calc(100% - 22px)" }}
              />
            </button>
            <span className={`text-sm font-medium ${!isDemoMode ? "text-green-300" : "text-white/40"}`}>Live</span>
          </div>
          {isDemoMode && <GlassBadge variant="warning">Sample Data</GlassBadge>}
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AGENT_CONFIGS.map((agent) => {
          const agentStatus = getStatusForAgent(agent.type);
          return (
            <GlassCard key={agent.type}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white/90">{agent.name}</h3>
                  <p className="text-xs text-white/40 mt-1">{agent.description}</p>
                </div>
                <StatusIndicator
                  status={
                    agentStatus === "RUNNING" ? "running" :
                    agentStatus === "COMPLETED" ? "completed" :
                    agentStatus === "FAILED" ? "failed" : "online"
                  }
                  label={agentStatus === "IDLE" ? "Ready" : agentStatus}
                />
              </div>

              <div className="flex items-center gap-2 mb-4">
                <GlassBadge variant="info">{agent.nodes} nodes</GlassBadge>
                <GlassBadge variant={agentStatus === "FAILED" ? "danger" : "success"}>
                  {agentStatus === "IDLE" ? "Active" : agentStatus}
                </GlassBadge>
              </div>

              <GlassButton
                onClick={() => handleTrigger(agent.type)}
                disabled={isDemoMode ? demoRunning.has(agent.type) : loading}
                className="w-full text-sm"
              >
                {(isDemoMode ? demoRunning.has(agent.type) : loading) ? "Executing..." : "Trigger Execution"}
              </GlassButton>
            </GlassCard>
          );
        })}
      </div>

      {/* Execution History */}
      <GlassCard title="Execution History">
        <div className="space-y-2">
          {!isDemoMode && loadingHistory ? (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">Loading execution history...</p>
            </div>
          ) : !isDemoMode && loadError ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">Error: {loadError}</p>
              <button
                onClick={fetchExecutions}
                className="text-white/50 text-xs mt-2 underline hover:text-white/70"
              >
                Retry
              </button>
            </div>
          ) : displayedExecutions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">No executions recorded yet.</p>
              <p className="text-white/30 text-xs mt-1">Trigger an agent above to see execution history.</p>
            </div>
          ) : (
            displayedExecutions.map((exec) => (
              <div key={exec.id} className="glass-panel-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusIndicator
                    status={
                      exec.status === "COMPLETED" ? "completed" :
                      exec.status === "FAILED" ? "failed" :
                      exec.status === "RUNNING" ? "running" : "pending"
                    }
                  />
                  <div>
                    <p className="text-sm text-white/80">{exec.agentType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                    <p className="text-xs text-white/40 font-mono">{exec.id.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="text-right">
                  <GlassBadge variant={
                    exec.status === "COMPLETED" ? "success" :
                    exec.status === "FAILED" ? "danger" :
                    exec.status === "RUNNING" ? "info" : "default"
                  }>
                    {exec.status}
                  </GlassBadge>
                  {exec.completedAt && (
                    <p className="text-xs text-white/30 mt-1">
                      {new Date(exec.completedAt).toLocaleTimeString()}
                    </p>
                  )}
                  {exec.errorMessage && (
                    <p className="text-xs text-red-400/70 mt-1 max-w-[200px] truncate" title={exec.errorMessage}>
                      {exec.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
