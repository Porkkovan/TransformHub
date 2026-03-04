"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentResults } from "@/hooks/useAgentResults";
import { useOrganization } from "@/contexts/OrganizationContext";

interface TestCase {
  name: string;
  type: string;
  priority: string;
  expected_result: string;
}

interface ValidationResults {
  coverage_score: number;
  gaps: string[];
  risks: string[];
  recommendations: string[];
}

interface TestingValidationOutput {
  test_cases: TestCase[];
  validation_results: ValidationResults;
  report: string;
}

export default function TestingValidationPage() {
  const { currentOrg } = useOrganization();
  const { results, execution, running, runAgent } = useAgentResults("testing_validation");
  const data = results as unknown as TestingValidationOutput | null;

  const handleRun = () => runAgent(currentOrg?.id);

  const testCases = data?.test_cases ?? [];
  const validation = data?.validation_results;
  const criticalCount = testCases.filter((t) => t.priority?.toLowerCase() === "critical").length;

  const priorityVariant = (p: string) => {
    switch (p?.toLowerCase()) {
      case "critical": return "danger" as const;
      case "high": return "warning" as const;
      case "medium": return "info" as const;
      default: return "default" as const;
    }
  };

  const typeVariant = (t: string) => {
    switch (t?.toLowerCase()) {
      case "unit": return "info" as const;
      case "integration": return "warning" as const;
      case "e2e": return "success" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Testing & Validation</h1>
          <p className="text-white/50 mt-1">
            Test case generation and transformation coverage validation
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRun} disabled={running}>
          {running ? "Analyzing..." : "Run Testing Agent"}
        </GlassButton>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Test Cases</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{testCases.length}</p>
          <p className="text-xs text-white/30 mt-1">Generated tests</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Coverage Score</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {validation?.coverage_score != null ? `${validation.coverage_score}%` : "N/A"}
          </p>
          <p className="text-xs text-white/30 mt-1">Transformation coverage</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Critical Priority</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{criticalCount}</p>
          <p className="text-xs text-white/30 mt-1">Critical test cases</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Validation Status</p>
          <p className="text-xl font-bold text-amber-400 mt-1">
            {validation ? (validation.coverage_score >= 80 ? "PASS" : "REVIEW") : "N/A"}
          </p>
          <p className="text-xs text-white/30 mt-1">Overall assessment</p>
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

      {/* Test Cases Table */}
      <GlassCard title="Test Cases">
        {testCases.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 px-3 py-2 text-xs text-white/40 uppercase border-b border-white/10">
              <span>Name</span>
              <span>Type</span>
              <span>Priority</span>
              <span>Expected Result</span>
            </div>
            {testCases.map((tc, i) => (
              <div key={i} className="glass-panel-sm p-3 grid grid-cols-4 gap-4 items-center">
                <span className="text-sm text-white/80">{tc.name}</span>
                <GlassBadge variant={typeVariant(tc.type)}>{tc.type}</GlassBadge>
                <GlassBadge variant={priorityVariant(tc.priority)}>{tc.priority}</GlassBadge>
                <span className="text-xs text-white/60 truncate">{tc.expected_result}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No test cases yet. Run the agent to generate test cases.</p>
        )}
      </GlassCard>

      {/* Validation Results */}
      {validation && (
        <GlassCard title="Validation Results">
          <div className="space-y-4">
            {validation.gaps?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white/70 mb-2">Gaps</h4>
                <ul className="space-y-1">
                  {validation.gaps.map((g, i) => (
                    <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">&#x2022;</span>{g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation.risks?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white/70 mb-2">Risks</h4>
                <ul className="space-y-1">
                  {validation.risks.map((r, i) => (
                    <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">&#x2022;</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation.recommendations?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white/70 mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {validation.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">&#x2022;</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
