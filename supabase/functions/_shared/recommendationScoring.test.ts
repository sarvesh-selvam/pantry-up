// Sanity checks for the deterministic scoring formula — same "cheap,
// runtime-native check" reasoning as dietaryRestrictions.test.ts. These
// pin down the properties Phase 8's Definition of Done actually cares
// about (better pantry coverage scores higher, an honestly-neutral term
// stays neutral, repetition nudges rather than zeroes a score out) rather
// than asserting exact numbers, which would make the weights brittle to
// retune. Run with:
//   cd supabase/functions && deno test _shared/recommendationScoring.test.ts

import { assert, assertEquals } from 'jsr:@std/assert';
import { computeRecipeScore, type ScoringContext, type ScoringRecipe } from './recommendationScoring.ts';

const BASE_RECIPE: ScoringRecipe = {
  cuisine: 'Italian',
  prep_time: 10,
  cook_time: 20,
  rescued_ingredient_names: [],
  equipment_needed: [],
};

const EMPTY_CTX: ScoringContext = {
  cuisineWeights: {},
  equipment: [],
  maxTimeMinutes: null,
  rescueEntries: [],
  recentCookEvents: [],
};

Deno.test('higher pantry coverage scores higher, all else equal', () => {
  const low = computeRecipeScore(BASE_RECIPE, { haveCount: 2, totalCount: 10, missingIngredientCount: 8 }, EMPTY_CTX);
  const high = computeRecipeScore(BASE_RECIPE, { haveCount: 9, totalCount: 10, missingIngredientCount: 1 }, EMPTY_CTX);
  assert(high.score > low.score, 'better pantry coverage should score higher');
});

Deno.test('macro_match is honestly neutral — no stated nutrition goal exists yet', () => {
  const { breakdown } = computeRecipeScore(BASE_RECIPE, { haveCount: 5, totalCount: 5, missingIngredientCount: 0 }, EMPTY_CTX);
  assertEquals(breakdown.macro_match, 0.5);
});

Deno.test('a stated time limit the recipe fits scores time_match at 1', () => {
  const match = { haveCount: 5, totalCount: 5, missingIngredientCount: 0 };
  const { breakdown } = computeRecipeScore(BASE_RECIPE, match, { ...EMPTY_CTX, maxTimeMinutes: 60 });
  assertEquals(breakdown.time_match, 1);
});

Deno.test('no stated time limit leaves time_match neutral, never penalized', () => {
  const match = { haveCount: 5, totalCount: 5, missingIngredientCount: 0 };
  const { breakdown } = computeRecipeScore(BASE_RECIPE, match, EMPTY_CTX);
  assertEquals(breakdown.time_match, 0.5);
});

Deno.test('cooking the same cuisine yesterday applies a real repetition penalty', () => {
  const match = { haveCount: 5, totalCount: 5, missingIngredientCount: 0 };
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const ctx: ScoringContext = { ...EMPTY_CTX, recentCookEvents: [{ cuisine: 'Italian', ingredientCategories: [], cookedAt: yesterday }] };
  const { breakdown } = computeRecipeScore(BASE_RECIPE, match, ctx);
  assert(breakdown.recent_meal_repetition_penalty > 0, 'cooking the same cuisine yesterday should apply a penalty');
  assert(breakdown.novelty_score < 1, 'novelty should drop for a recently-cooked cuisine');
});

Deno.test('repetition is a nudge, not domination — never outweighs a large pantry-coverage gap', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const ctx: ScoringContext = { ...EMPTY_CTX, recentCookEvents: [{ cuisine: 'Italian', ingredientCategories: [], cookedAt: yesterday }] };
  const repeatedButFull = computeRecipeScore(BASE_RECIPE, { haveCount: 10, totalCount: 10, missingIngredientCount: 0 }, ctx);
  const novelButEmpty = computeRecipeScore(BASE_RECIPE, { haveCount: 1, totalCount: 10, missingIngredientCount: 9 }, EMPTY_CTX);
  assert(
    repeatedButFull.score > novelButEmpty.score,
    'a full-coverage repeated cuisine should still beat a near-empty-pantry "novel" one — variety is the lowest-priority signal'
  );
});
