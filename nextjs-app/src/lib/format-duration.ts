/**
 * Format a duration (in hours) as a human-readable string.
 * Examples: 0 → "0h", 0.5 → "30m", 1.5 → "1.5h", 24 → "24h", 36.5 → "36.5h"
 */
export function formatDuration(hours: number): string {
  if (!hours || hours <= 0) return "0h";
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  // Show one decimal only when needed
  return `${parseFloat(hours.toFixed(1))}h`;
}

/**
 * Format a duration for metric cards — same as formatDuration but without trailing "h"
 * (the caller appends its own suffix).
 */
export function formatDurationValue(hours: number): string {
  if (!hours || hours <= 0) return "0";
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  return `${parseFloat(hours.toFixed(1))}`;
}
