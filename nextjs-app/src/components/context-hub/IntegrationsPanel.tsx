"use client";

import React, { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExternalIntegration {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  username?: string | null;
  projectKey?: string | null;
  status: "idle" | "syncing" | "synced" | "error";
  lastSyncAt?: string | null;
  syncedItems: number;
  errorMessage?: string | null;
  createdAt: string;
}

interface IntegrationsPanelProps {
  orgId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INTEGRATION_TYPES = [
  { value: "jira", label: "Jira", placeholder: "https://yourcompany.atlassian.net" },
  { value: "confluence", label: "Confluence", placeholder: "https://yourcompany.atlassian.net" },
  { value: "azure_devops", label: "Azure DevOps", placeholder: "https://dev.azure.com" },
  { value: "notion", label: "Notion", placeholder: "https://api.notion.com" },
  { value: "servicenow", label: "ServiceNow", placeholder: "https://yourinstance.service-now.com" },
] as const;

type IntegrationType = (typeof INTEGRATION_TYPES)[number]["value"];

const TYPE_LABELS: Record<string, string> = {
  jira: "Jira",
  confluence: "Confluence",
  azure_devops: "Azure DevOps",
  notion: "Notion",
  servicenow: "ServiceNow",
};

const TYPE_COLORS: Record<string, string> = {
  jira: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  confluence: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  azure_devops: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
  notion: "text-white/70 bg-white/10 border-white/20",
  servicenow: "text-green-400 bg-green-400/10 border-green-400/30",
};

const STATUS_COLORS: Record<string, string> = {
  idle: "text-white/50 bg-white/5 border-white/10",
  syncing: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  synced: "text-green-400 bg-green-400/10 border-green-400/30",
  error: "text-red-400 bg-red-400/10 border-red-400/30",
};

// ─── ProjectKey hint per type ─────────────────────────────────────────────────

function projectKeyLabel(type: string) {
  switch (type) {
    case "jira":        return "Project Key (e.g. ENG)";
    case "confluence":  return "Space Key (e.g. DOCS)";
    case "azure_devops": return "Org/Project (e.g. myorg/myproject)";
    case "notion":      return "Database ID";
    case "servicenow":  return "Table name (default: sc_req_item)";
    default:            return "Project / Space Key";
  }
}

function usernameLabel(type: string) {
  switch (type) {
    case "notion":      return null; // no username for Notion (Bearer token)
    case "azure_devops": return "Username (leave blank for PAT-only)";
    default:            return "Username / Email";
  }
}

function tokenLabel(type: string) {
  switch (type) {
    case "notion":      return "Integration Token";
    case "azure_devops": return "Personal Access Token";
    default:            return "API Token";
  }
}

// ─── Empty state form ─────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: "",
  type: "jira" as IntegrationType,
  baseUrl: "",
  username: "",
  apiToken: "",
  projectKey: "",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function IntegrationsPanel({ orgId }: IntegrationsPanelProps) {
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, { connected: boolean; error?: string }>>({});

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations?organizationId=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch (e) {
      console.error("Failed to load integrations", e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Auto-set baseUrl placeholder when type changes
  const selectedTypeMeta = INTEGRATION_TYPES.find((t) => t.value === form.type);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          name: form.name,
          type: form.type,
          baseUrl: form.baseUrl,
          username: form.username || undefined,
          apiToken: form.apiToken,
          projectKey: form.projectKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create integration");
        return;
      }
      setIntegrations((prev) => [data, ...prev]);
      setForm({ ...DEFAULT_FORM });
      setShowForm(false);
    } catch {
      setFormError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSync(id: string) {
    setActionLoading((prev) => ({ ...prev, [id]: "syncing" }));
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "syncing" as const } : i))
    );
    try {
      const res = await fetch(`/api/integrations/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, status: "error" as const, errorMessage: data.error } : i
          )
        );
      } else {
        // Refresh from server
        await fetchIntegrations();
      }
    } catch {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "error" as const, errorMessage: "Network error" } : i
        )
      );
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function handleTest(id: string) {
    setActionLoading((prev) => ({ ...prev, [id + "_test"]: "testing" }));
    try {
      const res = await fetch(`/api/integrations/${id}/sync`);
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { connected: false, error: "Network error" } }));
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id + "_test"];
        return next;
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this integration and all synced documents?")) return;
    setActionLoading((prev) => ({ ...prev, [id]: "deleting" }));
    try {
      await fetch(`/api/integrations/${id}`, { method: "DELETE" });
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">External Integrations</h2>
          <p className="text-sm text-white/50 mt-1">
            Connect Jira, Confluence, Azure DevOps, Notion, or ServiceNow. Synced data is stored as
            context documents and automatically considered by all AI agents.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all text-sm font-medium whitespace-nowrap"
        >
          {showForm ? "Cancel" : "+ Add Integration"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="glass-panel p-6 space-y-4 border border-blue-500/20"
        >
          <h3 className="text-sm font-semibold text-white/80">New Integration</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-xs text-white/50 mb-1">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as IntegrationType, baseUrl: "" }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                required
              >
                {INTEGRATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-gray-900">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs text-white/50 mb-1">Display Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={`My ${TYPE_LABELS[form.type]} Integration`}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                required
              />
            </div>

            {/* Base URL */}
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/50 mb-1">Base URL *</label>
              <input
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder={selectedTypeMeta?.placeholder || "https://..."}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                required
              />
            </div>

            {/* Username (hidden for Notion) */}
            {usernameLabel(form.type) && (
              <div>
                <label className="block text-xs text-white/50 mb-1">{usernameLabel(form.type)}</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="user@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            )}

            {/* API Token */}
            <div>
              <label className="block text-xs text-white/50 mb-1">{tokenLabel(form.type)} *</label>
              <input
                type="password"
                value={form.apiToken}
                onChange={(e) => setForm((f) => ({ ...f, apiToken: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                required
              />
            </div>

            {/* Project/Space Key */}
            <div>
              <label className="block text-xs text-white/50 mb-1">{projectKeyLabel(form.type)}</label>
              <input
                value={form.projectKey}
                onChange={(e) => setForm((f) => ({ ...f, projectKey: e.target.value }))}
                placeholder="e.g. ENG"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          {formError && (
            <p className="text-red-400 text-xs">{formError}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-blue-600/80 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-all"
            >
              {submitting ? "Saving…" : "Save Integration"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-5 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* How it works */}
      <div className="glass-panel-sm p-4 border border-white/5 text-xs text-white/40 space-y-1">
        <p className="font-medium text-white/60">How integration data reaches agents</p>
        <p>
          After syncing, fetched items (issues, pages, work items) are saved as <strong className="text-white/60">Context Documents</strong> with
          category <code className="text-cyan-400/80">integration</code>. All 18 AI agents automatically read context documents before
          generating output — so your Jira issues, Confluence pages, or ServiceNow tickets will directly
          inform discovery, capability mapping, and future-state suggestions.
        </p>
      </div>

      {/* Integration cards */}
      {loading ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/40 text-sm">Loading integrations…</p>
        </div>
      ) : integrations.length === 0 ? (
        <div className="glass-panel p-10 text-center border border-dashed border-white/10">
          <p className="text-white/40 text-sm">No integrations yet. Add one above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => {
            const isBusy = !!actionLoading[integration.id];
            const testResult = testResults[integration.id];
            const isTesting = !!actionLoading[integration.id + "_test"];

            return (
              <div key={integration.id} className="glass-panel p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-xs rounded border font-medium ${TYPE_COLORS[integration.type] || "text-white/50 bg-white/5 border-white/10"}`}
                    >
                      {TYPE_LABELS[integration.type] || integration.type}
                    </span>
                    <span className="text-white font-medium text-sm">{integration.name}</span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded border ${STATUS_COLORS[integration.status]}`}
                    >
                      {integration.status === "syncing" ? "⟳ syncing…" : integration.status}
                    </span>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTest(integration.id)}
                      disabled={isBusy || isTesting}
                      className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-all"
                    >
                      {isTesting ? "Testing…" : "Test"}
                    </button>
                    <button
                      onClick={() => handleSync(integration.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 transition-all"
                    >
                      {isBusy && actionLoading[integration.id] === "syncing" ? "Syncing…" : "Sync Now"}
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/40">
                  <span>
                    <span className="text-white/30">URL:</span>{" "}
                    <span className="text-white/60 font-mono">{integration.baseUrl}</span>
                  </span>
                  {integration.projectKey && (
                    <span>
                      <span className="text-white/30">Key:</span>{" "}
                      <span className="text-white/60 font-mono">{integration.projectKey}</span>
                    </span>
                  )}
                  <span>
                    <span className="text-white/30">Last synced:</span>{" "}
                    {formatDate(integration.lastSyncAt)}
                  </span>
                  {integration.syncedItems > 0 && (
                    <span>
                      <span className="text-white/30">Items:</span>{" "}
                      <span className="text-green-400/80">{integration.syncedItems}</span>
                    </span>
                  )}
                </div>

                {/* Error message */}
                {integration.errorMessage && (
                  <p className="text-xs text-red-400/80 bg-red-500/5 border border-red-500/10 rounded px-3 py-2">
                    {integration.errorMessage}
                  </p>
                )}

                {/* Test result */}
                {testResult && (
                  <p
                    className={`text-xs rounded px-3 py-2 border ${
                      testResult.connected
                        ? "text-green-400 bg-green-500/5 border-green-500/10"
                        : "text-red-400 bg-red-500/5 border-red-500/10"
                    }`}
                  >
                    {testResult.connected
                      ? "Connection successful"
                      : `Connection failed: ${testResult.error || "Unknown error"}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
