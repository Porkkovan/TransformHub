"use client";

import { useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useOrganization } from "@/contexts/OrganizationContext";

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  agents: string[];
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "risk_assessment",
    title: "Risk Assessment",
    description: "Comprehensive risk scoring, severity analysis, mitigation plans, and transition approval status across all assessed entities.",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
    category: "Risk",
    agents: ["risk"],
  },
  {
    id: "vsm_analysis",
    title: "VSM Analysis",
    description: "Value stream mapping results including process times, lead times, wait times, flow efficiency metrics, and bottleneck identification.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    category: "Analysis",
    agents: ["vsm"],
  },
  {
    id: "architecture_review",
    title: "Architecture Review",
    description: "Technical architecture assessment including dependency graphs, modernization recommendations, and technology stack evaluation.",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    category: "Technical",
    agents: ["arch"],
  },
  {
    id: "cost_estimation",
    title: "Cost Estimation",
    description: "Detailed cost breakdown for transformation initiatives including effort estimates, resource requirements, and ROI projections.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    category: "Financial",
    agents: ["fiduciary"],
  },
  {
    id: "security_audit",
    title: "Security Audit",
    description: "Security posture report with vulnerability findings, CVE analysis, severity distribution, and remediation recommendations.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    category: "Security",
    agents: ["security"],
  },
  {
    id: "full_transformation",
    title: "Full Transformation",
    description: "End-to-end transformation report combining all agent outputs: discovery, VSM, risk, architecture, future state vision, and backlog items.",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    category: "Comprehensive",
    agents: ["discovery", "vsm", "risk", "arch", "fiduciary", "future_state", "backlog"],
  },
];

export default function ReportsPage() {
  const { currentOrg } = useOrganization();
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const handleDownload = async (reportId: string, format: "pdf" | "csv") => {
    const key = `${reportId}-${format}`;
    setDownloading((prev) => ({ ...prev, [key]: true }));
    try {
      const params = new URLSearchParams({
        reportType: reportId,
        format,
      });
      if (currentOrg?.id) params.set("organizationId", currentOrg.id);

      const res = await fetch(`/api/reports/download?${params.toString()}`);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportId}_report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently for now
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const categoryColor = (category: string) => {
    switch (category) {
      case "Risk": return "border-l-red-500";
      case "Analysis": return "border-l-blue-500";
      case "Technical": return "border-l-purple-500";
      case "Financial": return "border-l-green-500";
      case "Security": return "border-l-amber-500";
      case "Comprehensive": return "border-l-cyan-500";
      default: return "border-l-white/20";
    }
  };

  const categoryBadgeVariant = (category: string) => {
    switch (category) {
      case "Risk": return "danger" as const;
      case "Analysis": return "info" as const;
      case "Technical": return "default" as const;
      case "Financial": return "success" as const;
      case "Security": return "warning" as const;
      case "Comprehensive": return "info" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-white/50 mt-1">
            Download analysis reports in PDF and CSV formats
          </p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORT_TYPES.map((report) => (
          <GlassCard key={report.id} className={`border-l-4 ${categoryColor(report.category)}`}>
            <div className="flex flex-col h-full">
              {/* Icon and Title */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={report.icon} />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white">{report.title}</h3>
                  <GlassBadge variant={categoryBadgeVariant(report.category)}>
                    {report.category}
                  </GlassBadge>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-white/50 mb-4 flex-1">{report.description}</p>

              {/* Agents used */}
              <div className="flex flex-wrap gap-1 mb-4">
                {report.agents.map((agent) => (
                  <span
                    key={agent}
                    className="px-2 py-0.5 text-xs rounded bg-white/5 text-white/40 border border-white/10"
                  >
                    {agent}
                  </span>
                ))}
              </div>

              {/* Download Buttons */}
              <div className="flex gap-3">
                <GlassButton
                  onClick={() => handleDownload(report.id, "pdf")}
                  disabled={downloading[`${report.id}-pdf`]}
                  className="flex-1 text-sm"
                >
                  {downloading[`${report.id}-pdf`] ? (
                    "Generating..."
                  ) : (
                    <>
                      <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      PDF
                    </>
                  )}
                </GlassButton>
                <GlassButton
                  onClick={() => handleDownload(report.id, "csv")}
                  disabled={downloading[`${report.id}-csv`]}
                  className="flex-1 text-sm"
                >
                  {downloading[`${report.id}-csv`] ? (
                    "Generating..."
                  ) : (
                    <>
                      <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSV
                    </>
                  )}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
