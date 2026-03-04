"use client";

interface NodeStatus {
  name: string;
  status: "pending" | "running" | "completed";
}

interface AgentProgressProps {
  nodes: NodeStatus[];
  agentType: string;
}

export default function AgentProgress({ nodes, agentType }: AgentProgressProps) {
  return (
    <div className="glass-panel-sm p-4">
      <h4 className="text-sm font-medium text-white/70 mb-3">
        {agentType.replace(/_/g, " ")} Pipeline
      </h4>
      <div className="flex items-center gap-2">
        {nodes.map((node, i) => (
          <div key={`${i}-${node.name}`} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  node.status === "completed"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : node.status === "running"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                    : "bg-white/5 text-white/30 border border-white/10"
                }`}
              >
                {node.status === "completed" ? "\u2713" : i + 1}
              </div>
              <span className="text-[10px] text-white/40 mt-1 max-w-[60px] truncate text-center">
                {node.name}
              </span>
            </div>
            {i < nodes.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  node.status === "completed" ? "bg-green-500/30" : "bg-white/10"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
