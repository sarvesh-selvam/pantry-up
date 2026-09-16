import { daysUntil, getEffectiveExpiry } from './formatInventory';
import type { InventoryItem } from '../types/database';

export type RescueRowReason = 'expiring' | 'low_quantity' | 'leftover';

export interface RescueRowEntry {
  item: InventoryItem;
  reason: RescueRowReason;
  /** PantryUp's status language, shown on the card. */
  statusLabel: 'Use Soon' | 'Low Quantity' | 'Leftovers';
  /** e.g. "Expires in 2 days", "Almost empty", "Leftover for 3 days". */
  detail: string;
  sortKey: number;
}

const LOW_QUANTITY_STATES = new Set(['almost_empty', 'low']);
const LEFTOVER_MIN_AGE_DAYS = 2;
const EXPIRING_WITHIN_DAYS = 3;

function ageInDays(dateString: string): number {
  return -daysUntil(dateString.slice(0, 10));
}

/**
 * Purely derived from inventory state — no recommendation logic, no LLM.
 * "What needs my attention," not "what should I cook." Each item appears
 * once, classified by the highest-priority reason it matches (expiring >
 * leftover > low quantity), then sorted soonest-to-expire first.
 */
export function getRescueRowEntries(items: InventoryItem[]): RescueRowEntry[] {
  const entries: RescueRowEntry[] = [];

  for (const item of items) {
    const { date: expiryDate } = getEffectiveExpiry(item);
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
