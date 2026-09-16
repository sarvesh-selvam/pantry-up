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
  InventoryItem,
  InventoryItemInsert,
  InventoryItemUpdate,
} from '../../types/database';
import type { QuickAddDraftItem } from '../../types/quickAdd';

interface InventoryContextValue {
  items: InventoryItem[];
  canonicalFoods: CanonicalFood[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (item: InventoryItemInsert) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickAddDraft, setQuickAddDraft] = useState<QuickAddDraftItem[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [inventoryItems, foods] = await Promise.all([
        fetchInventoryItems(),
        fetchCanonicalFoods(),
      ]);
      setItems(inventoryItems);
      setCanonicalFoods(foods);
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
      setIsLoading(false);
    }
  }, [userId, refresh]);

  const addItem = useCallback(
    async (item: InventoryItemInsert) => {
      if (!userId) throw new Error('Not signed in');
      const created = await createInventoryItem(userId, item);
      setItems((prev) => [...prev, created]);
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
        source: 'quick_add',
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
