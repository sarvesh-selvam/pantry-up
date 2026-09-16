// Deterministic multi-signal recommendation ranking — Phase 8. This is
// pure arithmetic over real data (pantry matching, rescue urgency,
// explicit + behavioral cuisine preference, stated time limit, equipment
// owned, recent cook history), never an LLM judgment call — the whole
// point is that ranking stays inspectable ("why did this rank where it
// did" always has a concrete numeric answer) rather than opaque.
//
// This module assumes dietary restrictions/allergies have ALREADY been
// enforced as a hard pre-filter (recipeGeneration.ts's generateRecipes
// discards non-compliant candidates before anything reaches here) — it
// never re-decides compliance, only ranks recipes that already passed
// that filter. Callers (recipePayload.ts) additionally re-run
// findDietaryViolations defensively right before this module runs, as a
// belt-and-suspenders check that the invariant actually held — see that
// file's header comment.
//
// Formula: a weighted sum of nine terms, each computed to [0, 1] (penalty
// terms too, as positive magnitudes subtracted at the end) — reflecting
// the product spec's stated priority order (rescue/pantry/time outrank
// cuisine/nutrition/equipment/variety):
//
//   score = 3·pantry_coverage + 3·expiry_rescue_score + 1.5·preference_match
//         + 2·time_match + 1·macro_match + 1·equipment_match
//         + 0.5·novelty_score - 3·missing_ingredient_penalty
//         - 0.5·recent_meal_repetition_penalty
//
// macro_match is honestly neutral (0.5) this phase — there's no stated
// macro/nutrition goal anywhere in user_preferences to compare a recipe
// against yet (Phase 6 deliberately didn't fabricate one), so scoring it
// as anything other than neutral would be inventing a preference nobody
// stated. Documented here rather than silently dropped so the formula's
// full shape (matching the product spec) stays visible even where one
// term can't yet be real.

import type { RescueRowEntry } from './rescueRow.ts';
import type { RecentCookEvent } from './pantryContext.ts';

const WEIGHTS = {
  pantry_coverage: 3,
  expiry_rescue_score: 3,
  preference_match: 1.5,
  time_match: 2,
  macro_match: 1,
  equipment_match: 1,
  novelty_score: 0.5,
  missing_ingredient_penalty: 3,
  recent_meal_repetition_penalty: 0.5,
} as const;

const EXPIRING_WITHIN_DAYS = 3;
const REPETITION_FULL_PENALTY_DAYS = 3;
const REPETITION_HALF_PENALTY_DAYS = 7;
const NOVELTY_FULL_CREDIT_DAYS = 14;
/** How much recent cook frequency for a cuisine can move preference_match
 * away from the explicit weight — a nudge, not an override (product spec
 * section 2's explicit instruction: behavioral signal adjusts the score,
 * never rewrites the stored weight). */
const MAX_BEHAVIORAL_PREFERENCE_NUDGE = 0.15;

export interface ScoringRecipe {
  cuisine: string | null;
  prep_time: number | null;
  cook_time: number | null;
  rescued_ingredient_names: string[];
  equipment_needed: string[];
}

export interface ScoringMatch {
  haveCount: number;
  totalCount: number;
  missingIngredientCount: number;
}

export interface ScoringContext {
  cuisineWeights: Record<string, number>;
  equipment: string[];
  maxTimeMinutes: number | null;
  rescueEntries: RescueRowEntry[];
  recentCookEvents: RecentCookEvent[];
}

export interface RecipeScoreBreakdown {
  pantry_coverage: number;
  expiry_rescue_score: number;
  preference_match: number;
  time_match: number;
  macro_match: number;
  equipment_match: number;
  novelty_score: number;
  missing_ingredient_penalty: number;
  recent_meal_repetition_penalty: number;
}

