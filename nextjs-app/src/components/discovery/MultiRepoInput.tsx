"use client";

import { useState } from "react";
import GlassInput from "@/components/ui/GlassInput";
import GlassButton from "@/components/ui/GlassButton";

export interface RepoEntry {
  name: string;
  url: string;
}

interface MultiRepoInputProps {
  onSubmit: (repos: RepoEntry[]) => void;
  disabled?: boolean;
}

export default function MultiRepoInput({ onSubmit, disabled }: MultiRepoInputProps) {
  const [repos, setRepos] = useState<RepoEntry[]>([{ name: "", url: "" }]);

  const addRow = () => {
    setRepos((prev) => [...prev, { name: "", url: "" }]);
  };

  const removeRow = (index: number) => {
    setRepos((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof RepoEntry, value: string) => {
    setRepos((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = repos.filter((r) => r.name.trim());
    if (valid.length > 0) {
      onSubmit(valid);
    }
  };

  const hasValidRepo = repos.some((r) => r.name.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {repos.map((repo, index) => (
        <div key={index} className="flex gap-3 items-end">
          <div className="flex-1">
            <GlassInput
              label={index === 0 ? "Repository Name" : undefined}
              placeholder="e.g., legacy-core-system"
              value={repo.name}
              onChange={(e) => updateRow(index, "name", e.target.value)}
            />
          </div>
          <div className="flex-1">
            <GlassInput
              label={index === 0 ? "Repository URL" : undefined}
              placeholder="https://github.com/org/repo"
              value={repo.url}
              onChange={(e) => updateRow(index, "url", e.target.value)}
            />
          </div>
          {repos.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="pb-1 text-red-400/60 hover:text-red-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-blue-400/70 hover:text-blue-400 flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Repository
        </button>
      </div>
      <GlassButton type="submit" disabled={disabled || !hasValidRepo}>
        {disabled ? "Analyzing..." : `Run Discovery Agent (${repos.filter((r) => r.name.trim()).length} repos)`}
      </GlassButton>
    </form>
  );
}
