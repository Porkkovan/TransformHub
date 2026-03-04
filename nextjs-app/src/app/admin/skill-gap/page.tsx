"use client";

import GlassCard from "@/components/ui/GlassCard";
import GlassButton from "@/components/ui/GlassButton";
import GlassBadge from "@/components/ui/GlassBadge";
import { useAgentResults } from "@/hooks/useAgentResults";
import { useOrganization } from "@/contexts/OrganizationContext";

interface SkillGap {
  skill: string;
  current_level: number;
  required_level: number;
  gap_size: number;
  impact: string;
  urgency: string;
}

interface TrainingPath {
  title: string;
  skill: string;
  duration: string;
  cost: string;
  delivery_method: string;
}

interface HiringRecommendation {
  role: string;
  skills: string[];
  seniority: string;
  priority: string;
}

interface SkillGapOutput {
  current_skills: Record<string, unknown>[];
  future_requirements: Record<string, unknown>[];
  skill_gaps: SkillGap[];
  training_paths: TrainingPath[];
  hiring_recommendations: HiringRecommendation[];
  readiness_score?: number;
}

export default function SkillGapPage() {
  const { currentOrg } = useOrganization();
  const { results, execution, running, runAgent } = useAgentResults("skill_gap");
  const data = results as unknown as SkillGapOutput | null;

  const handleRun = () => runAgent(currentOrg?.id);

  const gaps = data?.skill_gaps ?? [];
  const trainingPaths = data?.training_paths ?? [];
  const hiring = data?.hiring_recommendations ?? [];
  const readiness = data?.readiness_score;
  const criticalGaps = gaps.filter((g) => g.impact?.toLowerCase() === "critical" || g.urgency?.toLowerCase() === "critical").length;

  const impactVariant = (v: string) => {
    switch (v?.toLowerCase()) {
      case "critical": return "danger" as const;
      case "high": return "danger" as const;
      case "medium": return "warning" as const;
      case "low": return "info" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Skill Gap Analysis</h1>
          <p className="text-white/50 mt-1">
            Team skills assessment, gap identification, and training recommendations
            {currentOrg ? ` for ${currentOrg.name}` : ""}
          </p>
        </div>
        <GlassButton onClick={handleRun} disabled={running}>
          {running ? "Analyzing..." : "Run Skill Gap Agent"}
        </GlassButton>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <p className="text-xs text-white/40 uppercase">Readiness Score</p>
          <p className={`text-3xl font-bold mt-1 ${
            readiness != null && readiness >= 80 ? "text-green-400" :
            readiness != null && readiness >= 60 ? "text-amber-400" :
            readiness != null ? "text-red-400" : "text-white/40"
          }`}>{readiness != null ? `${readiness}%` : "N/A"}</p>
          <p className="text-xs text-white/30 mt-1">Team readiness</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-red-500">
          <p className="text-xs text-white/40 uppercase">Critical Gaps</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{criticalGaps}</p>
          <p className="text-xs text-white/30 mt-1">Urgent skill gaps</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-green-500">
          <p className="text-xs text-white/40 uppercase">Training Paths</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{trainingPaths.length}</p>
          <p className="text-xs text-white/30 mt-1">Available programs</p>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <p className="text-xs text-white/40 uppercase">Roles to Hire</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{hiring.length}</p>
          <p className="text-xs text-white/30 mt-1">Recommended hires</p>
        </div>
      </div>

      {execution && execution.status !== "COMPLETED" && execution.status !== "FAILED" && (
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-white/80 text-sm">Agent is {execution.status.toLowerCase()}...</p>
          </div>
        </GlassCard>
      )}

      {/* Skill Gaps Table */}
      <GlassCard title="Skill Gaps">
        {gaps.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-4 px-3 py-2 text-xs text-white/40 uppercase border-b border-white/10">
              <span>Skill</span>
              <span className="text-right">Current</span>
              <span className="text-right">Required</span>
              <span className="text-right">Gap</span>
              <span>Impact</span>
              <span>Urgency</span>
            </div>
            {gaps.map((g, i) => (
              <div key={i} className="glass-panel-sm p-3 grid grid-cols-6 gap-4 items-center">
                <span className="text-sm text-white/80">{g.skill}</span>
                <span className="text-sm text-white/60 text-right">{g.current_level}</span>
                <span className="text-sm text-white/60 text-right">{g.required_level}</span>
                <span className="text-sm font-bold text-red-400 text-right">{g.gap_size}</span>
                <GlassBadge variant={impactVariant(g.impact)}>{g.impact}</GlassBadge>
                <GlassBadge variant={impactVariant(g.urgency)}>{g.urgency}</GlassBadge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No skill gaps identified yet. Run the agent to assess team capabilities.</p>
        )}
      </GlassCard>

      {/* Training Paths */}
      {trainingPaths.length > 0 && (
        <GlassCard title="Training Paths">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trainingPaths.map((tp, i) => (
              <div key={i} className="glass-panel-sm p-4">
                <h4 className="text-sm font-semibold text-white/80 mb-2">{tp.title}</h4>
                <div className="space-y-1 text-xs text-white/50">
                  <p><span className="text-white/40">Skill:</span> {tp.skill}</p>
                  <p><span className="text-white/40">Duration:</span> {tp.duration}</p>
                  <p><span className="text-white/40">Cost:</span> {tp.cost}</p>
                  <p><span className="text-white/40">Delivery:</span> {tp.delivery_method}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Hiring Recommendations */}
      {hiring.length > 0 && (
        <GlassCard title="Hiring Recommendations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hiring.map((h, i) => (
              <div key={i} className="glass-panel-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white/80">{h.role}</h4>
                  <GlassBadge variant={impactVariant(h.priority)}>{h.priority}</GlassBadge>
                </div>
                <p className="text-xs text-white/40 mb-2">Seniority: {h.seniority}</p>
                <div className="flex flex-wrap gap-1">
                  {h.skills?.map((s, j) => (
                    <GlassBadge key={j} variant="info">{s}</GlassBadge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
