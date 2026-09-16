// Pure derivation functions over already-fetched data — same "no query,
// no LLM, just classify what's already loaded" pattern as lib/rescueRow.ts
// and lib/checkInScoring.ts. Phase 8's product spec calls out six
// behavioral signals to make available; most fall directly out of existing
// tables (cook_events, recipes) and don't need a new store at all. Two
// genuinely needed new insert-only logs (item_dispositions,
// recommendation_events — see their migrations) back the remaining two.
//
// Only "cuisines frequently cooked" and "recent cook history" (for
// novelty/repetition) are actually wired into ranking today
// (lib/recommendationScoring.ts / _shared/recommendationScoring.ts) — the
// product spec's scoring formula (section 3) doesn't name the other four
// as score terms, so they're implemented here as real, correct derivations
// (satisfying section 1's "make this signal available" ask) without being
// force-fit into the ranking math. A future phase could surface these as
// an "Insights" screen or feed them into the score; neither was required
// by this phase's Definition of Done.

import type { CookEvent } from '../types/cookEvent';
import type { CanonicalFood, ItemDisposition, RecommendationEvent } from '../types/database';
import type { Recipe } from '../types/recipe';

/** Cuisines frequently cooked — cook_events joined to recipes.cuisine. */
export function cuisinesCookedFrequency(
  cookEvents: CookEvent[],
  recipesById: Map<string, Recipe>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of cookEvents) {
    const cuisine = recipesById.get(event.recipe_id)?.cuisine;
    if (!cuisine) continue;
    counts[cuisine] = (counts[cuisine] ?? 0) + 1;
  }
  return counts;
}

/** Recipes saved N+ days ago with no matching cook_event. */
export function recipesSavedNotCooked(recipes: Recipe[], cookEvents: CookEvent[], minAgeDays = 3): Recipe[] {
  const cookedRecipeIds = new Set(cookEvents.map((event) => event.recipe_id));
  const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;
  return recipes.filter((recipe) => !cookedRecipeIds.has(recipe.id) && new Date(recipe.created_at).getTime() <= cutoff);
}

/** Average total time (prep + cook) across cooked recipes that stated one. */
export function averageCookTimeMinutes(cookEvents: CookEvent[], recipesById: Map<string, Recipe>): number | null {
  const totals: number[] = [];
  for (const event of cookEvents) {
    const recipe = recipesById.get(event.recipe_id);
    if (!recipe) continue;
    const total = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);
    if (total > 0) totals.push(total);
  }
  if (totals.length === 0) return null;
  return totals.reduce((sum, t) => sum + t, 0) / totals.length;
}

/**
 * "Favorite proteins" — approximated as the food_category most often
 * present in cooked recipes' ingredients. The canonical_foods schema only
 * has one protein-specific category ('meat'); plant proteins (tofu,
 * legumes) fall under other categories and aren't distinguished here —
 * a scoped simplification rather than an invented finer-grained
 * classification the data doesn't actually support.
 */
export function favoriteIngredientCategories(
  cookEvents: CookEvent[],
  recipesById: Map<string, Recipe>,
  canonicalFoodsById: Map<string, CanonicalFood>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of cookEvents) {
    const recipe = recipesById.get(event.recipe_id);
    if (!recipe) continue;
    const categoriesInRecipe = new Set<string>();
    for (const ingredient of recipe.ingredients) {
      if (!ingredient.canonical_food_id) continue;
      const category = canonicalFoodsById.get(ingredient.canonical_food_id)?.category;
      if (category) categoriesInRecipe.add(category);
    }
    for (const category of categoriesInRecipe) {
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return counts;
}

export interface DispositionRate {
  consumed: number;
  discarded: number;
  unknown: number;
}

/** Ingredients frequently discarded — keyed by canonical_food_id when
 * known, else the raw display_name (an unresolved ingredient still counts
 * toward its own key, just can't be merged across differently-typed
 * entries of the same food). */
export function dispositionRatesByFood(dispositions: ItemDisposition[]): Record<string, DispositionRate> {
  const rates: Record<string, DispositionRate> = {};
  for (const entry of dispositions) {
    const key = entry.canonical_food_id ?? entry.display_name;
    const rate = rates[key] ?? { consumed: 0, discarded: 0, unknown: 0 };
    rate[entry.disposition] += 1;
    rates[key] = rate;
  }
  return rates;
}

export interface CuisineSkipRate {
  shown: number;
  tapped: number;
  skipRate: number;
}

/** Frequently skipped suggestions, aggregated by cuisine (see
 * db/migrations/0017's header comment for why cuisine, not exact title). */
export function suggestionSkipRatesByCuisine(events: RecommendationEvent[]): Record<string, CuisineSkipRate> {
  const rates: Record<string, CuisineSkipRate> = {};
  for (const event of events) {
    if (!event.cuisine) continue;
    const rate = rates[event.cuisine] ?? { shown: 0, tapped: 0, skipRate: 0 };
    if (event.action === 'shown') rate.shown += 1;
    else rate.tapped += 1;
    rates[event.cuisine] = rate;
  }
  for (const rate of Object.values(rates)) {
    rate.skipRate = rate.shown > 0 ? Math.max(0, rate.shown - rate.tapped) / rate.shown : 0;
  }
  return rates;
}
