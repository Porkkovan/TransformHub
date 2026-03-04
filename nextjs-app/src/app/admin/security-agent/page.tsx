"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentResults } from "@/hooks/useAgentResults";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Vulnerability {
  package: string;
  version: string;
  severity: string;
  cve_id: string;
  fix_version?: string;
}

interface CodeFinding {
  severity: string;
  pattern: string;
  file: string;
  remediation: string;
}

interface SecurityOutput {
  dependency_scan: { vulnerabilities: Vulnerability[] };
  code_analysis: { findings: CodeFinding[] };
  cve_analysis: { critical_cves: number };
  security_posture: { grade: string; risk_score: number };
  remediation_plan: {
    immediate: string[];
    short_term: string[];
    long_term: string[];
  };
}

export default function SecurityAgentPage() {
  const { currentOrg } = useOrganization();
  const { results, execution, running, runAgent } = useAgentResults("security");
  const data = results as unknown as SecurityOutput | null;

  const handleRun = () => runAgent(currentOrg?.id);

  const vulns = data?.dependency_scan?.vulnerabilities ?? [];
  const findings = data?.code_analysis?.findings ?? [];
  const grade = data?.security_posture?.grade ?? "N/A";
  const riskScore = data?.security_posture?.risk_score;
  const criticalCves = data?.cve_analysis?.critical_cves ?? 0;
  const remediation = data?.remediation_plan;

  const severityVariant = (s: string) => {
    switch (s?.toLowerCase()) {
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
          <h1 className="text-2xl font-bold text-white">Security Agent</h1>
          <p className="text-white/50 mt-1">
            Dependency scanning, code analysis, and remediation planning
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRun} disabled={running}>
          {running ? "Scanning..." : "Run Security Agent"}
        </GlassButton>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Security Grade</p>
          <p className={`text-3xl font-bold mt-1 ${
            grade === "A" ? "text-green-400" :
            grade === "B" ? "text-green-400" :
            grade === "C" ? "text-amber-400" :
            grade === "D" ? "text-amber-400" :
            grade === "F" ? "text-red-400" : "text-white/40"
          }`}>{grade}</p>
          <p className="text-xs text-white/30 mt-1">Overall security grade</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Risk Score</p>
          <p className={`text-3xl font-bold mt-1 ${
            riskScore != null && riskScore <= 30 ? "text-green-400" :
            riskScore != null && riskScore <= 60 ? "text-amber-400" :
            riskScore != null ? "text-red-400" : "text-white/40"
          }`}>{riskScore != null ? `${riskScore}/100` : "N/A"}</p>
          <p className="text-xs text-white/30 mt-1">Composite risk</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Vulnerabilities</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{vulns.length}</p>
          <p className="text-xs text-white/30 mt-1">Found in dependencies</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <p className="text-xs text-white/40 uppercase">Critical CVEs</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{criticalCves}</p>
          <p className="text-xs text-white/30 mt-1">Requires immediate action</p>
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

      {/* Vulnerabilities Table */}
      <GlassCard title="Vulnerabilities">
        {vulns.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-4 px-3 py-2 text-xs text-white/40 uppercase border-b border-white/10">
              <span>Package</span>
              <span>Version</span>
              <span>Severity</span>
              <span>CVE ID</span>
              <span>Fix Version</span>
            </div>
            {vulns.map((v, i) => (
              <div key={i} className="glass-panel-sm p-3 grid grid-cols-5 gap-4 items-center">
                <span className="text-sm text-white/80 font-mono">{v.package}</span>
                <span className="text-sm text-white/60 font-mono">{v.version}</span>
                <GlassBadge variant={severityVariant(v.severity)}>{v.severity}</GlassBadge>
                <span className="text-xs text-white/50 font-mono">{v.cve_id}</span>
                <span className="text-sm text-green-400/80 font-mono">{v.fix_version || "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No vulnerabilities found. Run the agent to scan dependencies.</p>
        )}
      </GlassCard>

      {/* Code Findings */}
      {findings.length > 0 && (
        <GlassCard title="Code Security Findings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {findings.map((f, i) => (
              <div key={i} className="glass-panel-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <GlassBadge variant={severityVariant(f.severity)}>{f.severity}</GlassBadge>
                  <span className="text-xs text-white/40 font-mono">{f.file}</span>
                </div>
                <p className="text-sm text-white/80 mb-2">{f.pattern}</p>
                <p className="text-xs text-white/50">
                  <span className="text-white/40">Fix: </span>{f.remediation}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Remediation Plan */}
      {remediation && (
        <GlassCard title="Remediation Plan">
          <div className="space-y-4">
            {remediation.immediate?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-400 mb-2">Immediate</h4>
                <ul className="space-y-1">
                  {remediation.immediate.map((item, i) => (
                    <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">&#x2022;</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {remediation.short_term?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-amber-400 mb-2">Short-term</h4>
                <ul className="space-y-1">
                  {remediation.short_term.map((item, i) => (
                    <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">&#x2022;</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {remediation.long_term?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-2">Long-term</h4>
                <ul className="space-y-1">
                  {remediation.long_term.map((item, i) => (
                    <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">&#x2022;</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
