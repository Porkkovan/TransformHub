"use client";

import { useState, useEffect, useRef } from "react";
import GlassButton from "@/components/ui/GlassButton";
import { getArchitectureData } from "@/actions/getArchitectureData";

// ── Mermaid singleton ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mermaidInstance: any = null;
let mermaidReady: Promise<void> | null = null;
let renderQueue: Promise<void> = Promise.resolve();
let renderCounter = 0;

function ensureMermaidInit(): Promise<void> {
  if (mermaidReady) return mermaidReady;
  mermaidReady = (async () => {
    const m = (await import("mermaid")).default;
    m.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: "dark",
      themeVariables: {
        darkMode: true,
        background: "#0a0e12",
        primaryColor: "#3b82f6",
        primaryTextColor: "#e2e8f0",
        primaryBorderColor: "#3b82f6",
        lineColor: "#64748b",
        secondaryColor: "#1e293b",
        tertiaryColor: "#0f172a",
      },
      flowchart: { htmlLabels: true, curve: "basis" },
    });
    mermaidInstance = m;
  })();
  return mermaidReady;
}

function queueMermaidRender(
  id: string,
  source: string,
  cancelled: () => boolean
): Promise<string> {
  const job = renderQueue.then(async () => {
    if (cancelled()) throw new Error("cancelled");
    await ensureMermaidInit();
    if (cancelled()) throw new Error("cancelled");
    document
      .querySelectorAll('body > [id^="dmmd-"], body > [id^="mmd-"]')
      .forEach((el) => el.remove());
    const { svg } = await mermaidInstance.render(id, source.trim());
    document.getElementById(`d${id}`)?.remove();
    document.getElementById(id)?.remove();
    return svg;
  });
  renderQueue = job.catch(() => {});
  return job;
}

function InlineMermaid({ source }: { source: string }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!source) return;
    cancelledRef.current = false;
    setSvgContent(null);
    setError(null);
    const uniqueId = `mmd-r${++renderCounter}`;
    queueMermaidRender(uniqueId, source, () => cancelledRef.current)
      .then((svg) => { if (!cancelledRef.current) setSvgContent(svg); })
      .catch((err) => {
        if (!cancelledRef.current && err?.message !== "cancelled") {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => { cancelledRef.current = true; };
  }, [source]);

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <p className="text-red-400 text-xs font-medium mb-1">Diagram render error</p>
        <p className="text-red-400/70 text-xs">{error}</p>
        <details className="mt-2">
          <summary className="text-white/30 text-xs cursor-pointer">Show source</summary>
          <pre className="text-white/40 text-xs p-2 mt-1 overflow-x-auto whitespace-pre-wrap">{source}</pre>
        </details>
      </div>
    );
  }
  if (svgContent) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: svgContent }}
        className="w-full overflow-x-auto p-4 flex items-center justify-center min-h-[200px]"
      />
    );
  }
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-sm text-white/30 animate-pulse">Rendering diagram...</p>
    </div>
  );
}

// ── Fallback diagram generators (used when no product-specific diagram in DB) ──

