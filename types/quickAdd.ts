import type { FoodCategory } from './database';

/** An editable draft row shown on the Quick Add review/confirmation screen. */
export interface QuickAddDraftItem {
  key: string;
  rawText: string;
  displayName: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  canonicalFoodId: string | null;
  category: FoodCategory | null;
  /** Whether this row is still included in the batch to be saved. */
  included: boolean;
}
