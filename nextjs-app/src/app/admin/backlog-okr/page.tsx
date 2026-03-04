"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";

interface KeyResult {
  description: string;
  target: string;
  current: string;
  progress: number;
}

interface OKR {
  objective: string;
  owner: string;
  timeframe: string;
  status: string;
  keyResults: KeyResult[];
}

interface BacklogItem {
  title: string;
  description: string;
  priority: string;
  effort: string;
  businessValue: string;
  sprintReady: boolean;
  labels: string[];
}

interface BacklogOKRResults {
  okrs: OKR[];
  backlogItems: BacklogItem[];
  summary: string;
}

export default function BacklogOKRPage() {
  const { currentOrg } = useOrganization();
  const { execute, execution, loading: agentLoading } = useAgentExecution();
  const [results, setResults] = useState<BacklogOKRResults | null>(null);

  useEffect(() => {
    if (execution?.status === "COMPLETED" && execution.output) {
      setResults(execution.output as unknown as BacklogOKRResults);
    }
  }, [execution]);

  const handleRunAgent = () =>
    execute("backlog_okr", {}, undefined, currentOrg?.id);

  const priorityVariant = (priority: string) => {
    switch (priority.toUpperCase()) {
      case "CRITICAL":
        return "danger" as const;
      case "HIGH":
        return "warning" as const;
      case "MEDIUM":
        return "info" as const;
      case "LOW":
        return "success" as const;
      default:
        return "default" as const;
    }
  };

  const priorityBorderColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case "CRITICAL":
        return "border-l-red-500";
      case "HIGH":
        return "border-l-orange-500";
      case "MEDIUM":
        return "border-l-amber-500";
      case "LOW":
        return "border-l-green-500";
      default:
        return "border-l-blue-500";
    }
  };

  const okrStatusVariant = (status: string) => {
    switch (status.toUpperCase()) {
      case "ON_TRACK":
      case "COMPLETED":
        return "success" as const;
      case "AT_RISK":
        return "warning" as const;
      case "OFF_TRACK":
        return "danger" as const;
      default:
        return "default" as const;
    }
  };

  const okrsDefined = results?.okrs?.length ?? 0;
  const backlogItems = results?.backlogItems?.length ?? 0;
  const highPriority =
    results?.backlogItems?.filter(
      (b) =>
        b.priority.toUpperCase() === "HIGH" ||
        b.priority.toUpperCase() === "CRITICAL"
    ).length ?? 0;
  const sprintReady =
    results?.backlogItems?.filter((b) => b.sprintReady).length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Backlog & OKR</h1>
          <p className="text-white/50 mt-1">
            Objectives, key results, and prioritized backlog management
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRunAgent} disabled={agentLoading}>
          {agentLoading ? "Analyzing..." : "Run Backlog & OKR Agent"}
        </GlassButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
          <p className="text-xs text-white/40 uppercase">OKRs Defined</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">{okrsDefined}</p>
          <p className="text-xs text-white/30 mt-1">
            Strategic objectives set
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <p className="text-xs text-white/40 uppercase">Backlog Items</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">
            {backlogItems}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Total prioritized items
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">High Priority</p>
          <p className="text-3xl font-bold text-red-400 mt-1">
            {highPriority}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Urgent items requiring attention
          </p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Sprint Ready</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {sprintReady}
          </p>
          <p className="text-xs text-white/30 mt-1">
            Items ready for execution
          </p>
        </div>
      </div>

      {/* Agent Status */}
      {execution && execution.status !== "COMPLETED" && (
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-white/80 text-sm">
              Agent is {execution.status.toLowerCase()}...
            </p>
          </div>
        </GlassCard>
      )}

      {/* OKRs */}
      <GlassCard title="Objectives & Key Results">
        <div className="space-y-4">
          {results?.okrs && results.okrs.length > 0 ? (
            results.okrs.map((okr, i) => (
              <div key={i} className="glass-panel-sm p-4 border-l-4 border-l-cyan-500">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white/80">
                      {okr.objective}
                    </h4>
                    <p className="text-xs text-white/40">
                      Owner: {okr.owner} &middot; {okr.timeframe}
                    </p>
                  </div>
                  <GlassBadge variant={okrStatusVariant(okr.status)}>
                    {okr.status.replace("_", " ")}
                  </GlassBadge>
                </div>
                <div className="space-y-2">
                  {okr.keyResults.map((kr, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 px-3 py-2 rounded bg-white/5"
                    >
                      <div className="flex-1">
                        <p className="text-xs text-white/70">
                          {kr.description}
                        </p>
                        <p className="text-xs text-white/30">
                          Target: {kr.target} &middot; Current: {kr.current}
                        </p>
                      </div>
                      <div className="w-24">
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              kr.progress >= 80
                                ? "bg-green-500"
                                : kr.progress >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(kr.progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/40 text-right mt-1">
                          {kr.progress}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm">
              No OKRs defined yet. Run the Backlog & OKR agent to generate
              objectives and key results.
            </p>
          )}
        </div>
      </GlassCard>

      {/* Prioritized Backlog */}
      <GlassCard title="Prioritized Backlog">
        <div className="space-y-3">
          {results?.backlogItems && results.backlogItems.length > 0 ? (
            results.backlogItems.map((item, i) => (
              <div
                key={i}
                className={`glass-panel-sm p-4 flex items-center justify-between border-l-4 ${priorityBorderColor(item.priority)}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-white/80">{item.title}</p>
                    {item.sprintReady && (
                      <GlassBadge variant="success">Sprint Ready</GlassBadge>
                    )}
                  </div>
                  <p className="text-xs text-white/40">{item.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-white/30">
                      Effort: {item.effort}
                    </span>
                    <span className="text-xs text-white/30">
                      Value: {item.businessValue}
                    </span>
                    {item.labels.map((label, j) => (
                      <span
                        key={j}
                        className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/40"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <GlassBadge variant={priorityVariant(item.priority)}>
                  {item.priority}
                </GlassBadge>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm">
              No backlog items yet. Run the agent to generate a prioritized
              backlog.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