/** Sanitize a string for use in a Mermaid label (ASCII only, no quotes). */
function mermaidLabel(s: string): string {
  return s.replace(/"/g, "'").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Generate a solution-architecture graph from capability names.
 * Layout: Personas → Capabilities (sequential LR chain).
 */
function generateFallbackSolution(
  productName: string,
  capabilities: Array<{ name: string }>
): string {
  const caps = capabilities.slice(0, 8); // cap at 8 for readability
  const lines = ["graph LR"];
  lines.push("  subgraph Personas");
  lines.push(`    P1[Business User]`);
  lines.push(`    P2[Operations Team]`);
  lines.push("  end");
  lines.push("  subgraph Capabilities");
  caps.forEach((c, i) => {
    lines.push(`    CAP${i}["${mermaidLabel(c.name)}"]`);
  });
  lines.push("  end");
  if (caps.length > 0) {
    lines.push(`  P1 --> CAP0`);
    for (let i = 0; i < caps.length - 1; i++) {
      lines.push(`  CAP${i} --> CAP${i + 1}`);
    }
    lines.push(`  CAP${caps.length - 1} --> P2`);
  }
  return lines.join("\n");
}

/**
 * Generate a sequence diagram from capability names.
 * Shows a linear user → cap1 → cap2 → ... → user flow.
 */
function generateFallbackSequence(
  capabilities: Array<{ name: string }>
): string {
  const caps = capabilities.slice(0, 6); // limit for readability
  const lines = ["sequenceDiagram"];
  lines.push("  participant U as User");
  caps.forEach((c, i) => {
    lines.push(`  participant S${i} as ${mermaidLabel(c.name).substring(0, 24)}`);
  });
  if (caps.length > 0) {
    lines.push(`  U->>S0: Initiate`);
    for (let i = 0; i < caps.length - 1; i++) {
      lines.push(`  S${i}->>S${i + 1}: Process`);
    }
    lines.push(`  S${caps.length - 1}-->>U: Complete`);
  }
  return lines.join("\n");
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface ProductDiagrams {
  solution: string;
  technical: string;
  sequence: string;
}

interface ArchitectureData {
  architecture_diagrams?: {
    functional?: string;
    technical?: string;
    solution?: string;
    products?: Record<string, ProductDiagrams>;
  };
  current_architecture?: string;
  target_architecture?: string;
  migration_plan?: string;
  [key: string]: unknown;
}

interface ArchitectureDiagramPanelProps {
  repositoryId?: string;
  organizationId?: string;
  mode?: "current" | "future";
  productName?: string;
  /** Capabilities to use for fallback diagram generation when no product-specific data exists. */
  capabilities?: Array<{ name: string; category?: string | null }>;
  onRunAgent?: () => void;
  agentLoading?: boolean;
}

function stringify(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  return JSON.stringify(val, null, 2);
}

interface SectionViewState {
  solution: "diagram" | "text";
  technical: "diagram" | "text";
  sequence: "diagram" | "text";
}

export default function ArchitectureDiagramPanel({
  repositoryId,
  organizationId,
  mode = "current",
  productName,
  capabilities = [],
  onRunAgent,
  agentLoading,
}: ArchitectureDiagramPanelProps) {
  const [architecture, setArchitecture] = useState<ArchitectureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewModes, setViewModes] = useState<SectionViewState>({
    solution: "diagram",
    technical: "diagram",
    sequence: "diagram",
  });

  const fetchIdRef = useRef(0);

  useEffect(() => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    setFetchError(null);
    getArchitectureData(repositoryId, organizationId)
      .then((data) => {
        if (currentFetchId !== fetchIdRef.current) return;
        setArchitecture(data as ArchitectureData | null);
        setLoading(false);
      })
      .catch((err) => {
        if (currentFetchId !== fetchIdRef.current) return;
        setFetchError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [repositoryId, organizationId]);

  const toggleView = (section: keyof SectionViewState) => {
    setViewModes((prev) => ({
      ...prev,
      [section]: prev[section] === "diagram" ? "text" : "diagram",
    }));
  };

  if (loading) {
    return (
      <div className="glass-panel-sm rounded-xl p-8 flex items-center justify-center">
        <p className="text-sm text-white/40 animate-pulse">Loading architecture data...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="glass-panel-sm rounded-xl p-8 flex flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">Error loading architecture: {fetchError}</p>
        {onRunAgent && (
          <GlassButton onClick={onRunAgent} disabled={agentLoading}>
            {agentLoading ? "Running..." : "Run Architecture Agent"}
          </GlassButton>
        )}
      </div>
    );
  }

  const diagrams = architecture?.architecture_diagrams;
  const productDiagrams = productName ? diagrams?.products?.[productName] : undefined;

  // Per-product diagrams (from DB). Fall back to auto-generated when absent.
  const hasCaps = capabilities.length > 0;
  const solutionSource =
    productDiagrams?.solution ??
    diagrams?.solution ??
    (hasCaps ? generateFallbackSolution(productName ?? "Product", capabilities) : undefined);
  const technicalSource = productDiagrams?.technical ?? diagrams?.technical;
  const sequenceSource =
    productDiagrams?.sequence ??
    (hasCaps ? generateFallbackSequence(capabilities) : undefined);

  // If there's no architecture data AND no capabilities to generate from, show empty state
  const hasAnyContent = !!(solutionSource || technicalSource || sequenceSource);
  if (!hasAnyContent) {
    return (
      <div className="glass-panel-sm rounded-xl p-8 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-white/40">No architecture analysis available</p>
        {onRunAgent && (
          <GlassButton onClick={onRunAgent} disabled={agentLoading}>
            {agentLoading ? "Running..." : "Run Architecture Agent"}
          </GlassButton>
        )}
      </div>
    );
  }

  // Text descriptions per mode
  const solutionText = mode === "future"
    ? stringify(architecture?.target_architecture)
    : stringify(architecture?.current_architecture);
  const technicalText = stringify(architecture?.target_architecture);
  const sequenceText = stringify(architecture?.migration_plan);

  const displayName = productName || "System";
  const safeProductKey = (productName || "system").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const sections = [
    {
      key: "solution" as const,
      number: 1,
      title: `Solution Architecture: ${displayName}`,
      description: mode === "future"
        ? `Target solution architecture showing personas, agentic workstreams, and integrations for ${displayName}.`
        : `Solution architecture showing personas, workstreams, and integrations for ${displayName}.`,
      source: solutionSource,
      text: solutionText,
    },
    {
      key: "technical" as const,
      number: 2,
      title: "Technical Architecture: Infrastructure & Platform",
      description: mode === "future"
        ? `Target technical architecture showing cloud infrastructure and platform services for ${displayName}.`
        : `Technical architecture showing infrastructure and platform services for ${displayName}.`,
      source: technicalSource,
      text: technicalText,
    },
    {
      key: "sequence" as const,
      number: 3,
      title: `Interaction Flow: ${displayName}`,
      description: mode === "future"
        ? `Target interaction sequence showing the end-to-end workflow for ${displayName}.`
        : `Interaction sequence showing the primary workflow for ${displayName}.`,
      source: sequenceSource,
      text: sequenceText,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Show mode header only for future state — current state is implied by the workbench context */}
      {mode === "future" && (
        <p className="text-xs text-white/40">
          Showing target state architecture for {displayName}
        </p>
      )}

      {sections.map((section) => {
        const currentView = viewModes[section.key];
        const hasDiagram = !!section.source;

        return (
          <div key={section.key} className="glass-panel-sm rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                <span className="text-blue-400 mr-2">{section.number}.</span>
                {section.title}
              </h3>
              {hasDiagram && (
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => toggleView(section.key)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      currentView === "text" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    Text
                  </button>
                  <button
                    onClick={() => toggleView(section.key)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      currentView === "diagram" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    Diagram
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[180px]">
              {currentView === "diagram" && section.source ? (
                <InlineMermaid
                  key={`${safeProductKey}-${section.key}`}
                  source={section.source}
                />
              ) : section.text ? (
                <pre className="text-sm text-white/70 whitespace-pre-wrap font-sans leading-relaxed">
                  {section.text}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-36 text-white/30">
                  <p>No {section.key} diagram available</p>
                </div>
              )}
            </div>

            <p className="text-xs text-white/40 border-t border-white/5 pt-3">
              {section.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
