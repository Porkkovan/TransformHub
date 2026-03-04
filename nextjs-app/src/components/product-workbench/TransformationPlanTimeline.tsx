"use client";

interface MigrationStep {
  phase: string;
  description: string;
  status: "completed" | "in-progress" | "pending";
  estimatedDuration?: string;
}

interface TransformationPlanTimelineProps {
  steps: MigrationStep[];
  productName: string;
}

const STATUS_CONFIG = {
  completed: {
    circle: "bg-emerald-500 border-emerald-400",
    line: "border-emerald-500/40",
    label: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  "in-progress": {
    circle: "bg-blue-500 border-blue-400 animate-pulse",
    line: "border-blue-500/40",
    label: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3" />
      </svg>
    ),
  },
  pending: {
    circle: "bg-white/10 border-white/20",
    line: "border-white/10",
    label: "text-white/40",
    badge: "bg-white/5 text-white/40 border-white/10",
    icon: (
      <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" strokeWidth={2} />
      </svg>
    ),
  },
} as const;

export default function TransformationPlanTimeline({
  steps,
  productName,
}: TransformationPlanTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="glass-panel-sm rounded-xl p-8 flex items-center justify-center">
        <p className="text-sm text-white/40">
          No migration steps defined for {productName}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel-sm rounded-xl p-6 border border-white/5 space-y-4">
      <h3 className="text-sm font-semibold text-white/90">
        {productName} — Transformation Plan
      </h3>

      <div className="relative">
        {steps.map((step, index) => {
          const config = STATUS_CONFIG[step.status] ?? STATUS_CONFIG.pending;
          const isLast = index === steps.length - 1;

          return (
            <div key={`${step.phase}-${index}`} className="relative flex gap-4">
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                {/* Circle indicator */}
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${config.circle}`}
                >
                  {config.icon}
                </div>
                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={`w-0 flex-1 border-l-2 ${config.line}`}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`pb-8 ${isLast ? "pb-0" : ""}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-semibold ${config.label}`}>
                    {step.phase}
                  </p>
                  {step.estimatedDuration && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${config.badge}`}
                    >
                      {step.estimatedDuration}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
