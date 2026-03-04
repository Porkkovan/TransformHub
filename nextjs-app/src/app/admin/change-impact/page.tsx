"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentResults } from "@/hooks/useAgentResults";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Change {
  description: string;
  type: string;
  affected_entities: string[];
  impact_level: string;
}

interface RippleEffect {
  source: string;
  downstream_impacts: string[];
  depth: number;
}

interface ChangeImpactOutput {
  changes: Change[];
  ripple_effects: RippleEffect[];
  risk_assessment: { overall_risk_score: number };
  report: string;
}

export default function ChangeImpactPage() {
  const { currentOrg } = useOrganization();
  const { results, execution, running, runAgent } = useAgentResults("change_impact");
  const data = results as unknown as ChangeImpactOutput | null;

  const handleRun = () => runAgent(currentOrg?.id);

  const changes = data?.changes ?? [];
  const rippleEffects = data?.ripple_effects ?? [];
  const riskScore = data?.risk_assessment?.overall_risk_score;
  const totalAffected = changes.reduce((sum, c) => sum + (c.affected_entities?.length ?? 0), 0);
  const maxDepth = rippleEffects.length > 0 ? Math.max(...rippleEffects.map((r) => r.depth ?? 0)) : 0;

  const impactVariant = (v: string) => {
    switch (v?.toLowerCase()) {
      case "critical": return "danger" as const;
      case "high": return "danger" as const;
      case "medium": return "warning" as const;
      case "low": return "info" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Change Impact Analysis</h1>
          <p className="text-white/50 mt-1">
            Change ripple effects and risk assessment
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRun} disabled={running}>
          {running ? "Analyzing..." : "Run Change Impact Agent"}
        </GlassButton>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Changes Identified</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{changes.length}</p>
          <p className="text-xs text-white/30 mt-1">Detected changes</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Entities Affected</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{totalAffected}</p>
          <p className="text-xs text-white/30 mt-1">Downstream entities</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Risk Score</p>
          <p className={`text-3xl font-bold mt-1 ${
            riskScore != null && riskScore <= 30 ? "text-green-400" :
            riskScore != null && riskScore <= 60 ? "text-amber-400" :
            riskScore != null ? "text-red-400" : "text-white/40"
          }`}>{riskScore != null ? `${riskScore}/100` : "N/A"}</p>
          <p className="text-xs text-white/30 mt-1">Overall risk</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <p className="text-xs text-white/40 uppercase">Max Ripple Depth</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{maxDepth}</p>
          <p className="text-xs text-white/30 mt-1">Propagation levels</p>
        </div>
      </div>

      {execution && execution.status !== "COMPLETED" && execution.status !== "FAILED" && (
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-white/80 text-sm">Agent is {execution.status.toLowerCase()}...</p>
          </div>
        </GlassCard>
      )}

      {/* Changes Table */}
      <GlassCard title="Changes">
        {changes.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 px-3 py-2 text-xs text-white/40 uppercase border-b border-white/10">
              <span>Description</span>
              <span>Type</span>
              <span className="text-right">Affected Entities</span>
              <span>Impact Level</span>
            </div>
            {changes.map((c, i) => (
              <div key={i} className="glass-panel-sm p-3 grid grid-cols-4 gap-4 items-center">
                <span className="text-sm text-white/80">{c.description}</span>
                <GlassBadge variant="info">{c.type}</GlassBadge>
                <span className="text-sm text-white/60 text-right">{c.affected_entities?.length ?? 0}</span>
                <GlassBadge variant={impactVariant(c.impact_level)}>{c.impact_level}</GlassBadge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No changes analyzed yet. Run the agent to identify change impacts.</p>
        )}
      </GlassCard>

      {/* Ripple Effects */}
      {rippleEffects.length > 0 && (
        <GlassCard title="Ripple Effects">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rippleEffects.map((r, i) => (
              <div key={i} className="glass-panel-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white/80">{r.source}</h4>
                  <GlassBadge variant="warning">Depth {r.depth}</GlassBadge>
                </div>
                <ul className="space-y-1">
                  {r.downstream_impacts?.map((impact, j) => (
                    <li key={j} className="text-xs text-white/60 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">&#x2192;</span>{impact}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Report */}
      {data?.report && (
        <GlassCard title="Full Report">
          <div className="whitespace-pre-wrap text-sm text-white/70">{data.report}</div>
        </GlassCard>
      )}
    </div>
  );
}
