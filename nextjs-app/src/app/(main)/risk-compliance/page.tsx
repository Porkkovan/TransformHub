"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import RiskCategoryBreakdown from "@/components/risk/RiskCategoryBreakdown";
import ComplianceFrameworkTabs from "@/components/risk/ComplianceFrameworkTabs";
import { useRiskScores } from "@/hooks/useRiskScores";
import { useComplianceMappings } from "@/hooks/useComplianceMappings";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useOrganization } from "@/contexts/OrganizationContext";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  payloadHash: string;
  previousHash?: string;
  createdAt: string;
}

export default function RiskCompliancePage() {
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const { risks, loading, maxScore, avgScore, criticalCount, blockedCount, refetch } = useRiskScores(undefined, undefined, currentOrg?.id);
  const { mappings, loading: complianceLoading } = useComplianceMappings(currentOrg?.id);
  const { execute, execution, loading: agentLoading } = useAgentExecution();
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetch("/api/audit-log")
      .then((r) => r.json())
      .then((json) => setAuditLog(Array.isArray(json) ? json : (json.data ?? [])))
      .catch(() => {});
  }, []);

  const handleRunAgent = () => execute("risk_compliance", {}, undefined, currentOrg?.id);

  const severityVariant = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "danger" as const;
      case "HIGH": return "warning" as const;
      case "MEDIUM": return "warning" as const;
      case "LOW": return "success" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk & Compliance</h1>
          <p className="text-white/50 mt-1">Regulatory guardrails and risk assessment{currentOrg?.regulatoryFrameworks?.length ? ` (${currentOrg.regulatoryFrameworks.join(", ")})` : ""}</p>
        </div>
        <GlassButton onClick={handleRunAgent} disabled={agentLoading}>
          {agentLoading ? "Analyzing..." : "Run Risk Agent"}
        </GlassButton>
      </div>

      {/* Risk Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Max Risk Score</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{maxScore.toFixed(1)}</p>
          <p className="text-xs text-white/30 mt-1">{maxScore >= 8 ? "CRITICAL - Transition blocked" : "Below threshold"}</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Avg Risk Score</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{avgScore.toFixed(1)}</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <p className="text-xs text-white/40 uppercase">Critical Risks</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{criticalCount}</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Blocked Transitions</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{blockedCount}</p>
        </div>
      </div>

      {/* Risk Category Breakdown */}
      {risks.length > 0 && (
        <GlassCard title="Risk Category Breakdown">
          <RiskCategoryBreakdown risks={risks} />
        </GlassCard>
      )}

      {/* Compliance Framework Tabs */}
      {mappings.length > 0 && (
        <GlassCard title="Compliance Frameworks">
          <ComplianceFrameworkTabs mappings={mappings} />
        </GlassCard>
      )}

      {/* Risk Score Board */}
      <GlassCard title="Risk Assessments">
        <div className="space-y-3">
          {risks.map((risk) => (
            <div
              key={risk.id}
              className={`glass-panel-sm p-4 flex items-center justify-between border-l-4 ${
                risk.severity === "CRITICAL" ? "border-l-red-500" : risk.severity === "HIGH" ? "border-l-orange-500" : risk.severity === "MEDIUM" ? "border-l-amber-500" : "border-l-green-500"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{risk.riskScore.toFixed(1)}</span>
                  <div>
                    <p className="text-sm text-white/80">{risk.riskCategory.replace("_", " ")}</p>
                    <p className="text-xs text-white/40">{risk.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <GlassBadge variant={severityVariant(risk.severity)}>{risk.severity}</GlassBadge>
                {risk.transitionBlocked && (
                  <GlassBadge variant="danger">BLOCKED</GlassBadge>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transition Approval Panel */}
        <GlassCard title="Transition Approval">
          <div className="space-y-4">
            <div className={`glass-panel-sm p-6 text-center ${maxScore >= 8 ? "border border-red-500/30" : "border border-green-500/30"}`}>
              {maxScore >= 8 ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-red-400">Transition Blocked</h3>
                  <p className="text-sm text-white/50 mt-2">CRITICAL risk score ({maxScore.toFixed(1)}) exceeds threshold of 8.0. Resolve critical risks before proceeding.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-green-400">Transition Approved</h3>
                  <p className="text-sm text-white/50 mt-2">All risk scores below critical threshold. Safe to proceed with transformation.</p>
                </>
              )}
            </div>
            {risks.filter((r) => r.mitigationPlan).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white/70">Mitigation Plans</h4>
                {risks.filter((r) => r.mitigationPlan).map((r) => (
                  <div key={r.id} className="glass-panel-sm p-3 text-xs text-white/50">
                    <span className="text-white/70 font-medium">{r.riskCategory}: </span>
                    {r.mitigationPlan}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Audit Trail Table */}
        <GlassCard title="Audit Trail (SHA-256 Chained)">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLog.length === 0 ? (
              <p className="text-white/40 text-sm">No audit entries yet.</p>
            ) : (
              auditLog.map((entry, i) => (
                <div key={entry.id} className="glass-panel-sm p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-400">#{i + 1}</span>
                      <span className="text-sm text-white/80">{entry.action}</span>
                    </div>
                    <span className="text-xs text-white/30">{entry.actor}</span>
                  </div>
                  <div className="mt-2 text-xs font-mono space-y-1">
                    <div className="flex gap-2">
                      <span className="text-white/30">Hash:</span>
                      <span className="text-green-400/70 truncate">{entry.payloadHash}</span>
                    </div>
                    {entry.previousHash && (
                      <div className="flex gap-2">
                        <span className="text-white/30">Prev:</span>
                        <span className="text-amber-400/70 truncate">{entry.previousHash}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Proceed to Product Workbench */}
      {maxScore < 8 && risks.length > 0 && (
        <div className="flex justify-end">
          <GlassButton variant="success" onClick={() => router.push("/product-workbench")}>
            Proceed to Product Workbench
          </GlassButton>
        </div>
      )}
    </div>
  );
}
