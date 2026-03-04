"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassInput from "@/components/ui/GlassInput";
import GlassBadge from "@/components/ui/GlassBadge";
import { useOrganization } from "@/contexts/OrganizationContext";

interface NotificationChannel {
  type: "email" | "slack" | "webhook";
  enabled: boolean;
  config: Record<string, string>;
}

interface NotificationSettings {
  channels: NotificationChannel[];
  events: {
    agentCompleted: boolean;
    agentFailed: boolean;
    pipelineCompleted: boolean;
    driftDetected: boolean;
    securityAlert: boolean;
    approvalRequired: boolean;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  channels: [
    { type: "email", enabled: false, config: { recipients: "" } },
    { type: "slack", enabled: false, config: { webhookUrl: "", channel: "" } },
    { type: "webhook", enabled: false, config: { url: "", secret: "", method: "POST" } },
  ],
  events: {
    agentCompleted: true,
    agentFailed: true,
    pipelineCompleted: true,
    driftDetected: true,
    securityAlert: true,
    approvalRequired: true,
  },
};

const EVENT_LABELS: Record<string, { label: string; description: string }> = {
  agentCompleted: { label: "Agent Completed", description: "Notify when any agent finishes execution successfully" },
  agentFailed: { label: "Agent Failed", description: "Notify when an agent execution fails" },
  pipelineCompleted: { label: "Pipeline Completed", description: "Notify when the full pipeline finishes" },
  driftDetected: { label: "Drift Detected", description: "Notify when KPI drift is detected by monitoring" },
  securityAlert: { label: "Security Alert", description: "Notify when critical security findings are discovered" },
  approvalRequired: { label: "Approval Required", description: "Notify when a transition requires approval" },
};

export default function NotificationSettingsPage() {
  const { currentOrg } = useOrganization();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const params = new URLSearchParams();
        if (currentOrg?.id) params.set("organizationId", currentOrg.id);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/settings/notifications${query}`);
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch {
        // Use defaults
      }
    };
    fetchSettings();
  }, [currentOrg?.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg?.id,
          ...settings,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Save failed
    } finally {
      setSaving(false);
    }
  };

  const handleTestChannel = async (channelType: string) => {
    setTestingChannel(channelType);
    try {
      await fetch("/api/settings/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg?.id,
          channelType,
        }),
      });
    } catch {
      // Test failed
    } finally {
      setTestingChannel(null);
    }
  };

  const toggleChannel = (type: string) => {
    setSettings((prev) => ({
      ...prev,
      channels: prev.channels.map((ch) =>
        ch.type === type ? { ...ch, enabled: !ch.enabled } : ch
      ),
    }));
  };

  const updateChannelConfig = (type: string, key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      channels: prev.channels.map((ch) =>
        ch.type === type ? { ...ch, config: { ...ch.config, [key]: value } } : ch
      ),
    }));
  };

  const toggleEvent = (eventKey: string) => {
    setSettings((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [eventKey]: !prev.events[eventKey as keyof typeof prev.events],
      },
    }));
  };

  const emailChannel = settings.channels.find((c) => c.type === "email")!;
  const slackChannel = settings.channels.find((c) => c.type === "slack")!;
  const webhookChannel = settings.channels.find((c) => c.type === "webhook")!;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notification Settings</h1>
          <p className="text-white/50 mt-1">
            Configure email, Slack, and webhook notification channels
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <GlassBadge variant="success">Saved successfully</GlassBadge>
          )}
          <GlassButton onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </GlassButton>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Channel */}
        <GlassCard className="border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">Email</h3>
            </div>
            <button
              onClick={() => toggleChannel("email")}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                emailChannel.enabled ? "bg-blue-500" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  emailChannel.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className={`space-y-4 transition-opacity ${emailChannel.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <GlassInput
              label="Recipients"
              placeholder="email@example.com, team@example.com"
              value={emailChannel.config.recipients ?? ""}
              onChange={(e) => updateChannelConfig("email", "recipients", e.target.value)}
            />
            <p className="text-xs text-white/30">Separate multiple addresses with commas</p>
            <GlassButton
              onClick={() => handleTestChannel("email")}
              disabled={testingChannel === "email" || !emailChannel.enabled}
              className="w-full text-sm"
            >
              {testingChannel === "email" ? "Sending Test..." : "Send Test Email"}
            </GlassButton>
          </div>
        </GlassCard>

        {/* Slack Channel */}
        <GlassCard className="border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">Slack</h3>
            </div>
            <button
              onClick={() => toggleChannel("slack")}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                slackChannel.enabled ? "bg-purple-500" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  slackChannel.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className={`space-y-4 transition-opacity ${slackChannel.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <GlassInput
              label="Webhook URL"
              placeholder="https://hooks.slack.com/services/..."
              value={slackChannel.config.webhookUrl ?? ""}
              onChange={(e) => updateChannelConfig("slack", "webhookUrl", e.target.value)}
            />
            <GlassInput
              label="Channel"
              placeholder="#transformhub-alerts"
              value={slackChannel.config.channel ?? ""}
              onChange={(e) => updateChannelConfig("slack", "channel", e.target.value)}
            />
            <GlassButton
              onClick={() => handleTestChannel("slack")}
              disabled={testingChannel === "slack" || !slackChannel.enabled}
              className="w-full text-sm"
            >
              {testingChannel === "slack" ? "Sending Test..." : "Send Test Message"}
            </GlassButton>
          </div>
        </GlassCard>

        {/* Webhook Channel */}
        <GlassCard className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">Webhook</h3>
            </div>
            <button
              onClick={() => toggleChannel("webhook")}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                webhookChannel.enabled ? "bg-amber-500" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  webhookChannel.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className={`space-y-4 transition-opacity ${webhookChannel.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <GlassInput
              label="Endpoint URL"
              placeholder="https://your-api.com/webhooks/transformhub"
              value={webhookChannel.config.url ?? ""}
              onChange={(e) => updateChannelConfig("webhook", "url", e.target.value)}
            />
            <GlassInput
              label="Signing Secret"
              placeholder="whsec_..."
              type="password"
              value={webhookChannel.config.secret ?? ""}
              onChange={(e) => updateChannelConfig("webhook", "secret", e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-300">HTTP Method</label>
              <div className="flex gap-2">
                {["POST", "PUT"].map((method) => (
                  <button
                    key={method}
                    onClick={() => updateChannelConfig("webhook", "method", method)}
                    className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
                      (webhookChannel.config.method ?? "POST") === method
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/30"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
            <GlassButton
              onClick={() => handleTestChannel("webhook")}
              disabled={testingChannel === "webhook" || !webhookChannel.enabled}
              className="w-full text-sm"
            >
              {testingChannel === "webhook" ? "Sending Test..." : "Send Test Webhook"}
            </GlassButton>
          </div>
        </GlassCard>
      </div>

      {/* Event Configuration */}
      <GlassCard title="Event Subscriptions">
        <p className="text-sm text-white/40 mb-4">
          Choose which events trigger notifications across all enabled channels.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(EVENT_LABELS).map(([key, { label, description }]) => {
            const enabled = settings.events[key as keyof typeof settings.events];
            return (
              <div
                key={key}
                className="glass-panel-sm p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/90">{label}</span>
                    {enabled && <GlassBadge variant="success">ON</GlassBadge>}
                  </div>
                  <p className="text-xs text-white/40 mt-1">{description}</p>
                </div>
                <button
                  onClick={() => toggleEvent(key)}
                  className={`relative w-11 h-6 rounded-full transition-colors ml-4 flex-shrink-0 ${
                    enabled ? "bg-green-500" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
