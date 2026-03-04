"use client";

import React, { useState, useMemo } from "react";
import GlassModal from "@/components/ui/GlassModal";
import GlassButton from "@/components/ui/GlassButton";
import GlassInput from "@/components/ui/GlassInput";
import GlassSelect from "@/components/ui/GlassSelect";

interface AddCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    capabilityName: string;
    category: string;
    description?: string;
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    quarter: string;
    initiative?: string;
  }) => void;
  itemType?: string;
}

const CATEGORY_OPTIONS = [
  { value: "RPA_AUTOMATION", label: "RPA Automation" },
  { value: "AI_ML_INTEGRATION", label: "AI/ML Integration" },
  { value: "AGENT_BASED", label: "Agent-Based" },
  { value: "CONVERSATIONAL_AI", label: "Conversational AI" },
  { value: "ADVANCED_ANALYTICS", label: "Advanced Analytics" },
];

const QUARTER_OPTIONS = [
  { value: "Q1 2026", label: "Q1 2026" },
  { value: "Q2 2026", label: "Q2 2026" },
  { value: "Q3 2026", label: "Q3 2026" },
  { value: "Q4 2026", label: "Q4 2026" },
];

export default function AddCapabilityModal({ isOpen, onClose, onAdd, itemType }: AddCapabilityModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("AI_ML_INTEGRATION");
  const [description, setDescription] = useState("");
  const [reach, setReach] = useState("5");
  const [impact, setImpact] = useState("5");
  const [confidence, setConfidence] = useState("0.7");
  const [effort, setEffort] = useState("3");
  const [quarter, setQuarter] = useState("Q1 2026");
  const [initiative, setInitiative] = useState("");

  const isCapability = !itemType || itemType === "capability";

  const riceScore = useMemo(() => {
    const r = Number(reach) || 0;
    const i = Number(impact) || 0;
    const c = Number(confidence) || 0;
    const e = Math.max(Number(effort) || 1, 1);
    return (r * i * c) / e;
  }, [reach, impact, confidence, effort]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      capabilityName: name.trim(),
      category,
      description: description.trim() || undefined,
      reach: Number(reach) || 0,
      impact: Number(impact) || 0,
      confidence: Number(confidence) || 0,
      effort: Math.max(Number(effort) || 1, 1),
      quarter,
      initiative: initiative.trim() || undefined,
    });
    // Reset form
    setName("");
    setDescription("");
    setReach("5");
    setImpact("5");
    setConfidence("0.7");
    setEffort("3");
    setInitiative("");
    onClose();
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title={isCapability ? "Add Capability to Roadmap" : "Add Functionality to Roadmap"}>
      <div className="space-y-4">
        <GlassInput
          label={isCapability ? "Capability Name" : "Functionality Name"}
          placeholder={isCapability ? "e.g. Intelligent Document Processing" : "e.g. Auto-Classification Engine"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <GlassSelect
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={CATEGORY_OPTIONS}
        />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Description</label>
          <textarea
            placeholder={isCapability ? "Brief description of the capability..." : "Brief description of the functionality..."}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="glass-input resize-none"
          />
        </div>

        {isCapability && (
          <GlassInput
            label="Initiative (optional)"
            placeholder="e.g. Digital Transformation"
            value={initiative}
            onChange={(e) => setInitiative(e.target.value)}
          />
        )}

        {/* RICE Score Fields */}
        <div className="grid grid-cols-2 gap-3">
          <GlassInput
            label="Reach (1-10)"
            type="number"
            value={reach}
            onChange={(e) => setReach(e.target.value)}
          />
          <GlassInput
            label="Impact (1-10)"
            type="number"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
          />
          <GlassInput
            label="Confidence (0-1)"
            type="number"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          />
          <GlassInput
            label="Effort (1+)"
            type="number"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
          />
        </div>

        {/* Live RICE Score */}
        <div className="glass-panel-sm p-3 flex items-center justify-between">
          <span className="text-xs text-white/50">Calculated RICE Score</span>
          <span className="text-lg font-bold text-cyan-400">{riceScore.toFixed(1)}</span>
        </div>

        <GlassSelect
          label="Target Quarter"
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
          options={QUARTER_OPTIONS}
        />

        <div className="flex justify-end gap-3 pt-2">
          <GlassButton onClick={onClose}>Cancel</GlassButton>
          <GlassButton variant="success" onClick={handleSubmit} disabled={!name.trim()}>
            Add to Roadmap
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
