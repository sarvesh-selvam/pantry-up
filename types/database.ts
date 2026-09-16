// Hand-written types mirroring the Postgres schema in /db/migrations.
// If the schema changes, update these alongside the migration.

import type { Recipe, RecipeDbInsert } from './recipe';
import type { CookEvent, CookEventDbInsert } from './cookEvent';

export type FoodCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'grains'
  | 'canned_goods'
  | 'condiments'
  | 'pantry_staple'
  | 'prepared'
  | 'other';

export const FOOD_CATEGORIES: readonly FoodCategory[] = [
  'produce',
  'dairy',
  'meat',
  'grains',
  'canned_goods',
  'condiments',
  'pantry_staple',
  'prepared',
  'other',
];

export type QuantityConfidence = 'confirmed' | 'estimated';

export type QuantityState =
  | 'full'
  | 'mostly_full'
  | 'half'
  | 'low'
  | 'almost_empty';

export type PreparationState = 'raw' | 'prepared' | 'leftover';

export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter';

export type InventorySource =
  | 'manual'
  | 'quick_add'
  | 'receipt_scan'
  | 'pantry_snapshot'
  | 'cooking';

export type VerificationStatus =
  | 'confirmed'
  | 'ai_estimated'
  | 'needs_verification';

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export type CanonicalFood = {
  id: string;
  canonical_name: string;
  category: FoodCategory;
  default_unit: string | null;
  aliases: string[];
  created_at: string;
};

export type InventoryItem = {
  id: string;
  user_id: string;
  canonical_food_id: string | null;
  display_name: string;
  category: FoodCategory | null;
  quantity_value: number | null;
  quantity_unit: string | null;
  quantity_confidence: QuantityConfidence;
  quantity_state: QuantityState | null;
  preparation_state: PreparationState;
  storage_location: StorageLocation;
  source: InventorySource;
  purchased_at: string | null;
  opened_at: string | null;
  expiry_user_provided: string | null;
  expiry_estimated: string | null;
  verification_status: VerificationStatus;
  /** Exactly what the user typed (Quick Add) or what OCR/vision extracted
   * (receipt scan) for this item — never overwritten by normalization. */
  raw_input_text: string | null;
  /** Set on leftovers created from Finish Cooking, so eating them later can
   * compute real nutrition from the original recipe rather than guessing. */
  source_recipe_id: string | null;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
}

export type FoodStorageRule = {
  id: string;
  canonical_food_id: string | null;
  category: FoodCategory;
  preparation_state: PreparationState;
  storage_location: StorageLocation;
  is_opened: boolean;
  typical_shelf_life_days: number;
  is_safety_critical: boolean;
  source_note: string;
  created_at: string;
};

export type NutritionData = {
  id: string;
  canonical_food_id: string;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  source_note: string;
  created_at: string;
};

export type DailyNutrition = {
  id: string;
  user_id: string;
  log_date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  updated_at: string;
};

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type UserPreferences = {
  user_id: string;
  cuisine_weights: Record<string, number>;
  dietary_restrictions: string[];
  skill_level: SkillLevel;
  equipment: string[];
  created_at: string;
  updated_at: string;
};

// App-facing insert shape: callers (e.g. addItem) don't supply user_id, the
// API layer stamps it on before writing.
export type InventoryItemInsert = Omit<
  InventoryItem,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> &
  Partial<Pick<InventoryItem, 'created_at' | 'updated_at'>>;

// What actually gets sent to Postgres, once user_id has been stamped on.
export type InventoryItemDbInsert = InventoryItemInsert & Pick<InventoryItem, 'user_id'>;

export type InventoryItemUpdate = Partial<
  Omit<InventoryItem, 'id' | 'user_id' | 'created_at'>
>;

// Shape matches what `supabase gen types typescript` produces, which is
// what @supabase/supabase-js's generics expect (each table needs
// `Relationships`, and the schema needs `Views`/`Functions`, even if empty).
export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Tables: {
      users: {
        Row: UserProfile;
        Insert: Partial<UserProfile> & Pick<UserProfile, 'id' | 'email'>;
        Update: Partial<UserProfile>;
        Relationships: [];
      };
      canonical_foods: {
        Row: CanonicalFood;
        Insert: Partial<CanonicalFood> &
          Pick<CanonicalFood, 'canonical_name' | 'category'>;
        Update: Partial<CanonicalFood>;
        Relationships: [];
      };
      inventory_items: {
        Row: InventoryItem;
        Insert: InventoryItemDbInsert;
        Update: InventoryItemUpdate;
        Relationships: [];
      };
      food_storage_rules: {
        Row: FoodStorageRule;
        Insert: Partial<FoodStorageRule> &
          Pick<FoodStorageRule, 'category' | 'preparation_state' | 'storage_location' | 'typical_shelf_life_days'>;
        Update: Partial<FoodStorageRule>;
        Relationships: [];
      };
      recipes: {
        Row: Recipe;
        Insert: RecipeDbInsert;
        Update: Partial<Omit<Recipe, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      user_preferences: {
        Row: UserPreferences;
        Insert: Partial<UserPreferences> & Pick<UserPreferences, 'user_id'>;
        Update: Partial<UserPreferences>;
        Relationships: [];
      };
      cook_events: {
        Row: CookEvent;
        Insert: CookEventDbInsert;
        Update: Partial<Omit<CookEvent, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      nutrition_data: {
        Row: NutritionData;
        Insert: Partial<NutritionData> &
          Pick<NutritionData, 'canonical_food_id' | 'calories_per_100g' | 'protein_g_per_100g' | 'carbs_g_per_100g' | 'fat_g_per_100g'>;
        Update: Partial<NutritionData>;
        Relationships: [];
      };
      daily_nutrition: {
        Row: DailyNutrition;
        Insert: Partial<DailyNutrition> & Pick<DailyNutrition, 'user_id' | 'log_date'>;
        Update: Partial<DailyNutrition>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    // Every other write in this schema goes through a plain PostgREST
    // insert/update, but "add to today's total rather than overwrite it"
    // isn't expressible that way — increment_daily_nutrition (see
    // db/migrations/0014_daily_nutrition.sql) is the one place this app
    // calls a Postgres function via .rpc(), so it's the one Functions
    // entry that needs a real Args/Returns shape rather than `never`
    // (supabase-js's .rpc() resolves the params type to `undefined` for
    // any function typed as `never`, which fails at the call site).
    Functions: {
      increment_daily_nutrition: {
        Args: {
          p_user_id: string;
          p_log_date: string;
          p_calories: number;
          p_protein_g: number;
          p_carbs_g: number;
          p_fat_g: number;
        };
        Returns: DailyNutrition;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
