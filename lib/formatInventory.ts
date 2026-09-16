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
