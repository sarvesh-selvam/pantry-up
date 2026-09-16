// Kitchen Check-In staleness/uncertainty scoring — deterministic, no LLM.
// The whole point of Check-In is minimal-effort, high-signal review: most
// confirmed, recently-added, non-perishable items should NEVER surface
// here. getCheckInCandidates scores every item and filters out anything
// below CHECK_IN_THRESHOLDS.minimumScore; getCheckInBatch caps that to a
// short session.

import { daysUntil, getEffectiveExpiry } from './formatInventory';
import type { InventoryItem } from '../types/database';

// All tuning knobs in one place, per the spec's explicit instruction —
// adjust here, not scattered through the scoring logic below.
export const CHECK_IN_THRESHOLDS = {
  /** Days since last confirmed (last_verified_at, or created_at if never
   * verified) before a normal item starts accruing staleness score. */
  staleDays: 4,
  /** Leftovers go stale faster than shelf-stable/fridge goods. */
  leftoverStaleDays: 2,
  /** Within this many days of (or past) its effective expiry counts toward
   * the score, but only if it hasn't been confirmed very recently. */
  expiryProximityDays: 3,
  /** An item needs at least this much score to be a Check-In candidate at
   * all — most items should score 0 and never appear. */
  minimumScore: 30,
  /** Max items shown in one Check-In session, even if more qualify. */
  batchSize: 6,
} as const;

export type CheckInPromptType = 'existence' | 'quantity' | 'leftover';

export interface CheckInCandidate {
  item: InventoryItem;
  score: number;
  promptType: CheckInPromptType;
  daysSinceVerified: number;
  /** e.g. "Added 4 days ago", "Last confirmed 5 days ago", "Prepared 3 days ago". */
  detail: string;
}

function daysSinceReference(dateString: string): number {
  return -daysUntil(dateString);
}

/** Which prompt variant a candidate should show — a small decision
 * function per spec, not hardcoded per item. Leftover-ness is checked
 * first since it's the most salient distinguishing factor; anything with
 * an approximate quantity_state gets the quantity picker; everything else
 * (precise quantity_value, or no quantity info at all) gets a plain
 * existence check. */
export function determinePromptType(item: Pick<InventoryItem, 'preparation_state' | 'quantity_state'>): CheckInPromptType {
  if (item.preparation_state === 'leftover') return 'leftover';
  if (item.quantity_state != null) return 'quantity';
  return 'existence';
}

function buildDetail(item: InventoryItem, promptType: CheckInPromptType, daysSinceVerified: number): string {
  const dayWord = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

  if (promptType === 'leftover') {
    const preparedDays = -daysUntil(item.opened_at ?? item.created_at);
    return `Prepared ${dayWord(preparedDays)} ago`;
  }
  if (!item.last_verified_at) {
    const addedDays = -daysUntil(item.created_at);
    return `Added ${dayWord(addedDays)} ago`;
  }
  return `Last confirmed ${dayWord(daysSinceVerified)} ago`;
}

/** Scores one item, or returns null if it doesn't clear the minimum bar. */
function scoreItem(item: InventoryItem): CheckInCandidate | null {
  const promptType = determinePromptType(item);
  const lastReference = item.last_verified_at ?? item.created_at;
  const daysSinceVerified = daysSinceReference(lastReference);
  const staleThreshold =
    item.preparation_state === 'leftover' ? CHECK_IN_THRESHOLDS.leftoverStaleDays : CHECK_IN_THRESHOLDS.staleDays;

  let score = 0;

  if (item.verification_status === 'needs_verification') score += 40;
  else if (item.verification_status === 'ai_estimated') score += 25;

  if (daysSinceVerified >= staleThreshold) {
    // Grows with age past the threshold, capped so one very old item
    // doesn't dominate ordering forever.
    score += Math.min(40, (daysSinceVerified - staleThreshold + 1) * 5);
  }

  const { date: expiryDate } = getEffectiveExpiry(item);
  if (expiryDate) {
    const daysToExpiry = daysUntil(expiryDate);
    if (daysToExpiry <= CHECK_IN_THRESHOLDS.expiryProximityDays && daysSinceVerified >= 1) {
      score += 20;
    }
  }

  if (item.quantity_confidence === 'estimated' && daysSinceVerified >= staleThreshold) {
    score += 15;
  }

  if (score < CHECK_IN_THRESHOLDS.minimumScore) return null;

  return {
    item,
    score,
    promptType,
    daysSinceVerified,
    detail: buildDetail(item, promptType, daysSinceVerified),
  };
}

/** Every item that qualifies for Check-In, most urgent first. Most items
 * won't appear at all — see module header. */
export function getCheckInCandidates(items: InventoryItem[]): CheckInCandidate[] {
  return items
    .map(scoreItem)
    .filter((candidate): candidate is CheckInCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score);
}

/** One capped session's worth. If more candidates remain after this batch
 * is resolved, they'll surface in the next call once re-scored. */
export function getCheckInBatch(items: InventoryItem[]): CheckInCandidate[] {
  return getCheckInCandidates(items).slice(0, CHECK_IN_THRESHOLDS.batchSize);
}
