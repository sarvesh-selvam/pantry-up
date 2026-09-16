// Recipe domain types — Phase 3. See db/migrations/0008_recipes.sql for the
// backing table and lib/recipeMatching.ts for the module that produces
// IngredientMatch/RecipeMatchResult.

export type RecipeSourceType = 'ai_generated' | 'manual' | 'cookbook_scan' | 'imported';

export type IngredientMatchStatus = 'have' | 'verify' | 'missing';

// These use `type X = {...}` rather than `interface X {...}` throughout —
// Recipe is used directly as Database.Tables.recipes.Row in
// types/database.ts, and @supabase/supabase-js's generics require it to
// structurally satisfy a Record<string, unknown>-style index signature,
// which only type aliases (not named interfaces) implicitly do. See
// CLAUDE.md's "Supabase typing gotcha" for the full explanation.

export type IngredientMatch = {
  status: IngredientMatchStatus;
  /** Total matched quantity in the recipe ingredient's own unit, or null
   * when no comparable numeric quantity could be summed (still may be
   * 'have' if the ingredient itself has no quantity_value — presence-only). */
  available_quantity: number | null;
  matched_inventory_item_ids: string[];
};

export type RecipeIngredient = {
  canonical_food_id: string | null;
  display_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  /** Snapshot from the matching engine at generation/save time, kept for
   * explainability/history. Screens re-run lib/recipeMatching.ts live
   * against current inventory rather than trusting this snapshot, since
   * inventory changes after a recipe is saved. */
  inventory_match: IngredientMatch | null;
  /** Whether this ingredient's own canonical-food identification is
   * trusted — mirrors inventory_items.verification_status, but only the
   * two values relevant to a generated guess. */
  verification_status: 'confirmed' | 'needs_verification';
};

/** Deterministic, calculated nutrition per serving — never LLM-invented.
 * See lib/nutritionCalculation.ts. `is_partial` is true when one or more
 * ingredients couldn't be matched to canonical_food_id, had no seeded
 * nutrition_data row, or had a quantity/unit that couldn't be confidently
 * converted to grams — the totals below only reflect what COULD be
 * computed, and the UI must say so rather than presenting them as exact. */
export type RecipeNutrition = {
  calories_per_serving: number;
  protein_g_per_serving: number;
  carbs_g_per_serving: number;
  fat_g_per_serving: number;
  is_partial: boolean;
  matched_ingredient_count: number;
  total_ingredient_count: number;
};

/** One real YouTube search result — every field comes straight from the
 * YouTube Data API response, never invented by the LLM. See
 * supabase/functions/_shared/youtubeSearch.ts. */
export type YoutubeVideoResult = {
  video_id: string;
  title: string;
  channel_title: string;
  video_url: string;
  thumbnail_url: string;
  published_at: string;
};

/** Cached on a recipe once its key technique has been identified (LLM,
 * text-only) and searched for (real YouTube Data API call) — see
 * supabase/functions/recipe-videos/. `technique` is the LLM's pick of the
 * recipe's single most important/non-obvious technique; `results` is
 * whatever the live search actually returned, including an empty array
 * when nothing matched — that's a genuine "no results," not missing data. */
export type RecipeYoutubeMetadata = {
  technique: string;
  search_query: string;
  retrieved_at: string;
  results: YoutubeVideoResult[];
};

/**
 * Every term the deterministic recommendation-ranking function
 * (lib/recommendationScoring.ts / _shared/recommendationScoring.ts)
 * computed for one recipe, each in [0, 1] (penalties too, as positive
 * magnitudes subtracted at combine-time) — kept alongside the final
 * `score` so ranking stays inspectable, not an opaque number. See that
 * module's header comment for the full weighting/formula and for which
 * terms are honestly neutral (0.5) this phase because their real input
 * (a stated macro goal) doesn't exist yet.
 */
export type RecipeScoreBreakdown = {
  pantry_coverage: number;
  expiry_rescue_score: number;
  preference_match: number;
  time_match: number;
  macro_match: number;
  equipment_match: number;
  novelty_score: number;
  missing_ingredient_penalty: number;
  recent_meal_repetition_penalty: number;
};

