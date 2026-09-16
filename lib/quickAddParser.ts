// Deterministic (non-AI) Quick Add parser for Phase 1.
//
// This is a placeholder for a future LLM-based parser (Phase 2+). It is kept
// isolated from the UI on purpose: callers only depend on `parseQuickAddText`
// and the `ParsedQuickAddItem` shape below, so swapping the implementation
// for an LLM call later should not require touching any screen.

import type { CanonicalFood } from '../types/database';

export interface ParsedQuickAddItem {
  /** The original phrase this item was parsed from, e.g. "2 chicken breasts". */
  rawText: string;
  /** Best-guess user-facing name, e.g. "chicken breasts". */
  displayName: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  /** Matched canonical food, if similarity crossed the match threshold. */
  canonicalFood: CanonicalFood | null;
  /** 0-1 similarity score of the best canonical match, for debugging/QA. */
  matchScore: number;
}

const MATCH_THRESHOLD = 0.6;

// Common units we recognize when stripping a leading quantity, e.g.
// "2 lbs chicken", "1 gallon milk", "3 cans beans".
const UNIT_WORDS = [
  'lb', 'lbs', 'pound', 'pounds',
  'oz', 'ounce', 'ounces',
  'g', 'gram', 'grams', 'kg',
  'cup', 'cups',
  'can', 'cans',
  'jar', 'jars',
  'bottle', 'bottles',
  'bunch', 'bunches',
  'clove', 'cloves',
  'stalk', 'stalks',
  'head', 'heads',
  'loaf', 'loaves',
  'dozen',
  'pack', 'packs', 'package', 'packages',
  'gallon', 'gallons',
  'quart', 'quarts',
  'stick', 'sticks',
  'block', 'blocks',
  'container', 'containers',
  'count',
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  dozen: 12,
};

/** Splits raw Quick Add text into individual item phrases. */
export function splitQuickAddText(text: string): string[] {
  const normalized = text
    .replace(/\n/g, ',')
    .replace(/\s*&\s*/g, ', ')
    .replace(/\s+and\s+/gi, ', ');

  return normalized
    .split(',')
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

/**
 * Strips a leading quantity (and optional unit) off a phrase, e.g.
 * "2 chicken breasts" -> { quantityValue: 2, quantityUnit: null, rest: "chicken breasts" }
 * "3 cans beans" -> { quantityValue: 3, quantityUnit: "cans", rest: "beans" }
 */
export function extractQuantity(phrase: string): {
  quantityValue: number | null;
  quantityUnit: string | null;
  rest: string;
} {
  const trimmed = phrase.trim();
  const unitPattern = UNIT_WORDS.join('|');

  const numericWithUnit = new RegExp(
    `^(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b\\.?\\s+(?:of\\s+)?(.+)$`,
    'i'
  );
  const wordWithUnit = new RegExp(
    `^(${Object.keys(NUMBER_WORDS).join('|')})\\s+(${unitPattern})\\b\\.?\\s+(?:of\\s+)?(.+)$`,
    'i'
  );
  const numericOnly = /^(\d+(?:\.\d+)?)\s+(.+)$/;
  const wordOnly = new RegExp(`^(${Object.keys(NUMBER_WORDS).join('|')})\\s+(.+)$`, 'i');

  let match = trimmed.match(numericWithUnit);
  if (match) {
    return {
      quantityValue: parseFloat(match[1]),
      quantityUnit: match[2].toLowerCase(),
      rest: match[3].trim(),
    };
  }

  match = trimmed.match(wordWithUnit);
  if (match) {
    return {
      quantityValue: NUMBER_WORDS[match[1].toLowerCase()],
      quantityUnit: match[2].toLowerCase(),
      rest: match[3].trim(),
    };
  }

  match = trimmed.match(numericOnly);
  if (match) {
    return {
      quantityValue: parseFloat(match[1]),
      quantityUnit: null,
      rest: match[2].trim(),
    };
  }

  match = trimmed.match(wordOnly);
  if (match) {
    return {
      quantityValue: NUMBER_WORDS[match[1].toLowerCase()],
      quantityUnit: null,
      rest: match[2].trim(),
    };
  }

  return { quantityValue: null, quantityUnit: null, rest: trimmed };
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...new Array(cols - 1).fill(0),
  ]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost
      );
    }
  }
  return dist[rows - 1][cols - 1];
}

/** 0 (no similarity) to 1 (identical) string similarity ratio. */
export function stringSimilarity(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(left, right) / maxLen;
}

function singularize(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Finds the best-matching canonical food for a free-text phrase, if any. */
export function matchCanonicalFood(
  phrase: string,
  canonicalFoods: CanonicalFood[]
): { food: CanonicalFood | null; score: number } {
  const candidates = [phrase, singularize(phrase)];

  let best: CanonicalFood | null = null;
  let bestScore = 0;

  for (const food of canonicalFoods) {
    const names = [food.canonical_name, ...food.aliases];
    for (const name of names) {
      for (const candidate of candidates) {
        const score = stringSimilarity(candidate, name);
        if (score > bestScore) {
          bestScore = score;
          best = food;
        }
      }
    }
  }

  if (bestScore < MATCH_THRESHOLD) {
    return { food: null, score: bestScore };
  }
  return { food: best, score: bestScore };
}

/**
 * Parses freeform Quick Add text (e.g. "2 chicken breasts, milk, onions,
 * cilantro and rice") into a list of items with best-effort canonical food
 * matches. Every result is a suggestion — the caller should surface these to
 * the user for confirmation before saving anything.
 */
export function parseQuickAddText(
  text: string,
  canonicalFoods: CanonicalFood[]
): ParsedQuickAddItem[] {
  return splitQuickAddText(text).map((phrase) => {
    const { quantityValue, quantityUnit, rest } = extractQuantity(phrase);
    const { food, score } = matchCanonicalFood(rest, canonicalFoods);

    return {
      rawText: phrase,
      displayName: rest || phrase,
      quantityValue,
      quantityUnit,
      canonicalFood: food,
      matchScore: score,
    };
  });
}
