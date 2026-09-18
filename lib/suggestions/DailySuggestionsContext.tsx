import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { todayLocalDate } from '../api/dailyNutrition';
import { createRecipe, suggestionToRecipeInsert } from '../api/recipes';
import { fetchHomeSuggestions } from '../api/recipeSuggestions';
import { logRecommendationEvent } from '../api/recommendationEvents';
import { useAuth } from '../auth/AuthContext';
import { useInventory } from '../inventory/InventoryContext';
import type { RecipeSuggestion } from '../../types/recipe';

/** recipe-suggestions returns its candidates already sorted by score, so
 * the day's set is just the top of that list. */
export const MAX_DAILY_SUGGESTIONS = 3;

export interface DailySuggestion {
  suggestion: RecipeSuggestion;
  /** Set once the user saves it to their Cookbook. Suggestions are never
   * written to `recipes` until then. */
  savedRecipeId: string | null;
}

interface CachedDay {
  date: string;
  suggestions: DailySuggestion[];
}

interface DailySuggestionsContextValue {
  suggestions: DailySuggestion[];
  isLoading: boolean;
  error: string | null;
  /** Saves the suggestion at `index` to the Cookbook (once; repeat calls
   * return the same recipe id) and returns the saved recipe's id. */
  saveSuggestion: (index: number) => Promise<string>;
}

const DailySuggestionsContext = createContext<DailySuggestionsContextValue | undefined>(undefined);

function cacheKey(userId: string) {
  return `pantryup:daily-suggestions:${userId}`;
}

async function readCache(userId: string): Promise<CachedDay | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as CachedDay) : null;
  } catch {
    return null;
  }
}

async function writeCache(userId: string, day: CachedDay) {
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(day));
  } catch {
    // Non-fatal — worst case the next launch generates a fresh set.
  }
}

/**
 * The day's AI suggestions, shared by Home and Cook › Suggested so both
 * show the same set and the model is called at most once per day (cached
 * per user in AsyncStorage, keyed by local date). Waits for inventory to
 * load, and skips generation entirely on an empty pantry without caching
 * that, so adding items later the same day still produces suggestions.
 */
export function DailySuggestionsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { items, isLoading: inventoryLoading } = useInventory();
  const hasItems = items.length > 0;

  const [day, setDay] = useState<CachedDay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setDay(null);
      return;
    }
    if (inventoryLoading) return;
    const today = todayLocalDate();
    if (day?.date === today) return;

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const cached = await readCache(userId);
        if (cached?.date === today) {
          if (!cancelled) setDay(cached);
          return;
        }
        if (!hasItems) {
          if (!cancelled) setDay(null);
          return;
        }
        const recipes = (await fetchHomeSuggestions()).slice(0, MAX_DAILY_SUGGESTIONS);
        const fresh: CachedDay = {
          date: today,
          suggestions: recipes.map((suggestion) => ({ suggestion, savedRecipeId: null })),
        };
        await writeCache(userId, fresh);
        if (cancelled) return;
        setDay(fresh);
        // Best-effort, fire-and-forget — logged once per generated set, not
        // per screen view. See db/migrations/0017 for why this signal needs
        // its own event log.
        for (const recipe of recipes) {
          logRecommendationEvent(userId, recipe.title, recipe.cuisine, 'shown').catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load suggestions');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately keyed on hasItems, not items: regenerating on every
    // inventory edit would be an LLM call per edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, inventoryLoading, hasItems]);

  const saveSuggestion = useCallback(
    async (index: number): Promise<string> => {
      const entry = day?.suggestions[index];
      if (!userId || !day || !entry) throw new Error('Suggestion not found');
      if (entry.savedRecipeId) return entry.savedRecipeId;

      const saved = await createRecipe(
        userId,
        suggestionToRecipeInsert(entry.suggestion, 'Daily suggestion (no specific request)')
      );
      logRecommendationEvent(userId, entry.suggestion.title, entry.suggestion.cuisine, 'tapped').catch(() => {});

      const next: CachedDay = {
        ...day,
        suggestions: day.suggestions.map((s, i) => (i === index ? { ...s, savedRecipeId: saved.id } : s)),
      };
      setDay(next);
      await writeCache(userId, next);
      return saved.id;
    },
    [day, userId]
  );

  return (
    <DailySuggestionsContext.Provider
      value={{ suggestions: day?.suggestions ?? [], isLoading, error, saveSuggestion }}
    >
      {children}
    </DailySuggestionsContext.Provider>
  );
}

export function useDailySuggestions() {
  const ctx = useContext(DailySuggestionsContext);
  if (!ctx) throw new Error('useDailySuggestions must be used within a DailySuggestionsProvider');
  return ctx;
}
