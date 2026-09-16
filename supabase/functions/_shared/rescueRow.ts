// Deno port of lib/rescueRow.ts — same algorithm, kept in sync manually
// (see that file's header). Self-contained (no import across the Node/Deno
// boundary) with only the inventory_items fields it actually needs, same
// pattern as the rest of supabase/functions/_shared/.

export interface RescueInventoryItem {
  id: string;
  display_name: string;
  expiry_user_provided: string | null;
  expiry_estimated: string | null;
  quantity_state: string | null;
  preparation_state: string;
  opened_at: string | null;
  created_at: string;
  verification_status: string;
}

export type RescueRowReason = 'expiring' | 'low_quantity' | 'leftover';

export interface RescueRowEntry {
  item: RescueInventoryItem;
  reason: RescueRowReason;
  statusLabel: 'Use Soon' | 'Low Quantity' | 'Leftovers';
  detail: string;
  sortKey: number;
}

const LOW_QUANTITY_STATES = new Set(['almost_empty', 'low']);
const LEFTOVER_MIN_AGE_DAYS = 2;
const EXPIRING_WITHIN_DAYS = 3;

function daysUntil(dateString: string): number {
  const target = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

function ageInDays(dateString: string): number {
  return -daysUntil(dateString.slice(0, 10));
}

function effectiveExpiry(item: RescueInventoryItem): string | null {
  return item.expiry_user_provided ?? item.expiry_estimated ?? null;
}

export function getRescueRowEntries(items: RescueInventoryItem[]): RescueRowEntry[] {
  const entries: RescueRowEntry[] = [];

  for (const item of items) {
    const expiryDate = effectiveExpiry(item);
    const daysToExpiry = expiryDate ? daysUntil(expiryDate) : null;

    if (daysToExpiry != null && daysToExpiry <= EXPIRING_WITHIN_DAYS) {
      entries.push({
        item,
        reason: 'expiring',
        statusLabel: 'Use Soon',
        detail:
          daysToExpiry < 0
            ? `Expired ${Math.abs(daysToExpiry)} day${Math.abs(daysToExpiry) === 1 ? '' : 's'} ago`
            : daysToExpiry === 0
              ? 'Expires today'
              : `Expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`,
        sortKey: daysToExpiry,
      });
      continue;
    }

    const openedOrCreated = item.opened_at ?? item.created_at;
    if (item.preparation_state === 'leftover' && ageInDays(openedOrCreated) >= LEFTOVER_MIN_AGE_DAYS) {
      const age = ageInDays(openedOrCreated);
      entries.push({
        item,
        reason: 'leftover',
        statusLabel: 'Leftovers',
        detail: `Leftover for ${age} day${age === 1 ? '' : 's'}`,
        sortKey: 1000 - age,
      });
      continue;
    }

    if (item.quantity_state && LOW_QUANTITY_STATES.has(item.quantity_state)) {
      entries.push({
        item,
        reason: 'low_quantity',
        statusLabel: 'Low Quantity',
        detail: item.quantity_state === 'almost_empty' ? 'Almost empty' : 'Running low',
        sortKey: 100000,
      });
    }
  }

  return entries.sort((a, b) => a.sortKey - b.sortKey);
}