export interface RecipeScoreResult {
  score: number;
  breakdown: RecipeScoreBreakdown;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function daysSince(dateString: string): number {
  return (Date.now() - new Date(dateString).getTime()) / (24 * 60 * 60 * 1000);
}

function computePantryCoverage(match: ScoringMatch): number {
  return match.totalCount > 0 ? match.haveCount / match.totalCount : 0;
}

function computeMissingIngredientPenalty(match: ScoringMatch): number {
  return match.totalCount > 0 ? match.missingIngredientCount / match.totalCount : 0;
}

/** Urgency-weighted average over the rescue items this specific recipe
 * actually uses (matched by display name) — an expiring-today item pulls
 * this toward 1 much harder than a barely-expiring one, rather than
 * treating every rescued ingredient as equally urgent. 0 when the recipe
 * doesn't use any rescue items. */
function computeExpiryRescueScore(recipe: ScoringRecipe, rescueEntries: RescueRowEntry[]): number {
  if (recipe.rescued_ingredient_names.length === 0) return 0;

  const usedNames = new Set(recipe.rescued_ingredient_names.map((n) => n.toLowerCase()));
  const matchedEntries = rescueEntries.filter((entry) => usedNames.has(entry.item.display_name.toLowerCase()));
  if (matchedEntries.length === 0) return 0;

  const urgencies = matchedEntries.map((entry) => {
    if (entry.reason === 'expiring') return clamp01(1 - entry.sortKey / EXPIRING_WITHIN_DAYS);
    if (entry.reason === 'leftover') return 0.6;
    return 0.4; // low_quantity
  });
  return urgencies.reduce((sum, u) => sum + u, 0) / urgencies.length;
}

/** Explicit cuisine_weights entry (0.5 neutral default when the cuisine
 * has no stated preference at all — an unrated cuisine shouldn't score
 * like an actively-disliked one), nudged by recent cook frequency for
 * that cuisine relative to overall cook frequency. Never writes back to
 * cuisine_weights — this only affects the returned number. */
function computePreferenceMatch(recipe: ScoringRecipe, ctx: ScoringContext): number {
  if (!recipe.cuisine) return 0.5;

  const explicit = ctx.cuisineWeights[recipe.cuisine] ?? ctx.cuisineWeights[recipe.cuisine.toLowerCase()] ?? 0.5;

  if (ctx.recentCookEvents.length === 0) return clamp01(explicit);

  const cuisineCount = ctx.recentCookEvents.filter(
    (e) => e.cuisine?.toLowerCase() === recipe.cuisine?.toLowerCase()
  ).length;
  const cuisineShare = cuisineCount / ctx.recentCookEvents.length;
  // A cuisine cooked more than its "fair share" (relative to how many
  // distinct cuisines appear) nudges up; never a bigger swing than
  // MAX_BEHAVIORAL_PREFERENCE_NUDGE in either direction.
  const distinctCuisines = new Set(ctx.recentCookEvents.map((e) => e.cuisine).filter(Boolean)).size || 1;
  const fairShare = 1 / distinctCuisines;
  const nudge = clamp01(cuisineShare / Math.max(fairShare, 0.01)) - 1; // negative..positive
  const boundedNudge = Math.max(-MAX_BEHAVIORAL_PREFERENCE_NUDGE, Math.min(MAX_BEHAVIORAL_PREFERENCE_NUDGE, nudge * MAX_BEHAVIORAL_PREFERENCE_NUDGE));

  return clamp01(explicit + boundedNudge);
}

/** Neutral (0.5) when nothing was asked — Home's automatic suggestions
 * never state a time limit, and it would be wrong to reward/penalize a
 * recipe against a constraint nobody actually set. */
function computeTimeMatch(recipe: ScoringRecipe, maxTimeMinutes: number | null): number {
  if (maxTimeMinutes == null) return 0.5;
  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);
  if (totalTime === 0) return 0.5; // unknown time — can't honestly say either way
  if (totalTime <= maxTimeMinutes) return 1;
  return clamp01(1 - (totalTime - maxTimeMinutes) / maxTimeMinutes);
}

/** 1.0 when the recipe needs no equipment the user doesn't already have
 * (including "no equipment requirements known at all," which is the
 * honest default for a recipe that was never asked, not a penalty for
 * missing information). */
function computeEquipmentMatch(recipe: ScoringRecipe, ownedEquipment: string[]): number {
  if (recipe.equipment_needed.length === 0) return 1;
  const owned = new Set(ownedEquipment);
  const haveCount = recipe.equipment_needed.filter((e) => owned.has(e)).length;
  return haveCount / recipe.equipment_needed.length;
}

function mostRecentDaysForCuisine(recipe: ScoringRecipe, recentCookEvents: RecentCookEvent[]): number | null {
  if (!recipe.cuisine) return null;
  const matches = recentCookEvents.filter((e) => e.cuisine?.toLowerCase() === recipe.cuisine?.toLowerCase());
  if (matches.length === 0) return null;
  return Math.min(...matches.map((e) => daysSince(e.cookedAt)));
}

/** 1.0 for a cuisine never cooked in the lookback window (genuinely
 * novel), decaying toward 0 the more recently it was cooked. */
