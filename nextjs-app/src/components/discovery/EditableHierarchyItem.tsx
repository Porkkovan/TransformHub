"use client";

import { useState } from "react";

interface EditableHierarchyItemProps {
  id: string;
  name: string;
  description?: string;
  entityType: "digital-products" | "digital-capabilities" | "functionalities";
  category?: string;
  businessSegment?: string | null;
  segmentOptions?: string[];
  onSaved?: () => void;
  children: React.ReactNode;
}

export default function EditableHierarchyItem({
  id,
  name,
  description,
  entityType,
  category,
  businessSegment,
  segmentOptions,
  onSaved,
  children,
}: EditableHierarchyItemProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editDesc, setEditDesc] = useState(description || "");
  const [editCategory, setEditCategory] = useState(category || "");
  const [editSegment, setEditSegment] = useState(businessSegment || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string | null> = { name: editName, description: editDesc };
      if (entityType === "digital-capabilities" && editCategory) {
        body.category = editCategory;
      }
      if (entityType === "digital-products") {
        body.businessSegment = editSegment || null;
      }
      const res = await fetch(`/api/${entityType}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditing(false);
        onSaved?.();
      }
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(name);
    setEditDesc(description || "");
    setEditCategory(category || "");
    setEditSegment(businessSegment || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="glass-panel-sm p-3 rounded-lg space-y-2">
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="glass-input text-sm w-full"
          placeholder="Name"
        />
        <input
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          className="glass-input text-xs w-full"
          placeholder="Description"
        />
        {entityType === "digital-capabilities" && (
          <input
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            className="glass-input text-xs w-full"
            placeholder="Category"
          />
        )}
        {entityType === "digital-products" && segmentOptions && segmentOptions.length > 0 && (
          <select
            value={editSegment}
            onChange={(e) => setEditSegment(e.target.value)}
            className="glass-input text-xs w-full"
          >
            <option value="">No Segment</option>
            {segmentOptions.map((seg) => (
              <option key={seg} value={seg}>{seg}</option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-xs rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      {children}
      <button
        onClick={() => setEditing(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
        title="Edit"
      >
        <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
}
