// Best-effort match of which recipe ingredients a given instruction step
// mentions, so Cooking Mode can show quantities inline. Simple substring
// match on display_name — deliberately not smarter than that (no
// stemming/synonyms); "where applicable" per spec, not exhaustive.

import type { RecipeIngredient } from '../types/recipe';

export function findIngredientsInStep(
  stepText: string,
  ingredients: RecipeIngredient[]
): RecipeIngredient[] {
  const lowerStep = stepText.toLowerCase();
  return ingredients.filter((ingredient) => lowerStep.includes(ingredient.display_name.toLowerCase()));
}
