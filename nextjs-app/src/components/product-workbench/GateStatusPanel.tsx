"use client";

interface GateStatusPanelProps {
  approved: boolean;
  blockers: string[];
  score: number;
  threshold: number;
}

export default function GateStatusPanel({
  approved,
  blockers,
  score,
  threshold,
}: GateStatusPanelProps) {
  const borderColor = approved ? "border-emerald-500/30" : "border-red-500/30";
  const percentage = Math.min((score / threshold) * 100, 100);

  return (
    <div
      className={`glass-panel-sm rounded-xl p-6 border ${borderColor} space-y-5`}
    >
      {/* Status icon + label */}
      <div className="flex flex-col items-center gap-3">
        {approved ? (
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}

        <p
          className={`text-lg font-bold ${
            approved ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {approved ? "Gate Approved" : "Gate Blocked"}
        </p>
      </div>

      {/* Score vs Threshold */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Score</span>
          <span>
            <span
              className={`font-bold text-sm ${
                approved ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {score.toFixed(1)}
            </span>
            <span className="text-white/30 mx-1">/</span>
            <span className="text-white/60">{threshold.toFixed(1)}</span>
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              approved ? "bg-emerald-500" : "bg-red-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="text-[10px] text-white/30 text-center">
          Threshold: {threshold.toFixed(1)}
        </p>
      </div>

      {/* Blockers */}
      {!approved && blockers.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
            Blockers
          </p>
          <ul className="space-y-2">
            {blockers.map((blocker, index) => (
              <li
                key={index}
                className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
              >
                <p className="text-xs text-red-300/80 leading-relaxed">
                  {blocker}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
