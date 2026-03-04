"use client";

import { useOrganization } from "@/contexts/OrganizationContext";

export default function TopBar() {
  const { organizations, currentOrg, switchOrg } = useOrganization();

  return (
    <header className="fixed top-0 left-64 right-0 h-16 glass-panel rounded-none border-t-0 border-r-0 border-l-0 z-30 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-white/70">Multi-Agent Enterprise Transformation</h2>
      </div>
      <div className="flex items-center gap-4">
        {/* Org Switcher */}
        {organizations.length > 0 && (
          <select
            value={currentOrg?.id || ""}
            onChange={(e) => switchOrg(e.target.value)}
            className="glass-panel-sm px-3 py-1.5 text-xs text-white/70 bg-transparent border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id} className="bg-gray-900 text-white">
                {org.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>10 Agents Ready</span>
        </div>
        <div className="glass-panel-sm px-4 py-2 text-xs text-white/60">
          {currentOrg?.regulatoryFrameworks?.length
            ? currentOrg.regulatoryFrameworks.join(" | ")
            : "No frameworks configured"}
        </div>
      </div>
    </header>
  );
}
