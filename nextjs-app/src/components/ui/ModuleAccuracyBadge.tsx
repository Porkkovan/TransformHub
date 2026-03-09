"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import Link from "next/link";

// Lightweight per-module accuracy badge for page headers.
// Fetches /api/accuracy/modules once per org and caches in module-level memory.

type ModuleKey =
  | "discovery"
  | "leanVsm"
  | "futureState"
  | "riskCompliance"
  | "productTransformation"
  | "architecture"
  | "knowledgeBase";

interface Props {
  moduleKey: ModuleKey;
  label?: string; // override label if desired
}

// Simple in-memory cache keyed by orgId so we don't re-fetch on re-render
const cache: Record<string, { ts: number; modules: Record<string, { score: number; runs: number; successRate: number }> }> = {};
const TTL = 60_000; // 60s

function scoreColor(s: number) {
  return s >= 70 ? "text-green-400 border-green-500/40 bg-green-500/10"
    : s >= 45 ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
    : s > 0 ? "text-red-400 border-red-500/40 bg-red-500/10"
    : "text-white/25 border-white/10";
}

function scoreLabel(s: number) {
  return s >= 80 ? "Excellent" : s >= 65 ? "Good" : s >= 45 ? "Fair" : s > 0 ? "Needs Work" : "No Data";
}

export default function ModuleAccuracyBadge({ moduleKey }: Props) {
  const { currentOrg } = useOrganization();
  const [score, setScore] = useState<number | null>(null);
  const [runs, setRuns] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentOrg?.id) return;
    const orgId = currentOrg.id;
    const cached = cache[orgId];
    if (cached && Date.now() - cached.ts < TTL) {
      const m = cached.modules[moduleKey];
      if (m) { setScore(m.score); setRuns(m.runs); }
      return;
    }
    setLoading(true);
    fetch(`/api/accuracy/modules?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.modules) {
          cache[orgId] = { ts: Date.now(), modules: {} };
          for (const [k, v] of Object.entries(data.modules)) {
            if (v && typeof v === "object" && "score" in v) {
              cache[orgId].modules[k] = v as { score: number; runs: number; successRate: number };
            }
          }
          const m = cache[orgId].modules[moduleKey];
          if (m) { setScore(m.score); setRuns(m.runs); }
        }
      })
      .catch(() => {/* silent fail */})
      .finally(() => setLoading(false));
  }, [currentOrg?.id, moduleKey]);

  if (loading || score === null) return null;

  return (
    <Link
      href="/accuracy"
      title={`${scoreLabel(score)} · ${runs} agent run${runs !== 1 ? "s" : ""} · Click for full accuracy report`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-opacity hover:opacity-80 ${scoreColor(score)}`}
    >
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {score > 0 ? `${score}% accuracy` : "No data"}
    </Link>
  );
}
