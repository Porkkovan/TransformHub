"use client";

interface StreamEvent {
  type: string;
  node?: string;
  status?: string;
  timestamp?: string;
}

interface StreamingOutputProps {
  events: StreamEvent[];
  currentNode: string | null;
  status: string;
}

export default function StreamingOutput({ events, currentNode, status }: StreamingOutputProps) {
  const nodeEvents = events.filter((e) => e.type === "node_start" || e.type === "node_end");

  return (
    <div className="glass-panel-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white/70">Execution Progress</h4>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            status === "RUNNING"
              ? "bg-blue-500/20 text-blue-400"
              : status === "COMPLETED"
              ? "bg-green-500/20 text-green-400"
              : status === "FAILED"
              ? "bg-red-500/20 text-red-400"
              : "bg-white/10 text-white/50"
          }`}
        >
          {status}
        </span>
      </div>

      {currentNode && (
        <div className="flex items-center gap-2 text-sm text-blue-400">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Processing: {currentNode}
        </div>
      )}

      <div className="space-y-1">
        {nodeEvents.map((event, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs ${
              event.type === "node_end" ? "text-green-400/70" : "text-white/40"
            }`}
          >
            <span>{event.type === "node_end" ? "\u2713" : "\u25B6"}</span>
            <span>{event.node}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
