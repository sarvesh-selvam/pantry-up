import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  createShoppingItems,
  deleteShoppingItems,
  fetchRecipeTitles,
  fetchShoppingItems,
  setShoppingItemsChecked,
  updateShoppingItem,
} from '../api/shoppingItems';
import { useAuth } from '../auth/AuthContext';
import { useInventory } from '../inventory/InventoryContext';
import { parseQuickAddText } from '../quickAddParser';
import { findExactCanonicalMatch, partitionMissingIngredients } from './shoppingListLogic';
import type { ShoppingItem, ShoppingItemInsert } from '../../types/database';
import type { Recipe, RecipeIngredient } from '../../types/recipe';

interface AddFromRecipeResult {
  addedCount: number;
  alreadyListedNames: string[];
}

interface ShoppingListContextValue {
  items: ShoppingItem[];
  /** recipe id → title, for the "from <recipe>" tag on recipe-sourced items. */
  recipeTitles: Map<string, string>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTypedItem: (text: string) => Promise<void>;
  addMissingFromRecipe: (recipe: Recipe, missing: RecipeIngredient[]) => Promise<AddFromRecipeResult>;
  toggleChecked: (id: string) => Promise<void>;
  setChecked: (ids: string[], isChecked: boolean) => Promise<void>;
  removeItems: (ids: string[]) => Promise<void>;
}

const ShoppingListContext = createContext<ShoppingListContextValue | undefined>(undefined);

/**
 * Nested inside InventoryProvider at the root (not just the Pantry stack)
 * because the recipe detail screen — outside (tabs) — adds Missing
 * ingredients here, and Pantry's Need to Buy view should reflect that
 * without a refetch.
 *
 * Nothing in here ever writes to inventory_items. The only path from this
 * list into real inventory is app/(tabs)/pantry/shopping-review.tsx, behind
 * the user's explicit confirmation.
 */
export function ShoppingListProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { canonicalFoods } = useInventory();

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [recipeTitles, setRecipeTitles] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const shoppingItems = await fetchShoppingItems();
      const recipeIds = [
        ...new Set(shoppingItems.map((item) => item.source_recipe_id).filter((id): id is string => !!id)),
      ];
      setItems(shoppingItems);
      setRecipeTitles(await fetchRecipeTitles(recipeIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping list');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    } else {
      setItems([]);
      setRecipeTitles(new Map());
      setIsLoading(false);
    }
  }, [userId, refresh]);

  const insertItems = useCallback(
    async (toInsert: ShoppingItemInsert[]) => {
      if (!userId) throw new Error('Not signed in');
      if (toInsert.length === 0) return [];
      const created = await createShoppingItems(userId, toInsert);
      setItems((prev) => [...prev, ...created]);
      return created;
    },
    [userId]
  );

  /**
   * Attempts a canonical match but never blocks saving on one: an exact
   * name/alias hit is instant; otherwise the same quick-add-parse Edge
   * Function Quick Add uses (which also splits "milk, eggs" and pulls out
   * "2 lemons"-style quantities); if that fails, the text is saved as-is,
   * uncategorized.
   */
  const addTypedItem = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const exact = findExactCanonicalMatch(trimmed, canonicalFoods);
      if (exact) {
        await insertItems([
          {
            canonical_food_id: exact.id,
            display_name: trimmed,
            category: exact.category,
            quantity_value: null,
            quantity_unit: null,
            source: 'manual',
            source_recipe_id: null,
          },
        ]);
        return;
      }

      let parsed: Awaited<ReturnType<typeof parseQuickAddText>> = [];
      try {
        parsed = await parseQuickAddText(trimmed, canonicalFoods);
      } catch (err) {
        console.warn('Shopping list match failed, saving unmatched', err);
      }

      if (parsed.length === 0) {
        await insertItems([
          {
            canonical_food_id: null,
            display_name: trimmed,
            category: null,
            quantity_value: null,
            quantity_unit: null,
            source: 'manual',
            source_recipe_id: null,
          },
        ]);
        return;
      }

      await insertItems(
        parsed.map((item) => ({
          canonical_food_id: item.canonicalFood?.id ?? null,
          display_name: item.displayName,
          category: item.canonicalFood?.category ?? null,
          quantity_value: item.quantityValue,
          quantity_unit: item.quantityUnit,
          source: 'manual',
          source_recipe_id: null,
        }))
      );
    },
    [canonicalFoods, insertItems]
  );

  const addMissingFromRecipe = useCallback(
    async (recipe: Recipe, missing: RecipeIngredient[]): Promise<AddFromRecipeResult> => {
      const { toAdd, alreadyListed } = partitionMissingIngredients(missing, items);
      const foodsById = new Map(canonicalFoods.map((food) => [food.id, food]));
      await insertItems(
        toAdd.map((ingredient) => ({
          canonical_food_id: ingredient.canonical_food_id,
          display_name: ingredient.display_name,
          category: ingredient.canonical_food_id
            ? (foodsById.get(ingredient.canonical_food_id)?.category ?? null)
            : null,
          quantity_value: ingredient.quantity_value,
          quantity_unit: ingredient.quantity_unit,
          source: 'recipe',
          source_recipe_id: recipe.id,
        }))
      );
      if (toAdd.length > 0) {
        setRecipeTitles((prev) => new Map(prev).set(recipe.id, recipe.title));
      }
      return {
        addedCount: toAdd.length,
        alreadyListedNames: alreadyListed.map((ingredient) => ingredient.display_name),
      };
    },
    [items, canonicalFoods, insertItems]
  );

  const toggleChecked = useCallback(
    async (id: string) => {
      const current = items.find((item) => item.id === id);
      if (!current) return;
      const nextValue = !current.is_checked;
      // Optimistic — ticking items off while walking the aisles should feel instant.
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_checked: nextValue } : item)));
      try {
        await updateShoppingItem(id, { is_checked: nextValue });
      } catch (err) {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_checked: !nextValue } : item)));
        throw err;
      }
    },
    [items]
  );

  const setChecked = useCallback(async (ids: string[], isChecked: boolean) => {
    await setShoppingItemsChecked(ids, isChecked);
    const idSet = new Set(ids);
    setItems((prev) => prev.map((item) => (idSet.has(item.id) ? { ...item, is_checked: isChecked } : item)));
  }, []);

  const removeItems = useCallback(async (ids: string[]) => {
    await deleteShoppingItems(ids);
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((item) => !idSet.has(item.id)));
  }, []);

  const value = useMemo<ShoppingListContextValue>(
    () => ({
      items,
      recipeTitles,
      isLoading,
      error,
      refresh,
      addTypedItem,
      addMissingFromRecipe,
      toggleChecked,
      setChecked,
      removeItems,
    }),
    [items, recipeTitles, isLoading, error, refresh, addTypedItem, addMissingFromRecipe, toggleChecked, setChecked, removeItems]
  );

  return <ShoppingListContext.Provider value={value}>{children}</ShoppingListContext.Provider>;
}

export function useShoppingList() {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) throw new Error('useShoppingList must be used within a ShoppingListProvider');
  return ctx;
}
