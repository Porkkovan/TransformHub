"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/ui/GlassCard";

interface AgentVersion {
  id: string;
  agentType: string;
  version: number;
  promptHash: string;
  graphHash: string;
  isActive: boolean;
  createdAt: string;
}

export default function VersionCompare({ agentType }: { agentType: string }) {
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentType) return;
    fetch(`/api/agents/versions?agentType=${agentType}`)
      .then((r) => r.json())
      .then((json) => setVersions(Array.isArray(json) ? json : (json.data ?? [])))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [agentType]);

  if (loading) return <p className="text-white/40 text-sm">Loading versions...</p>;
  if (versions.length === 0) return <p className="text-white/40 text-sm">No versions recorded.</p>;

  return (
    <GlassCard title={`Agent Versions: ${agentType}`}>
      <div className="space-y-2">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`glass-panel-sm p-3 flex items-center justify-between ${
              v.isActive ? "border border-green-500/30" : ""
            }`}
          >
            <div>
              <span className="text-sm font-medium text-white/80">v{v.version}</span>
              {v.isActive && (
                <span className="ml-2 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                  active
                </span>
              )}
            </div>
            <div className="text-xs text-white/40 space-x-4">
              <span>Prompt: {v.promptHash}</span>
              <span>Graph: {v.graphHash}</span>
              <span>{new Date(v.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
