// Best-effort extraction of a duration from a recipe instruction step, e.g.
// "Simmer for 10 minutes" -> 600, "Bake 25-30 min" -> 1500 (first number),
// "Let rest 1 hour" -> 3600. Deterministic regex, no LLM — good enough for
// offering a timer, not a substitute for reading the step.

const DURATION_PATTERN = /(\d+)\s*(?:-|to)?\s*(?:\d+)?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i;

export function extractStepDurationSeconds(stepText: string): number | null {
  const match = stepText.match(DURATION_PATTERN);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2].toLowerCase();
  if (unit.startsWith('hour') || unit.startsWith('hr')) return value * 3600;
  if (unit.startsWith('min')) return value * 60;
  if (unit.startsWith('sec')) return value;
  return null;
}
