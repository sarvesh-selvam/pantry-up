// Applies a Kitchen Check-In response to real inventory state. Tapping a
// response IS the confirmation — unlike the cooking mutation flow (Phase
// 4), there's no separate review/confirm step here, so every branch below
// writes immediately via the same InventoryContext methods every other
// screen uses (no parallel mutation path to drift out of sync).

import type { InventoryItemUpdate, QuantityState } from '../types/database';

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
 */
export async function applyCheckInResponse(
  itemId: string,
  response: CheckInResponse,
  actions: CheckInActions
): Promise<void> {
  const now = new Date().toISOString();

  if (response.kind === 'existence') {
    if (response.value === 'gone') {
      await actions.removeItem(itemId);
      return;
    }
    await actions.editItem(itemId, {
      verification_status: 'confirmed',
      last_verified_at: now,
      ...(response.value === 'frozen' ? { storage_location: 'freezer' as const } : {}),
    });
    return;
  }

  if (response.kind === 'leftover') {
    if (response.value === 'ate_it' || response.value === 'discarded') {
      await actions.removeItem(itemId);
      return;
    }
    await actions.editItem(itemId, { verification_status: 'confirmed', last_verified_at: now });
    return;
  }

  // 'quantity'
  await actions.editItem(itemId, {
    quantity_state: response.value,
    verification_status: 'confirmed',
    last_verified_at: now,
  });
}
