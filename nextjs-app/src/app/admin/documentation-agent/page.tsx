"use client";

import { useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import { useAgentResults } from "@/hooks/useAgentResults";
import { useOrganization } from "@/contexts/OrganizationContext";

interface DocContext {
  gaps: string[];
}

interface DocumentationOutput {
  doc_context: DocContext;
  api_docs: string;
  runbooks: string;
  adrs: string;
  onboarding_guide: string;
}

const DOC_TABS = [
  { id: "api_docs", label: "API Docs" },
  { id: "runbooks", label: "Runbooks" },
  { id: "adrs", label: "ADRs" },
  { id: "onboarding_guide", label: "Onboarding" },
] as const;

type DocTab = (typeof DOC_TABS)[number]["id"];

export default function DocumentationAgentPage() {
  const { currentOrg } = useOrganization();
  const { results, execution, running, runAgent } = useAgentResults("documentation");
  const data = results as unknown as DocumentationOutput | null;
  const [activeTab, setActiveTab] = useState<DocTab>("api_docs");

  const handleRun = () => runAgent(currentOrg?.id);

  const gaps = data?.doc_context?.gaps ?? [];
  const docTypesGenerated = DOC_TABS.filter((t) => data?.[t.id]).length;
  const priorityItems = gaps.length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documentation Agent</h1>
          <p className="text-white/50 mt-1">
            API docs, runbooks, ADRs, and onboarding guides
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRun} disabled={running}>
          {running ? "Generating..." : "Run Documentation Agent"}
        </GlassButton>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Doc Types Generated</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{docTypesGenerated}</p>
          <p className="text-xs text-white/30 mt-1">Of 4 types</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Gaps Found</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{gaps.length}</p>
          <p className="text-xs text-white/30 mt-1">Documentation gaps</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Priority Items</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{priorityItems}</p>
          <p className="text-xs text-white/30 mt-1">Needing attention</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Status</p>
          <p className="text-xl font-bold text-green-400 mt-1">
            {data ? "Generated" : "Pending"}
          </p>
          <p className="text-xs text-white/30 mt-1">Documentation status</p>
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

      {/* Tab Switcher */}
      {data && (
        <div>
          <div className="flex gap-1 p-1 glass-panel-sm w-fit mb-4">
            {DOC_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <GlassCard title={DOC_TABS.find((t) => t.id === activeTab)?.label}>
            <div className="whitespace-pre-wrap text-sm text-white/70">
              {data[activeTab] || "No content generated for this section."}
            </div>
          </GlassCard>
        </div>
      )}

      {!data && !running && (
        <GlassCard>
          <p className="text-white/40 text-sm">No documentation generated yet. Run the agent to generate documentation.</p>
        </GlassCard>
      )}
    </div>
  );
}
