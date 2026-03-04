"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import { useAgentResults } from "@/hooks/useAgentResults";
import { useOrganization } from "@/contexts/OrganizationContext";

interface DataGovernanceOutput {
  data_classifications_count: number;
  privacy_assessments_count: number;
  governance_policies_generated: number;
  summary?: string;
}

export default function DataGovernancePage() {
  const { currentOrg } = useOrganization();
  const { results, execution, running, runAgent } = useAgentResults("data_governance");
  const data = results as unknown as DataGovernanceOutput | null;

  const handleRun = () => runAgent(currentOrg?.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Governance</h1>
          <p className="text-white/50 mt-1">
            Data classification, privacy assessment, and governance policies
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRun} disabled={running}>
          {running ? "Analyzing..." : "Run Data Governance Agent"}
        </GlassButton>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Data Classifications</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">
            {data?.data_classifications_count ?? 0}
          </p>
          <p className="text-xs text-white/30 mt-1">Classified datasets</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Privacy Assessments</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">
            {data?.privacy_assessments_count ?? 0}
          </p>
          <p className="text-xs text-white/30 mt-1">Completed assessments</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Policies Generated</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {data?.governance_policies_generated ?? 0}
          </p>
          <p className="text-xs text-white/30 mt-1">Governance policies</p>
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

      {data?.summary && (
        <GlassCard title="Summary">
          <div className="whitespace-pre-wrap text-sm text-white/70">{data.summary}</div>
        </GlassCard>
      )}

      {!data && !running && (
        <GlassCard>
          <p className="text-white/40 text-sm">
            No data governance results yet. Run the agent to classify data, assess privacy, and generate governance policies.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
