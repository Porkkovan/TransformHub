"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import MermaidRenderer from "@/components/vsm/MermaidRenderer";
import { useArchitectureResults } from "@/hooks/useArchitectureResults";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function ArchitecturePage() {
  const { architecture, loading, refetch } = useArchitectureResults();
  const { execute, loading: agentLoading } = useAgentExecution();
  const { currentOrg } = useOrganization();

  const handleRunAgent = async () => {
    await execute("architecture", {}, undefined, currentOrg?.id);
    refetch();
  };

  const diagrams = architecture?.architecture_diagrams || {};
  const diagramEntries = Object.entries(diagrams).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Architecture</h1>
          <p className="text-white/50 mt-1">System architecture analysis and migration planning</p>
        </div>
        <GlassButton onClick={handleRunAgent} disabled={agentLoading}>
          {agentLoading ? "Analyzing..." : "Run Architecture Agent"}
        </GlassButton>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-white/30">Loading...</div>
      ) : !architecture ? (
        <div className="flex items-center justify-center h-64 text-white/30">
          <p>No architecture analysis available. Run the Architecture Agent to begin.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {architecture.current_architecture && (
              <GlassCard title="Current Architecture">
                <div className="glass-panel-sm p-4 border-l-4 border-l-amber-500 rounded-xl">
                  <GlassBadge variant="warning">CURRENT</GlassBadge>
                  <p className="text-sm text-white/70 mt-2 whitespace-pre-wrap">{typeof architecture.current_architecture === "string" ? architecture.current_architecture : JSON.stringify(architecture.current_architecture, null, 2)}</p>
                </div>
              </GlassCard>
            )}
            {architecture.target_architecture && (
              <GlassCard title="Target Architecture">
                <div className="glass-panel-sm p-4 border-l-4 border-l-green-500 rounded-xl">
                  <GlassBadge variant="success">TARGET</GlassBadge>
                  <p className="text-sm text-white/70 mt-2 whitespace-pre-wrap">{typeof architecture.target_architecture === "string" ? architecture.target_architecture : JSON.stringify(architecture.target_architecture, null, 2)}</p>
                </div>
              </GlassCard>
            )}
          </div>

          {architecture.migration_plan && (
            <GlassCard title="Migration Plan">
              <p className="text-sm text-white/70 whitespace-pre-wrap">{typeof architecture.migration_plan === "string" ? architecture.migration_plan : JSON.stringify(architecture.migration_plan, null, 2)}</p>
            </GlassCard>
          )}

          {diagramEntries.length > 0 && (
            <GlassCard title="Architecture Diagrams">
              <div className="space-y-6">
                {diagramEntries.map(([name, source]) => (
                  <div key={name} className="glass-panel-sm p-4">
                    <p className="text-xs text-white/40 mb-3 uppercase">{name.replace(/_/g, " ")}</p>
                    <MermaidRenderer source={source} id={`arch-${name}`} />
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
