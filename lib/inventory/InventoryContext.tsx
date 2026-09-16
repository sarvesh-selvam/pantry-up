import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { fetchCanonicalFoods } from '../api/canonicalFoods';
import { fetchFoodStorageRules } from '../api/foodStorageRules';
import {
  createInventoryItem,
  createInventoryItems,
  deleteInventoryItem,
  fetchInventoryItems,
  updateInventoryItem,
} from '../api/inventory';
import { useAuth } from '../auth/AuthContext';
import type {
  CanonicalFood,
  FoodStorageRule,
  InventoryItem,
  InventoryItemInsert,
  InventoryItemUpdate,
} from '../../types/database';
import type { QuickAddDraftItem } from '../../types/quickAdd';

interface InventoryContextValue {
  items: InventoryItem[];
  canonicalFoods: CanonicalFood[];
  foodStorageRules: FoodStorageRule[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (item: InventoryItemInsert) => Promise<InventoryItem>;
  editItem: (id: string, updates: InventoryItemUpdate) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  quickAddDraft: QuickAddDraftItem[];
  setQuickAddDraft: (items: QuickAddDraftItem[]) => void;
  saveQuickAddItems: (items: QuickAddDraftItem[]) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

export function InventoryProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [canonicalFoods, setCanonicalFoods] = useState<CanonicalFood[]>([]);
  const [foodStorageRules, setFoodStorageRules] = useState<FoodStorageRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickAddDraft, setQuickAddDraft] = useState<QuickAddDraftItem[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [inventoryItems, foods, rules] = await Promise.all([
        fetchInventoryItems(),
        fetchCanonicalFoods(),
        fetchFoodStorageRules(),
      ]);
      setItems(inventoryItems);
      setCanonicalFoods(foods);
      setFoodStorageRules(rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pantry data');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refresh();
    } else {
      setItems([]);
      setCanonicalFoods([]);
      setFoodStorageRules([]);
      setIsLoading(false);
    }
  }, [userId, refresh]);

  const addItem = useCallback(
    async (item: InventoryItemInsert) => {
      if (!userId) throw new Error('Not signed in');
      const created = await createInventoryItem(userId, item);
      setItems((prev) => [...prev, created]);
      return created;
    },
    [userId]
  );

  const editItem = useCallback(async (id: string, updates: InventoryItemUpdate) => {
    const updated = await updateInventoryItem(id, updates);
    setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await deleteInventoryItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const saveQuickAddItems = useCallback(async (draftItems: QuickAddDraftItem[]) => {
    if (!userId) throw new Error('Not signed in');
    const toInsert: InventoryItemInsert[] = draftItems
      .filter((draft) => draft.included)
      .map((draft) => ({
        canonical_food_id: draft.canonicalFoodId,
        display_name: draft.displayName,
        category: draft.category,
        quantity_value: draft.quantityValue,
        quantity_unit: draft.quantityUnit,
        quantity_confidence: 'estimated',
        quantity_state: null,
        preparation_state: 'raw',
        storage_location: 'fridge',
        source: draft.source,
        raw_input_text: draft.rawText,
        purchased_at: null,
        opened_at: null,
        expiry_user_provided: null,
        expiry_estimated: null,
        verification_status: 'needs_verification',
        last_verified_at: null,
      }));

    if (toInsert.length === 0) {
      setQuickAddDraft([]);
      return;
    }

    const created = await createInventoryItems(userId, toInsert);
    setItems((prev) => [...prev, ...created]);
    setQuickAddDraft([]);
  }, [userId]);

  const value = useMemo<InventoryContextValue>(
    () => ({
      items,
      canonicalFoods,
      foodStorageRules,
      isLoading,
      error,
      refresh,
      addItem,
      editItem,
      removeItem,
      quickAddDraft,
      setQuickAddDraft,
      saveQuickAddItems,
    }),
    [
      items,
      canonicalFoods,
      foodStorageRules,
      isLoading,
      error,
      refresh,
      addItem,
      editItem,
      removeItem,
      quickAddDraft,
      saveQuickAddItems,
    ]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within an InventoryProvider');
  return ctx;
}
