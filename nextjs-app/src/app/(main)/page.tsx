"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import MetricCard from "@/components/ui/MetricCard";
import GlassBadge from "@/components/ui/GlassBadge";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { useOrganization } from "@/contexts/OrganizationContext";

interface DashboardData {
  repositories: number;
  functionalities: number;
  capabilities: number;
  products: number;
  recentExecutions: Array<{
    id: string;
    agentType: string;
    status: string;
    createdAt: string;
  }>;
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export default function DashboardPage() {
  const { currentOrg } = useOrganization();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError(null);
        const orgParam = currentOrg?.id ? `?organizationId=${currentOrg.id}` : "";
        const [reposRes, riskRes] = await Promise.all([
          fetch(`/api/repositories${orgParam}`),
          fetch(`/api/risk${orgParam}`),
        ]);

        if (!reposRes.ok) {
          throw new Error(`Failed to fetch repositories (status ${reposRes.status})`);
        }
        if (!riskRes.ok) {
          throw new Error(`Failed to fetch risk data (status ${riskRes.status})`);
        }

        const repos = await reposRes.json();
        const risks = await riskRes.json();

        const funcCount = repos.reduce((sum: number, r: { _count?: { functionalities?: number }; functionalities?: unknown[] }) => sum + (r._count?.functionalities || r.functionalities?.length || 0), 0);

        const riskSummary = { critical: 0, high: 0, medium: 0, low: 0 };
        risks.forEach((r: { severity: string }) => {
          const key = r.severity.toLowerCase() as keyof typeof riskSummary;
          if (key in riskSummary) riskSummary[key]++;
        });

        setData({
          repositories: repos.length,
          functionalities: funcCount,
          capabilities: 0,
          products: 0,
          recentExecutions: [],
          riskSummary,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [currentOrg?.id]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Transformation Dashboard</h1>
          <p className="text-white/50 mt-1">Enterprise legacy-to-AI transformation overview</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <p className="text-white/40 text-sm">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Transformation Dashboard</h1>
          <p className="text-white/50 mt-1">Enterprise legacy-to-AI transformation overview</p>
        </div>
        <GlassCard>
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-white/80">Unable to load dashboard</h3>
            <p className="mt-2 text-xs text-white/40">{error}</p>
            <p className="mt-1 text-xs text-white/30">
              Please verify the API services are running and the database is accessible.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-xs text-white/60 border border-white/20 rounded hover:bg-white/5 transition-colors"
            >
              Retry
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Transformation Dashboard</h1>
        <p className="text-white/50 mt-1">Enterprise legacy-to-AI transformation overview</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Repositories"
          value={data?.repositories ?? 0}
          subtitle="Analyzed codebases"
          icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
        <MetricCard
          title="Functionalities"
          value={data?.functionalities ?? 0}
          subtitle="Discovered functions"
          icon="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
        <MetricCard
          title="Risk Score"
          value={data ? `${((data.riskSummary.critical * 9 + data.riskSummary.high * 7 + data.riskSummary.medium * 5 + data.riskSummary.low * 2) / Math.max(Object.values(data.riskSummary).reduce((a, b) => a + b, 0), 1)).toFixed(1)}` : "0"}
          subtitle="Weighted average"
          trend={data && data.riskSummary.critical > 0 ? "up" : "down"}
          trendValue={data ? `${data.riskSummary.critical} critical` : "0 critical"}
          icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
        <MetricCard
          title="Agent Runs"
          value={data?.recentExecutions?.length ?? 0}
          subtitle="Total executions"
          icon="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transformation Overview */}
        <GlassCard title="BMAD Hierarchy">
          {data && data.repositories > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-white/40">
                {data.repositories} repositories analyzed with {data.functionalities} functionalities discovered.
              </p>
              {[
                { label: "Repository", level: 0 },
                { label: "Functionality", level: 1 },
                { label: "Digital Capability", level: 2 },
                { label: "Digital Product", level: 3 },
                { label: "Product Group", level: 4 },
                { label: "Value Stream Step", level: 5 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3" style={{ paddingLeft: `${item.level * 20}px` }}>
                  <div className="w-2 h-2 rounded-full bg-blue-400/60" />
                  <span className="text-sm font-medium text-white/80">{item.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-white/40 text-sm">No repositories analyzed yet.</p>
              <p className="text-white/30 text-xs mt-1">Run the Discovery Agent to populate the BMAD hierarchy.</p>
            </div>
          )}
        </GlassCard>

        {/* Risk Heatmap */}
        <GlassCard title="Risk Heatmap">
          {data && Object.values(data.riskSummary).some(v => v > 0) ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { category: "Critical", count: data.riskSummary.critical, severity: "CRITICAL" },
                { category: "High", count: data.riskSummary.high, severity: "HIGH" },
                { category: "Medium", count: data.riskSummary.medium, severity: "MEDIUM" },
                { category: "Low", count: data.riskSummary.low, severity: "LOW" },
              ].map((risk) => (
                <div
                  key={risk.category}
                  className={`glass-panel-sm p-4 border-l-4 ${
                    risk.severity === "CRITICAL"
                      ? "border-l-red-500"
                      : risk.severity === "HIGH"
                      ? "border-l-orange-500"
                      : risk.severity === "MEDIUM"
                      ? "border-l-amber-500"
                      : "border-l-green-500"
                  }`}
                >
                  <p className="text-xs text-white/50">{risk.category}</p>
                  <p className="text-2xl font-bold text-white mt-1">{risk.count}</p>
                  <GlassBadge variant={risk.severity === "CRITICAL" ? "danger" : risk.severity === "HIGH" ? "warning" : risk.severity === "MEDIUM" ? "warning" : "success"}>
                    {risk.severity}
                  </GlassBadge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-white/40 text-sm">No risk data available.</p>
              <p className="text-white/30 text-xs mt-1">Run the Risk & Compliance Agent to generate risk assessments.</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Agent Activity Feed */}
      <GlassCard title="Agent Activity">
        {data && data.recentExecutions.length > 0 ? (
          <div className="space-y-3">
            {data.recentExecutions.map((activity) => (
              <div key={activity.id} className="glass-panel-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusIndicator
                    status={
                      activity.status === "COMPLETED" ? "completed" :
                      activity.status === "FAILED" ? "failed" :
                      activity.status === "RUNNING" ? "running" : "pending"
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-white/80">
                      {activity.agentType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-white/40 font-mono">{activity.id.slice(0, 8)}...</p>
                  </div>
                </div>
                <span className="text-xs text-white/30">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-white/40 text-sm">No agent activity yet.</p>
            <p className="text-white/30 text-xs mt-1">Agent execution history will appear here once agents are triggered.</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
