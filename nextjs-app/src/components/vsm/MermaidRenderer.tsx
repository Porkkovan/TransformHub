"use client";

import { useEffect, useRef, useId, useState } from "react";

// Module-level singleton: initialize mermaid exactly once
let mermaidInstance: typeof import("mermaid").default | null = null;

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance;
  const mod = await import("mermaid");
  mermaidInstance = mod.default;
  mermaidInstance.initialize({
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
    flowchart: {
      htmlLabels: true,
      curve: "basis",
    },
  });
  return mermaidInstance;
}

/**
 * Remove orphaned temp elements mermaid leaves in document.body on failure.
 * Mermaid creates <div id="d{id}"> containers and <svg id="{id}"> during render.
 */
function cleanupMermaidOrphans(id: string) {
  if (typeof document === "undefined") return;
  // Remove the temp container mermaid creates
  document.getElementById(`d${id}`)?.remove();
  // Remove any orphaned SVG with this ID
  document.getElementById(id)?.remove();
}

/** Remove ALL orphaned mermaid temp containers from body */
function cleanupAllMermaidOrphans() {
  if (typeof document === "undefined") return;
  document.querySelectorAll('body > [id^="dmermaid-"], body > [id^="darch-"], body > [id^="dfuture-mermaid"]').forEach((el) => el.remove());
}

/** Normalize source: trim whitespace, fix line endings, remove BOM */
function sanitizeSource(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")       // strip BOM
    .replace(/\r\n/g, "\n")       // normalize CRLF → LF
    .replace(/\r/g, "\n")         // normalize CR → LF
    .trim();
}

interface MermaidRendererProps {
  source: string;
  id?: string;
  theme?: "dark" | "default" | "forest" | "neutral";
  onRenderResult?: (success: boolean) => void;
}

export default function MermaidRenderer({ source, id, theme, onRenderResult }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderCount = useRef(0);
  const reactId = useId();
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  // Sanitize ID: mermaid requires IDs starting with a letter, no colons
  const baseId = id || `mermaid-${reactId.replace(/:/g, "")}`;

  const cleanSource = sanitizeSource(source || "");

  useEffect(() => {
    if (!cleanSource || !containerRef.current) return;

    let cancelled = false;
    const currentRender = renderCount.current++;
    const uniqueId = `${baseId}-r${currentRender}`;

    async function renderDiagram() {
      try {
        const mermaid = await getMermaid();
        if (cancelled || !containerRef.current) return;

        // Clear previous SVG from our container
        containerRef.current.innerHTML = "";
        setError(null);
        setRendered(false);

        // Clean up any leftover temp elements from previous renders
        cleanupAllMermaidOrphans();

        // Validate syntax before rendering (avoids corrupting mermaid state)
        try {
          await mermaid.parse(cleanSource);
        } catch (parseErr) {
          if (!cancelled) {
            const msg = parseErr instanceof Error ? parseErr.message : "Invalid diagram syntax";
            setError(msg);
            onRenderResult?.(false);
          }
          return;
        }

        if (cancelled || !containerRef.current) return;

        // Render the diagram
        const { svg } = await mermaid.render(uniqueId, cleanSource);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
          onRenderResult?.(true);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to render diagram";
          setError(message);
          onRenderResult?.(false);
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
          }
        }
      } finally {
        // Always clean up temp elements mermaid may have left behind
        cleanupMermaidOrphans(uniqueId);
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
      cleanupMermaidOrphans(uniqueId);
    };
  }, [cleanSource, baseId]);

  return (
    <div className="w-full overflow-x-auto">
      <div
        ref={containerRef}
        className={`w-full p-4 flex items-center justify-center ${rendered ? "min-h-[200px]" : ""}`}
      />
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-xs font-medium mb-1">Diagram render error</p>
          <p className="text-red-400/70 text-xs">{error}</p>
          <details className="mt-2" open>
            <summary className="text-white/30 text-xs cursor-pointer hover:text-white/50">
              Show source
            </summary>
            <pre className="text-white/40 text-xs p-2 mt-1 overflow-x-auto whitespace-pre-wrap">
              {cleanSource}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
