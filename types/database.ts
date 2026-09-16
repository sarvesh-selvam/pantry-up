// Hand-written types mirroring the Postgres schema in /db/migrations.
// If the schema changes, update these alongside the migration.

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
  | 'pantry_snapshot';

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
