import type { InventoryItem, QuantityState, StorageLocation } from '../types/database';

const QUANTITY_STATE_LABELS: Record<QuantityState, string> = {
  full: 'Full',
  mostly_full: 'Mostly full',
  half: 'Half',
  low: 'Low',
  almost_empty: 'Almost empty',
};

export const STORAGE_LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
  counter: 'Counter',
};

export const STORAGE_LOCATION_ORDER: StorageLocation[] = [
  'fridge',
  'freezer',
  'pantry',
  'counter',
];

export function formatQuantity(item: Pick<InventoryItem, 'quantity_value' | 'quantity_unit' | 'quantity_state'>): string {
  if (item.quantity_value != null) {
    const unit = item.quantity_unit ? ` ${item.quantity_unit}` : '';
    return `${item.quantity_value}${unit}`;
  }
  if (item.quantity_state) {
    return QUANTITY_STATE_LABELS[item.quantity_state];
  }
  return 'Quantity unknown';
}

export function isUncertain(item: Pick<InventoryItem, 'verification_status'>): boolean {
  return (
    item.verification_status === 'ai_estimated' ||
    item.verification_status === 'needs_verification'
  );
}

/**
 * The expiry date to show for an item, preferring what the user typed over
 * the deterministically-computed estimate. `isEstimated` tells the caller
 * whether to show the uncertainty badge next to it (never for a
 * user-provided date).
 */
export function getEffectiveExpiry(
  item: Pick<InventoryItem, 'expiry_user_provided' | 'expiry_estimated'>
): { date: string | null; isEstimated: boolean } {
  if (item.expiry_user_provided) {
    return { date: item.expiry_user_provided, isEstimated: false };
  }
  if (item.expiry_estimated) {
    return { date: item.expiry_estimated, isEstimated: true };
  }
  return { date: null, isEstimated: false };
}

export function daysUntil(dateString: string): number {
  const target = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}
