import type { FoodCategory, InventorySource } from './database';

/** An editable draft row shown on the Quick Add / Receipt Scan review screen
 * (both flows share this screen and this shape — see quick-add-review.tsx). */
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
  /** Which flow produced this batch — stamped onto inventory_items.source. */
  source: Extract<InventorySource, 'quick_add' | 'receipt_scan'>;
}