function computeNoveltyScore(recipe: ScoringRecipe, ctx: ScoringContext): number {
  const mostRecentDays = mostRecentDaysForCuisine(recipe, ctx.recentCookEvents);
  if (mostRecentDays == null) return 1;
  return clamp01(mostRecentDays / NOVELTY_FULL_CREDIT_DAYS);
}

/** A nudge, not a hard exclusion, per product spec section 6 — full
 * penalty only within a few days, tapering to none by
 * REPETITION_HALF_PENALTY_DAYS. */
function computeRepetitionPenalty(recipe: ScoringRecipe, ctx: ScoringContext): number {
  const mostRecentDays = mostRecentDaysForCuisine(recipe, ctx.recentCookEvents);
  if (mostRecentDays == null) return 0;
  if (mostRecentDays <= REPETITION_FULL_PENALTY_DAYS) return 1;
  if (mostRecentDays <= REPETITION_HALF_PENALTY_DAYS) return 0.5;
  return 0;
}

export function computeRecipeScore(
  recipe: ScoringRecipe,
  match: ScoringMatch,
  ctx: ScoringContext
): RecipeScoreResult {
  const breakdown: RecipeScoreBreakdown = {
    pantry_coverage: computePantryCoverage(match),
    expiry_rescue_score: computeExpiryRescueScore(recipe, ctx.rescueEntries),
    preference_match: computePreferenceMatch(recipe, ctx),
    time_match: computeTimeMatch(recipe, ctx.maxTimeMinutes),
    macro_match: 0.5,
    equipment_match: computeEquipmentMatch(recipe, ctx.equipment),
    novelty_score: computeNoveltyScore(recipe, ctx),
    missing_ingredient_penalty: computeMissingIngredientPenalty(match),
    recent_meal_repetition_penalty: computeRepetitionPenalty(recipe, ctx),
  };

  const score =
    WEIGHTS.pantry_coverage * breakdown.pantry_coverage +
    WEIGHTS.expiry_rescue_score * breakdown.expiry_rescue_score +
    WEIGHTS.preference_match * breakdown.preference_match +
    WEIGHTS.time_match * breakdown.time_match +
    WEIGHTS.macro_match * breakdown.macro_match +
    WEIGHTS.equipment_match * breakdown.equipment_match +
    WEIGHTS.novelty_score * breakdown.novelty_score -
    WEIGHTS.missing_ingredient_penalty * breakdown.missing_ingredient_penalty -
    WEIGHTS.recent_meal_repetition_penalty * breakdown.recent_meal_repetition_penalty;

  return { score, breakdown };
}

/**
 * Deterministic "why this works" bullets generated straight from the
 * breakdown's real numbers — never LLM narration. Ordered to match the
 * product spec's priority order (rescue > coverage > time > preference >
 * novelty > equipment), capped at 4 so the card doesn't turn into a wall
 * of text. Falls back to a single generic line only if literally nothing
 * scored notably — still true, just not interesting enough to bullet.
 */
export function buildWhyBullets(
  recipe: ScoringRecipe & { rescued_ingredient_names: string[] },
  match: ScoringMatch,
  breakdown: RecipeScoreBreakdown,
  ctx: ScoringContext
): string[] {
  const bullets: string[] = [];

  if (breakdown.expiry_rescue_score > 0 && recipe.rescued_ingredient_names.length > 0) {
    const names = recipe.rescued_ingredient_names.slice(0, 3).join(', ');
    bullets.push(
      breakdown.expiry_rescue_score >= 0.7
        ? `Uses ${names}, which need to be used soon`
        : `Uses some ingredients that need using soon: ${names}`
    );
  }

  if (match.totalCount > 0) {
    bullets.push(`You have ${match.haveCount} of ${match.totalCount} ingredients already`);
  }

  if (ctx.maxTimeMinutes != null) {
    const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);
    if (totalTime > 0 && totalTime <= ctx.maxTimeMinutes) {
      bullets.push(`Fits your request for under ${ctx.maxTimeMinutes} minutes`);
    }
  }

  if (recipe.cuisine && breakdown.preference_match >= 0.7) {
    bullets.push(`Matches your liking for ${recipe.cuisine} food`);
  }

  if (recipe.cuisine && breakdown.recent_meal_repetition_penalty === 0 && breakdown.novelty_score >= 0.7) {
    bullets.push(`You haven't had ${recipe.cuisine} recently`);
  }

  if (recipe.equipment_needed.length > 0 && breakdown.equipment_match === 1) {
    bullets.push(`Uses equipment you have: ${recipe.equipment_needed.join(', ')}`);
  }

  if (bullets.length === 0) {
    bullets.push('Fits your pantry and request.');
  }

  return bullets.slice(0, 4);
}
