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
  nutrition: unknown | null;
  youtube_metadata: unknown | null;
  tags: string[];
  generated_context: GeneratedContext | null;
  created_at: string;
  updated_at: string;
};

export type RecipeInsert = Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'> &
  Partial<Pick<Recipe, 'created_at' | 'updated_at'>>;

export type RecipeDbInsert = RecipeInsert & Pick<Recipe, 'user_id'>;

export type RecipeMatchResult = {
  ingredients: RecipeIngredient[]; // inventory_match freshly recomputed
  pantryCoverageLabel: string; // "X of Y ingredients"
  haveCount: number;
  totalCount: number;
  missingIngredientCount: number;
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