export type GeneratedContext = {
  /** The free-text request/constraints this recipe was generated from. */
  constraints: string;
  inventory_snapshot_summary: string;
  rescue_items_used: string[];
  dietary_restrictions_enforced: string[];
  cuisine_preference_used: string | null;
  /** PantryUp's explainability principle: never just "Recommended by AI" —
   * always say what pantry/rescue items it uses and why it fits. */
  why_this_works: string;
  /** Deterministic bullets generated straight from `score_breakdown`'s
   * real numbers (lib/api/recipes.ts's suggestionToRecipeInsert calls
   * buildWhyBullets) — see RecipeSuggestion.why_bullets. Empty for
   * recipes saved before Phase 8, or for manual/scanned recipes that
   * never went through ranking; the UI falls back to `why_this_works`'s
   * prose in that case. */
  why_bullets: string[];
  /** The final weighted-sum score and its full breakdown, persisted for
   * inspectability — not shown as a raw number in the UI, but available
   * for debugging "why did this rank where it did." Null for the same
   * never-ranked cases as why_bullets. */
  score: number | null;
  score_breakdown: RecipeScoreBreakdown | null;
};

export type Recipe = {
  id: string;
  user_id: string;
  source_type: RecipeSourceType;
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  ingredients: RecipeIngredient[];
  instructions: string[];
  nutrition: RecipeNutrition | null;
  youtube_metadata: RecipeYoutubeMetadata | null;
  tags: string[];
  is_favorite: boolean;
  generated_context: GeneratedContext | null;
  /** Controlled-vocabulary equipment tags (see lib/preferenceOptions.ts),
   * inferred heuristically by the LLM at generation time — always empty
   * for manual/scanned recipes ("no requirement known", scored as a
   * neutral match, never a penalty). See db/migrations/0018. */
  equipment_needed: string[];
  created_at: string;
  updated_at: string;
};

export type RecipeInsert = Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'> &
  Partial<Pick<Recipe, 'created_at' | 'updated_at'>>;

export type RecipeDbInsert = RecipeInsert & Pick<Recipe, 'user_id'>;

/** What both Sous Chef and Home's suggestions return per recipe — already
 * matched against live inventory, ready to render as a card. */
export type RecipeSuggestion = {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  instructions: string[];
  tags: string[];
  ingredients: RecipeIngredient[];
  pantry_coverage_label: string;
  missing_ingredient_count: number;
  why_this_works: string;
  /** See GeneratedContext.why_bullets — the deterministic, grounded
   * replacement for trusting `why_this_works` prose alone. */
  why_bullets: string[];
  score: number | null;
  score_breakdown: RecipeScoreBreakdown | null;
  rescued_ingredient_names: string[];
  nutrition: RecipeNutrition | null;
  equipment_needed: string[];
  /** Always null straight out of generation (Sous Chef/Home suggestions) —
   * see recipe-videos' header comment for why this isn't fetched eagerly
   * for every generated candidate. Sous Chef's chat screen fetches it
   * client-side for the one recipe it actually renders, right after the
   * reply comes back; Home's suggestion strip doesn't fetch it at all
   * (unsaved candidates, several per visit) — it gets filled in lazily the
   * first time a saved recipe's detail screen is opened. */
  youtube_metadata: RecipeYoutubeMetadata | null;
};

export type RecipeMatchResult = {
  ingredients: RecipeIngredient[]; // inventory_match freshly recomputed
  pantryCoverageLabel: string; // "X of Y ingredients"
  haveCount: number;
  totalCount: number;
  missingIngredientCount: number;
};

/** One ingredient line as extracted by cookbook-scan — same field naming
 * as the Edge Function's response, before it's been mapped to a
 * RecipeIngredient for saving. */
export type ScannedIngredient = {
  raw_text: string;
  canonical_food_id_guess: string | null;
  display_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  confidence: number;
};

/** What cookbook-scan returns — a suggestion only, reviewed/edited on
 * app/(tabs)/cookbook/scan-review.tsx before being saved as a real Recipe. */
export type ScannedRecipeDraft = {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  ingredients: ScannedIngredient[];
  instructions: string[];
  tags: string[];
  /** Whole-recipe uncertainty flag — see cookbook-scan's header comment for
   * why whole-recipe rather than per-field. */
  needs_verification: boolean;
  nutrition: RecipeNutrition | null;
};

/** What generate_recipe (client- or server-side) produces before it's been
 * matched or saved — no id/user_id/timestamps yet. */
export type GeneratedRecipeDraft = {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number | null;
  prep_time: number | null;
  cook_time: number | null;
  ingredients: Omit<RecipeIngredient, 'inventory_match'>[];
  instructions: string[];
  tags: string[];
  generated_context: GeneratedContext;
};
