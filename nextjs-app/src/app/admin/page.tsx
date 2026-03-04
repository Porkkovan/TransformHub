"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

interface SummaryData {
  pipelineStatus: string | null;
  pendingApprovals: number;
  recentExecutions: {
    id: string;
    agentType: string;
    status: string;
    createdAt: string;
  }[];
  deadLetterCount: number;
}

const quickLinks = [
  { href: "/admin/pipeline", label: "Pipeline", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", color: "cyan" },
  { href: "/admin/approvals", label: "Approvals", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "green" },
  { href: "/admin/reports", label: "Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "purple" },
  { href: "/admin/chat", label: "AI Chat", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", color: "blue" },
  { href: "/admin/dead-letter", label: "Dead Letter Queue", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", color: "amber" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", color: "orange" },
];

const colorMap: Record<string, string> = {
  cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400",
  green: "from-green-500/20 to-green-500/5 border-green-500/30 text-green-400",
  purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400",
  blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400",
  amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400",
  orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400",
};

const statusBadge = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "RUNNING":
    case "IN_PROGRESS":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "FAILED":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-white/10 text-white/60 border-white/20";
  }
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<SummaryData>({
    pipelineStatus: null,
    pendingApprovals: 0,
    recentExecutions: [],
    deadLetterCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const [approvalsRes, executionsRes, deadLetterRes] = await Promise.allSettled([
          fetch("/api/approvals?status=PENDING"),
          fetch("/api/agents/executions?limit=5"),
          fetch("/api/dead-letter"),
        ]);

        const approvals =
          approvalsRes.status === "fulfilled" && approvalsRes.value.ok
            ? await approvalsRes.value.json()
            : [];
        const executions =
          executionsRes.status === "fulfilled" && executionsRes.value.ok
            ? await executionsRes.value.json()
            : [];
        const deadLetter =
          deadLetterRes.status === "fulfilled" && deadLetterRes.value.ok
            ? await deadLetterRes.value.json()
            : [];

        setData({
          pipelineStatus: null,
          pendingApprovals: Array.isArray(approvals) ? approvals.length : 0,
          recentExecutions: Array.isArray(executions) ? executions.slice(0, 5) : [],
          deadLetterCount: Array.isArray(deadLetter) ? deadLetter.length : 0,
        });
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, []);

  const formatAgentType = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-white/50 mt-1">
          Welcome back{user?.name ? `, ${user.name}` : ""}. Here&apos;s your operational overview.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
          <p className="text-xs text-white/40 uppercase">Pipeline</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">
            {loading ? "..." : data.recentExecutions.filter((e) => e.status === "RUNNING" || e.status === "IN_PROGRESS").length}
          </p>
          <p className="text-xs text-white/30 mt-1">Active runs</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <p className="text-xs text-white/40 uppercase">Pending Approvals</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">
            {loading ? "..." : data.pendingApprovals}
          </p>
          <p className="text-xs text-white/30 mt-1">Awaiting review</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Recent Agent Runs</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {loading ? "..." : data.recentExecutions.length}
          </p>
          <p className="text-xs text-white/30 mt-1">Last 5 executions</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Dead Letter Jobs</p>
          <p className="text-3xl font-bold text-red-400 mt-1">
            {loading ? "..." : data.deadLetterCount}
          </p>
          <p className="text-xs text-white/30 mt-1">Failed jobs</p>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`glass-panel p-4 flex flex-col items-center gap-3 hover:scale-105 transition-transform border bg-gradient-to-b ${colorMap[link.color]}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={link.icon} />
              </svg>
              <span className="text-xs font-medium text-white/80 text-center">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Executions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Agent Executions</h2>
        <div className="glass-panel overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
            </div>
          ) : data.recentExecutions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/40 text-sm">No recent executions found</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {data.recentExecutions.map((exec) => (
                <div key={exec.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">{formatAgentType(exec.agentType)}</p>
                      <p className="text-xs text-white/30 font-mono">{exec.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-white/40">{formatDate(exec.createdAt)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(exec.status)}`}>
                      {exec.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
