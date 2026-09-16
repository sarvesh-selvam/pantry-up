// Applies a Kitchen Check-In response to real inventory state. Tapping a
// response IS the confirmation — unlike the cooking mutation flow (Phase
// 4), there's no separate review/confirm step here, so every branch below
// writes immediately via the same InventoryContext methods every other
// screen uses (no parallel mutation path to drift out of sync).

import { logLeftoverConsumption } from './nutritionLogging';
import type { InventoryItem, InventoryItemUpdate, QuantityState } from '../types/database';

export type ExistenceResponseValue = 'gone' | 'still_here' | 'frozen';
export type LeftoverResponseValue = 'ate_it' | 'still_here' | 'discarded';

export type CheckInResponse =
  | { kind: 'existence'; value: ExistenceResponseValue }
  | { kind: 'quantity'; value: QuantityState }
  | { kind: 'leftover'; value: LeftoverResponseValue };

interface CheckInActions {
  editItem: (id: string, updates: InventoryItemUpdate) => Promise<unknown>;
  removeItem: (id: string) => Promise<void>;
}

/**
 * "Gone" / "Ate It" / "Discarded" delete the item outright — same pattern
 * Phase 4's cooking mutations use for fully-consumed items, so there's one
 * consistent answer to "how does PantryUp represent an item that's no
 * longer there" rather than two (delete vs. a separate archived status).
 * Every other response confirms the item in place: verification_status
 * 'confirmed' + a fresh last_verified_at, which is what clears the orange
 * "?" everywhere it's shown (see lib/formatInventory.ts's isUncertain).
 *
 * "Ate It" on a leftover additionally attempts to log its nutrition (Phase
 * 6) via lib/nutritionLogging.ts — best-effort: a logging failure is
 * swallowed (console.warn) rather than blocking the item's removal, since
 * nutrition logging is a secondary enhancement to a primary action the
 * user has already decided on by tapping the button.
 */
export async function applyCheckInResponse(
  item: Pick<InventoryItem, 'id' | 'source_recipe_id' | 'quantity_value'>,
  response: CheckInResponse,
  actions: CheckInActions,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();

  if (response.kind === 'existence') {
    if (response.value === 'gone') {
      await actions.removeItem(item.id);
      return;
    }
    await actions.editItem(item.id, {
      verification_status: 'confirmed',
      last_verified_at: now,
      ...(response.value === 'frozen' ? { storage_location: 'freezer' as const } : {}),
    });
    return;
  }

  if (response.kind === 'leftover') {
    if (response.value === 'ate_it') {
      try {
        await logLeftoverConsumption(item, userId);
      } catch (err) {
        console.warn('Failed to log nutrition for eaten leftover', err);
      }
      await actions.removeItem(item.id);
      return;
    }
    if (response.value === 'discarded') {
      await actions.removeItem(item.id);
      return;
    }
    await actions.editItem(item.id, { verification_status: 'confirmed', last_verified_at: now });
    return;
  }

  // 'quantity'
  await actions.editItem(item.id, {
    quantity_state: response.value,
    verification_status: 'confirmed',
    last_verified_at: now,
  });
}
