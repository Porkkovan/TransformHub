"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentResults } from "@/hooks/useAgentResults";
import { useOrganization } from "@/contexts/OrganizationContext";

interface KPI {
  name: string;
  category: string;
  baseline: number;
  target: number;
  unit: string;
  frequency: string;
}

interface DriftItem {
  kpi_name: string;
  severity: string;
  drift_percentage: number;
  description?: string;
}

interface Alert {
  severity: string;
  message: string;
  kpi_name?: string;
  recommended_action: string;
}

interface MonitoringOutput {
  kpis: KPI[];
  drift_analysis: DriftItem[];
  trend_analysis: Record<string, unknown>;
  alerts: Alert[];
  dashboard: { health_score?: number };
}

export default function MonitoringAgentPage() {
  const { currentOrg } = useOrganization();
  const { results, execution, running, runAgent } = useAgentResults("monitoring");
  const data = results as unknown as MonitoringOutput | null;

  const handleRun = () => runAgent(currentOrg?.id);

  const kpis = data?.kpis ?? [];
  const drifts = data?.drift_analysis ?? [];
  const alerts = data?.alerts ?? [];
  const healthScore = data?.dashboard?.health_score;
  const criticalAlerts = alerts.filter((a) => a.severity?.toLowerCase() === "critical").length;

  const severityVariant = (s: string) => {
    switch (s?.toLowerCase()) {
      case "critical": return "danger" as const;
      case "high": return "danger" as const;
      case "warning": return "warning" as const;
      case "medium": return "warning" as const;
      case "low": return "info" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoring Agent</h1>
          <p className="text-white/50 mt-1">
            KPIs, drift detection, and trend analysis
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRun} disabled={running}>
          {running ? "Analyzing..." : "Run Monitoring Agent"}
        </GlassButton>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Health Score</p>
          <div className="flex items-center gap-3 mt-1">
            <p className={`text-3xl font-bold ${
              healthScore != null && healthScore >= 80 ? "text-green-400" :
              healthScore != null && healthScore >= 60 ? "text-amber-400" :
              healthScore != null ? "text-red-400" : "text-white/40"
            }`}>
              {healthScore != null ? `${healthScore}%` : "N/A"}
            </p>
          </div>
          <p className="text-xs text-white/30 mt-1">Overall health</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">KPIs Tracked</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{kpis.length}</p>
          <p className="text-xs text-white/30 mt-1">Active KPIs</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Drift Detected</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{drifts.length}</p>
          <p className="text-xs text-white/30 mt-1">KPIs drifting</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Critical Alerts</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{criticalAlerts}</p>
          <p className="text-xs text-white/30 mt-1">{criticalAlerts === 0 ? "All clear" : "Needs attention"}</p>
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

      {/* KPIs Table */}
      <GlassCard title="KPIs">
        {kpis.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-4 px-3 py-2 text-xs text-white/40 uppercase border-b border-white/10">
              <span>Name</span>
              <span>Category</span>
              <span className="text-right">Baseline</span>
              <span className="text-right">Target</span>
              <span>Unit</span>
              <span>Frequency</span>
            </div>
            {kpis.map((kpi, i) => (
              <div key={i} className="glass-panel-sm p-3 grid grid-cols-6 gap-4 items-center">
                <span className="text-sm text-white/80">{kpi.name}</span>
                <GlassBadge variant="info">{kpi.category}</GlassBadge>
                <span className="text-sm text-white/60 text-right">{kpi.baseline}</span>
                <span className="text-sm text-white/60 text-right">{kpi.target}</span>
                <span className="text-xs text-white/40">{kpi.unit}</span>
                <span className="text-xs text-white/40">{kpi.frequency}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No KPIs tracked yet. Run the agent to define KPIs.</p>
        )}
      </GlassCard>

      {/* Drift Analysis */}
      {drifts.length > 0 && (
        <GlassCard title="Drift Analysis">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drifts.map((d, i) => (
              <div key={i} className="glass-panel-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white/80">{d.kpi_name}</span>
                  <GlassBadge variant={severityVariant(d.severity)}>{d.severity}</GlassBadge>
                </div>
                <p className="text-2xl font-bold text-amber-400">{d.drift_percentage}%</p>
                {d.description && (
                  <p className="text-xs text-white/50 mt-2">{d.description}</p>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <GlassCard title="Alerts">
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className="glass-panel-sm p-4 border-l-4"
                style={{ borderLeftColor: alert.severity?.toLowerCase() === "critical" ? "rgb(239, 68, 68)" : alert.severity?.toLowerCase() === "warning" ? "rgb(245, 158, 11)" : "rgb(59, 130, 246)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <GlassBadge variant={severityVariant(alert.severity)}>{alert.severity}</GlassBadge>
                  {alert.kpi_name && <span className="text-xs text-white/40">{alert.kpi_name}</span>}
                </div>
                <p className="text-sm text-white/80">{alert.message}</p>
                <p className="text-xs text-white/50 mt-2">
                  <span className="text-white/40">Action: </span>{alert.recommended_action}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
