/**
 * Deliberately dumb, same philosophy as matchIngredientsToStep.ts's
 * findIngredientsInStep — a plain keyword-overlap check against the
 * recipe's identified key technique, not real NLP. "Where applicable" per
 * spec, not exhaustive; many steps won't match (inflection, phrasing) and
 * that's fine — Cooking Mode falls back to showing the recipe's cached
 * Watch results as a persistent small section rather than forcing
 * per-step precision (see TechniqueVideoSlot.tsx).
 */
export function stepMatchesTechnique(stepText: string, technique: string): boolean {
  const stepWords = new Set(stepText.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
  const techniqueWords = technique.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  return techniqueWords.some((word) => stepWords.has(word));
}
