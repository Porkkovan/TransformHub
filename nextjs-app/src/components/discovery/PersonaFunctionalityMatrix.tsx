"use client";

import { useMemo, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Persona {
  type: string;
  name: string;
  responsibilities: string[];
}

interface FunctionalityMapping {
  id: string;
  name: string;
  personaMappings: { personaType: string; personaName: string }[];
}

interface PersonaFunctionalityMatrixProps {
  personas: Persona[];
  functionalities: FunctionalityMapping[];
  onAutoMap?: () => Promise<{ mapped: number; total: number } | null>;
}

// ─── Persona color palette ──────────────────────────────────────────────────

const PERSONA_COLORS = [
  { dot: "bg-blue-400", ring: "ring-blue-400/30" },
  { dot: "bg-purple-400", ring: "ring-purple-400/30" },
  { dot: "bg-cyan-400", ring: "ring-cyan-400/30" },
  { dot: "bg-green-400", ring: "ring-green-400/30" },
  { dot: "bg-amber-400", ring: "ring-amber-400/30" },
  { dot: "bg-rose-400", ring: "ring-rose-400/30" },
  { dot: "bg-teal-400", ring: "ring-teal-400/30" },
  { dot: "bg-indigo-400", ring: "ring-indigo-400/30" },
];

function getPersonaColor(index: number) {
  return PERSONA_COLORS[index % PERSONA_COLORS.length];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PersonaFunctionalityMatrix({
  personas,
  functionalities,
  onAutoMap,
}: PersonaFunctionalityMatrixProps) {
  const [inferring, setInferring] = useState(false);
  const [inferResult, setInferResult] = useState<{ mapped: number; total: number } | null>(null);

  async function handleAutoMap() {
    if (!onAutoMap) return;
    setInferring(true);
    setInferResult(null);
    try {
      const result = await onAutoMap();
      setInferResult(result);
    } finally {
      setInferring(false);
    }
  }
  // Build a fast lookup: functionalityId -> Set of personaType
  const mappingLookup = useMemo(() => {
    const lookup = new Map<string, Set<string>>();
    for (const func of functionalities) {
      const types = new Set(func.personaMappings.map((pm) => pm.personaType));
      lookup.set(func.id, types);
    }
    return lookup;
  }, [functionalities]);

  // Compute coverage stats
  const totalCells = personas.length * functionalities.length;
  const mappedCells = useMemo(() => {
    let count = 0;
    for (const func of functionalities) {
      for (const persona of personas) {
        if (mappingLookup.get(func.id)?.has(persona.type)) {
          count++;
        }
      }
    }
    return count;
  }, [functionalities, personas, mappingLookup]);

  const coveragePercent = totalCells > 0 ? Math.round((mappedCells / totalCells) * 100) : 0;

  if (personas.length === 0 || functionalities.length === 0) {
    return (
      <div className="glass-panel-sm p-8 text-center">
        <p className="text-sm text-white/40">
          {personas.length === 0
            ? "No personas available."
            : "No functionalities available."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-sm text-white/50">
          <span><strong className="text-white/80">{personas.length}</strong> personas</span>
          <span className="text-white/20">|</span>
          <span><strong className="text-white/80">{functionalities.length}</strong> functionalities</span>
          <span className="text-white/20">|</span>
          <span title={`${mappedCells} of ${totalCells} persona-functionality pairs have an assigned mapping`}>
            <strong className="text-white/80">{coveragePercent}%</strong>
            <span className="ml-1 text-white/30">coverage</span>
            <span className="ml-1 text-white/20 text-xs">({mappedCells}/{totalCells} pairs mapped)</span>
          </span>
        </div>
        <div className="flex-1" />
        {onAutoMap && (
          <div className="flex items-center gap-3">
            {inferResult && (
              <span className="text-xs text-green-400/80">
                ✓ {inferResult.mapped} assignments inferred across {inferResult.total} functionalities
              </span>
            )}
            <button
              onClick={handleAutoMap}
              disabled={inferring}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/25 hover:bg-purple-500/25 disabled:opacity-50 transition-all"
            >
              {inferring ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Inferring with AI…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Auto-Map with AI
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Matrix table ─────────────────────────────────────────────────── */}
      <div className="glass-panel-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* ── Header row ───────────────────────────────────────────── */}
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300 sticky left-0 bg-white/5 z-10 min-w-[180px]">
                  Functionality
                </th>
                {personas.map((persona, pIdx) => {
                  const color = getPersonaColor(pIdx);
                  return (
                    <th
                      key={persona.type}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-300 min-w-[100px]"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${color.dot}`}
                        />
                        <span className="leading-tight">{persona.name}</span>
                        <span className="font-normal text-white/30">
                          {persona.type}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* ── Body rows ────────────────────────────────────────────── */}
            <tbody>
              {functionalities.map((func, fIdx) => {
                const personaTypes = mappingLookup.get(func.id);
                const mappedCount = personas.filter((p) =>
                  personaTypes?.has(p.type)
                ).length;

                return (
                  <tr
                    key={func.id}
                    className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                      fIdx % 2 === 0 ? "" : "bg-white/[0.02]"
                    }`}
                  >
                    {/* Functionality name (sticky left) */}
                    <td className="px-4 py-3 text-sm text-slate-200 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{func.name}</span>
                        <span className="shrink-0 text-xs text-white/25">
                          ({mappedCount}/{personas.length})
                        </span>
                      </div>
                    </td>

                    {/* Mapping cells */}
                    {personas.map((persona, pIdx) => {
                      const isMapped = personaTypes?.has(persona.type) ?? false;
                      const color = getPersonaColor(pIdx);

                      return (
                        <td
                          key={persona.type}
                          className="px-3 py-3 text-center"
                        >
                          {isMapped ? (
                            <span
                              className={`inline-block w-3 h-3 rounded-full ${color.dot} ring-2 ${color.ring}`}
                              title={`${persona.name} is mapped to ${func.name}`}
                            />
                          ) : (
                            <span
                              className="inline-block w-3 h-3 rounded-full bg-white/5"
                              title={`${persona.name} is not mapped to ${func.name}`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 ring-2 ring-blue-400/30" />
          <span>Mapped</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/5" />
          <span>Not mapped</span>
        </div>
      </div>
    </div>
  );
}
