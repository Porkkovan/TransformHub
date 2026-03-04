"use client";

import { useState } from "react";
import GlassButton from "@/components/ui/GlassButton";

interface FeedbackPanelProps {
  executionId: string;
  onSubmitted?: () => void;
  className?: string;
}

export default function FeedbackPanel({
  executionId,
  onSubmitted,
  className = "",
}: FeedbackPanelProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [corrections, setCorrections] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Parse corrections JSON if provided
      let parsedCorrections: Record<string, unknown> | null = null;
      if (corrections.trim()) {
        try {
          parsedCorrections = JSON.parse(corrections);
        } catch {
          // Treat non-JSON corrections as a single "general" correction
          parsedCorrections = { general: corrections.trim() };
        }
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executionId,
          rating,
          comment: comment.trim() || null,
          corrections: parsedCorrections,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`glass-panel p-6 ${className}`}>
        <div className="text-center py-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h4 className="text-white font-medium">Thank you!</h4>
          <p className="text-white/40 text-sm mt-1">
            Your feedback helps improve agent outputs.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setRating(0);
              setComment("");
              setCorrections("");
            }}
            className="text-cyan-400 text-sm mt-3 hover:underline"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-panel p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Rate Output</h3>

      {/* Star Rating */}
      <div className="mb-5">
        <label className="block text-sm text-white/50 mb-2">
          How accurate was this output?
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
            >
              <svg
                className={`w-8 h-8 transition-colors ${
                  star <= (hoveredStar || rating)
                    ? "text-amber-400"
                    : "text-white/15"
                }`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
          <span className="ml-3 text-sm text-white/40 self-center">
            {rating > 0 &&
              ["", "Poor", "Below Average", "Average", "Good", "Excellent"][
                rating
              ]}
          </span>
        </div>
      </div>

      {/* Comment */}
      <div className="mb-4">
        <label className="block text-sm text-white/50 mb-2">
          Comment (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Any additional context about the quality..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
        />
      </div>

      {/* Corrections */}
      <div className="mb-5">
        <label className="block text-sm text-white/50 mb-2">
          Corrections (optional)
        </label>
        <textarea
          value={corrections}
          onChange={(e) => setCorrections(e.target.value)}
          placeholder={'Describe what should be different, e.g.:\n"Risk level should be HIGH, not MEDIUM"\nor JSON: {"risk_level": "HIGH"}'}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none font-mono"
        />
        <p className="text-xs text-white/30 mt-1">
          Plain text or JSON format. Corrections help the agent learn.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          {error}
        </div>
      )}

      <GlassButton
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full"
      >
        {submitting ? "Submitting..." : "Submit Feedback"}
      </GlassButton>

      <p className="text-xs text-white/20 text-center mt-3">
        Execution: {executionId.slice(0, 12)}...
      </p>
    </div>
  );
}
