"use client";

import React, { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useContextDocuments } from "@/hooks/useContextDocuments";
import { useApplicationPortfolio } from "@/hooks/useApplicationPortfolio";
import GlassSelect from "@/components/ui/GlassSelect";
import DocumentUploadArea from "@/components/context-hub/DocumentUploadArea";
import DocumentList from "@/components/context-hub/DocumentList";
import ApplicationTable from "@/components/context-hub/ApplicationTable";
import CompetitorIntelligence from "@/components/context-hub/CompetitorIntelligence";
import TechTrendsRadar from "@/components/context-hub/TechTrendsRadar";
import ContextSearch from "@/components/context-hub/ContextSearch";
import IntegrationsPanel from "@/components/context-hub/IntegrationsPanel";

const tabs = [
  { id: "documents", label: "Documents" },
  { id: "applications", label: "Applications" },
  { id: "competitors", label: "Competitors" },
  { id: "trends", label: "Tech Trends" },
  { id: "search", label: "Search" },
  { id: "integrations", label: "Integrations" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const categoryFilterOptions = [
  { value: "", label: "All Categories" },
  { value: "CURRENT_STATE", label: "Current State" },
  { value: "FUTURE_STATE", label: "Future State" },
  { value: "COMPETITOR", label: "Competitor" },
  { value: "VSM_BENCHMARKS", label: "VSM Benchmarks" },
  { value: "TRANSFORMATION_CASE_STUDIES", label: "Transformation Case Studies" },
  { value: "ARCHITECTURE_STANDARDS", label: "Architecture Standards" },
  { value: "COMPETITOR", label: "Competitor Intelligence" },
  { value: "TECH_TREND", label: "Tech Trends" },
  { value: "AGENT_OUTPUT", label: "Agent Output (System)" },
];

export default function ContextHubPage() {
  const { currentOrg } = useOrganization();
  const [activeTab, setActiveTab] = useState<TabId>("documents");
  const [categoryFilter, setCategoryFilter] = useState("");

  const {
    documents,
    loading: docsLoading,
    actionLoading: docsActionLoading,
    uploadDocument,
    processDocument,
    deleteDocument,
  } = useContextDocuments(currentOrg?.id, categoryFilter || undefined);

  const {
    applications,
    loading: appsLoading,
    actionLoading: appsActionLoading,
    addApplication,
    bulkImport,
    deleteApplication,
  } = useApplicationPortfolio(currentOrg?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Context Hub
        </h1>
        <p className="text-white/50 mt-1">
          Centralize organizational context for AI-powered analysis
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 glass-panel-sm w-fit">
        {tabs.map((tab) => (
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

      {/* Tab Content */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <DocumentUploadArea
            organizationId={currentOrg?.id}
            onUpload={uploadDocument}
            actionLoading={docsActionLoading}
          />
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Uploaded Documents</h2>
            <div className="w-48">
              <GlassSelect
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={categoryFilterOptions}
              />
            </div>
          </div>
          {docsLoading ? (
            <div className="glass-panel p-8 text-center">
              <p className="text-white/40 text-sm">Loading documents...</p>
            </div>
          ) : (
            <DocumentList
              documents={documents}
              onProcess={processDocument}
              onDelete={deleteDocument}
              actionLoading={docsActionLoading}
            />
          )}
        </div>
      )}

      {activeTab === "applications" && (
        <div>
          {appsLoading ? (
            <div className="glass-panel p-8 text-center">
              <p className="text-white/40 text-sm">Loading applications...</p>
            </div>
          ) : (
            <ApplicationTable
              applications={applications}
              onAdd={addApplication}
              onBulkImport={bulkImport}
              onDelete={deleteApplication}
              actionLoading={appsActionLoading}
            />
          )}
        </div>
      )}

      {activeTab === "competitors" && currentOrg && (
        <CompetitorIntelligence organizationId={currentOrg.id} />
      )}
      {activeTab === "trends" && currentOrg && (
        <TechTrendsRadar organizationId={currentOrg.id} />
      )}
      {activeTab === "search" && currentOrg && (
        <ContextSearch organizationId={currentOrg.id} />
      )}
      {activeTab === "integrations" && currentOrg && (
        <IntegrationsPanel orgId={currentOrg.id} />
      )}
    </div>
  );
}
