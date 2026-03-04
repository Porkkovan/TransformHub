"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassInput from "@/components/ui/GlassInput";
import GlassSelect from "@/components/ui/GlassSelect";
import GlassBadge from "@/components/ui/GlassBadge";
import { useOrganization, type Organization } from "@/contexts/OrganizationContext";
import { INDUSTRY_CONFIGS, getIndustryOptions, getIndustryConfig } from "@/lib/industry-regulations";

export default function OrganizationsPage() {
  const router = useRouter();
  const { organizations, currentOrg, switchOrg, refetch } = useOrganization();
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; slug: string; industryType: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const proceedAfterSave = useRef(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    industryType: "",
    description: "",
    competitors: "",
    businessSegments: "",
    regulatoryFrameworks: [] as string[],
    personas: [] as { type: string; name: string; responsibilities: string[] }[],
  });

  const industryOptions = getIndustryOptions();

  const handleIndustryChange = (industryType: string) => {
    const config = getIndustryConfig(industryType);
    setFormData((prev) => ({
      ...prev,
      industryType,
      regulatoryFrameworks: config?.regulatoryFrameworks || [],
      personas: config?.personas || [],
    }));
  };

  const handleNameChange = async (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setFormData((prev) => ({ ...prev, name, slug }));

    if (name.length >= 2) {
      try {
        const res = await fetch(`/api/organizations/suggest?q=${encodeURIComponent(name)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: { id: string; name: string; slug: string; industryType: string }) => {
    const slug = suggestion.slug;
    setFormData((prev) => ({ ...prev, name: suggestion.name, slug, industryType: suggestion.industryType }));
    handleIndustryChange(suggestion.industryType);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const payload = {
      ...formData,
      competitors: formData.competitors.split(",").map((s) => s.trim()).filter(Boolean),
      businessSegments: formData.businessSegments.split(",").map((s) => s.trim()).filter(Boolean),
    };

    try {
      let res: Response;
      if (editingOrg) {
        res = await fetch(`/api/organizations/${editingOrg.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Save failed (${res.status})`);
      }

      setShowForm(false);
      setEditingOrg(null);
      setFormData({ name: "", slug: "", industryType: "", description: "", competitors: "", businessSegments: "", regulatoryFrameworks: [], personas: [] });
      await refetch();
      if (proceedAfterSave.current) {
        proceedAfterSave.current = false;
        router.push("/discovery");
      }
    } catch (err) {
      proceedAfterSave.current = false;
      setSaveError(err instanceof Error ? err.message : "Failed to save organization");
    }
  };

  const handleEdit = (org: Organization) => {
    setSaveError(null);
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      industryType: org.industryType,
      description: org.description || "",
      competitors: org.competitors.join(", "),
      businessSegments: org.businessSegments.join(", "),
      regulatoryFrameworks: org.regulatoryFrameworks,
      personas: org.personas as { type: string; name: string; responsibilities: string[] }[],
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/organizations/${id}`, { method: "DELETE" });
    await refetch();
  };

  const toggleFramework = (fw: string) => {
    setFormData((prev) => ({
      ...prev,
      regulatoryFrameworks: prev.regulatoryFrameworks.includes(fw)
        ? prev.regulatoryFrameworks.filter((f) => f !== fw)
        : [...prev.regulatoryFrameworks, fw],
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-white/50 mt-1">Manage organizations and industry configurations</p>
        </div>
        <GlassButton onClick={() => { setShowForm(!showForm); setEditingOrg(null); setSaveError(null); setFormData({ name: "", slug: "", industryType: "", description: "", competitors: "", businessSegments: "", regulatoryFrameworks: [], personas: [] }); }}>
          {showForm ? "Cancel" : "New Organization"}
        </GlassButton>
      </div>

      {showForm && (
        <GlassCard title={editingOrg ? "Edit Organization" : "Create Organization"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <GlassInput
                  label="Organization Name"
                  placeholder="e.g., Acme Financial"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 glass-panel rounded-xl border border-white/10 max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectSuggestion(s)}
                        className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors"
                      >
                        <span className="text-white/90">{s.name}</span>
                        <span className="text-white/40 ml-2 text-xs">{s.industryType}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <GlassInput label="Slug" placeholder="auto-generated" value={formData.slug} onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))} />
            </div>

            <GlassSelect
              label="Industry Type"
              value={formData.industryType}
              onChange={(e) => handleIndustryChange(e.target.value)}
              options={[{ value: "", label: "Select industry..." }, ...industryOptions]}
            />

            <GlassInput label="Description" placeholder="Brief description of the organization" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} />

            <GlassInput label="Competitors (comma-separated)" placeholder="e.g., Schwab, Fidelity, Vanguard" value={formData.competitors} onChange={(e) => setFormData((prev) => ({ ...prev, competitors: e.target.value }))} />

            <GlassInput label="Business Segments (comma-separated)" placeholder="e.g., Retail Banking, Wealth Management" value={formData.businessSegments} onChange={(e) => setFormData((prev) => ({ ...prev, businessSegments: e.target.value }))} />

            {/* Regulatory Frameworks */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Regulatory Frameworks</label>
              <div className="flex flex-wrap gap-2">
                {formData.regulatoryFrameworks.map((fw) => (
                  <button key={fw} type="button" onClick={() => toggleFramework(fw)} className="glass-panel-sm px-3 py-1 text-xs text-blue-400 border border-blue-500/30 rounded-full hover:bg-blue-500/20 transition-all">
                    {fw} &times;
                  </button>
                ))}
                <input
                  placeholder="Add framework..."
                  className="glass-input w-40 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !formData.regulatoryFrameworks.includes(val)) {
                        setFormData((prev) => ({ ...prev, regulatoryFrameworks: [...prev.regulatoryFrameworks, val] }));
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Personas Preview */}
            {formData.personas.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Suggested Personas</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {formData.personas.map((p, i) => (
                    <div key={i} className="glass-panel-sm p-3">
                      <p className="text-sm font-medium text-white/80">{p.name}</p>
                      <GlassBadge variant="info">{p.type.replace("_", " ")}</GlassBadge>
                      <ul className="mt-2 space-y-1">
                        {p.responsibilities.map((r, j) => (
                          <li key={j} className="text-xs text-white/50 flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-white/30" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {saveError && (
              <div className="glass-panel-sm p-3 border border-red-500/30 rounded-xl">
                <p className="text-sm text-red-400">{saveError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <GlassButton type="submit">{editingOrg ? "Update" : "Create"} Organization</GlassButton>
              {!editingOrg && (
                <GlassButton
                  type="submit"
                  variant="success"
                  onClick={() => { proceedAfterSave.current = true; }}
                >
                  Submit &amp; Proceed to Discovery
                </GlassButton>
              )}
            </div>
          </form>
        </GlassCard>
      )}

      {/* Organization Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {organizations.map((org) => (
          <GlassCard key={org.id} title={org.name} className={currentOrg?.id === org.id ? "border-blue-500/50" : ""}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <GlassBadge variant="info">{INDUSTRY_CONFIGS[org.industryType]?.label || org.industryType}</GlassBadge>
                {currentOrg?.id === org.id && <GlassBadge variant="success">Active</GlassBadge>}
              </div>
              {org.description && <p className="text-sm text-white/50">{org.description}</p>}

              <div>
                <p className="text-xs text-white/40 uppercase mb-1">Regulatory Frameworks</p>
                <div className="flex flex-wrap gap-1">
                  {org.regulatoryFrameworks.map((fw) => (
                    <span key={fw} className="glass-panel-sm px-2 py-0.5 text-xs text-white/60">{fw}</span>
                  ))}
                </div>
              </div>

              {org.competitors.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 uppercase mb-1">Competitors</p>
                  <p className="text-sm text-white/60">{org.competitors.join(", ")}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <GlassButton onClick={() => switchOrg(org.id)} className="text-xs">
                  {currentOrg?.id === org.id ? "Selected" : "Select"}
                </GlassButton>
                <GlassButton onClick={() => handleEdit(org)} className="text-xs">Edit</GlassButton>
                <button onClick={() => handleDelete(org.id)} className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded-lg hover:bg-red-500/10 transition-all">
                  Delete
                </button>
              </div>
            </div>
          </GlassCard>
        ))}

        {organizations.length === 0 && (
          <div className="lg:col-span-2 glass-panel p-12 text-center">
            <p className="text-white/40">No organizations yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
