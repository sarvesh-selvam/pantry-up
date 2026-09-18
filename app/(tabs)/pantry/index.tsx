import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InventoryItemRow } from '../../../components/InventoryItemRow';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { ShoppingListView } from '../../../components/ShoppingListView';
import { colors, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth/AuthContext';
import {
  STORAGE_LOCATION_LABELS,
  STORAGE_LOCATION_ORDER,
} from '../../../lib/formatInventory';
import { logItemDisposition } from '../../../lib/api/itemDispositions';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import { logLeftoverConsumption } from '../../../lib/nutritionLogging';
import type { InventoryItem, StorageLocation } from '../../../types/database';

type PantryView = 'kitchen' | 'buy';

const VIEW_SEGMENTS: { value: PantryView; label: string }[] = [
  { value: 'kitchen', label: 'In Kitchen' },
  { value: 'buy', label: 'Need to Buy' },
];

interface Section {
  title: string;
  data: InventoryItem[];
}

export default function PantryListScreen() {
  const router = useRouter();
  // The active view lives in the route params (not local state) so other
  // screens — e.g. recipe detail's "View list" link — can deep-link
  // straight to Need to Buy.
  const params = useLocalSearchParams<{ view?: string }>();
  const view: PantryView = params.view === 'buy' ? 'buy' : 'kitchen';
  const { session } = useAuth();
  const { items, canonicalFoods, isLoading, error, refresh, removeItem, editItem } = useInventory();
  const [query, setQuery] = useState('');

  // Matching against the canonical food's name and aliases (not just what the
  // user typed) is what makes "aubergine" find an item they saved as "eggplant".
  const matchedItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    const foodsById = new Map(canonicalFoods.map((food) => [food.id, food]));
    return items.filter((item) => {
      const food = item.canonical_food_id ? foodsById.get(item.canonical_food_id) : undefined;
      return [item.display_name, item.category, food?.canonical_name, ...(food?.aliases ?? [])].some(
        (field) => field?.toLowerCase().includes(needle)
      );
    });
  }, [items, canonicalFoods, query]);

  const sections = useMemo<Section[]>(() => {
    const byLocation = new Map<StorageLocation, InventoryItem[]>();
    for (const item of matchedItems) {
      const list = byLocation.get(item.storage_location) ?? [];
      list.push(item);
      byLocation.set(item.storage_location, list);
    }
    return STORAGE_LOCATION_ORDER.filter((location) => byLocation.get(location)?.length).map(
      (location) => ({
        title: STORAGE_LOCATION_LABELS[location],
        data: byLocation.get(location) ?? [],
      })
    );
  }, [matchedItems]);

  function confirmDelete(item: InventoryItem) {
    Alert.alert('Delete item', `Remove "${item.display_name}" from your pantry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeItem(item.id).catch((err) => Alert.alert('Error', err.message)),
      },
    ]);
  }

  function verify(item: InventoryItem) {
    editItem(item.id, {
      verification_status: 'confirmed',
      last_verified_at: new Date().toISOString(),
    }).catch((err) => Alert.alert('Error', err.message));
  }

  function confirmAte(item: InventoryItem) {
    Alert.alert('Ate it?', `Remove "${item.display_name}" and log its nutrition?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, I ate it',
        onPress: async () => {
          if (!session) return;
          try {
            const { logged } = await logLeftoverConsumption(item, session.user.id);
            try {
              await logItemDisposition(session.user.id, item, 'consumed', 'pantry_ate');
            } catch (err) {
              console.warn('Failed to log item disposition', err);
            }
            await removeItem(item.id);
            if (!logged) {
              Alert.alert(
                'Removed',
                "Removed from your pantry. Nutrition wasn't logged — no recipe on file for this leftover."
              );
            }
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update pantry');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.segmentWrapper}>
        <SegmentedControl
          segments={VIEW_SEGMENTS}
          value={view}
          onChange={(next) => router.setParams({ view: next })}
        />
      </View>

      {view === 'buy' ? <ShoppingListView /> : renderKitchen()}
    </View>
  );

  function renderKitchen() {
    return (
      <>
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, styles.primaryAction]}
            onPress={() => router.push('/(tabs)/pantry/add')}
          >
            <Ionicons name="add" size={18} color={colors.primaryText} />
            <Text style={styles.primaryActionLabel}>Add Item</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.secondaryAction]}
            onPress={() => router.push('/(tabs)/pantry/quick-add')}
          >
            <Ionicons name="flash-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryActionLabel}>Quick Add</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.secondaryAction]}
            onPress={() => router.push('/(tabs)/pantry/receipt-scan')}
          >
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryActionLabel}>Scan Receipt</Text>
          </Pressable>
        </View>

        {items.length > 0 && (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search your pantry"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="never"
              accessibilityLabel="Search your pantry"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {isLoading && items.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>Your pantry is empty</Text>
            <Text style={styles.emptySubtitle}>Add an item or try Quick Add to get started.</Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptySubtitle}>Nothing in your pantry matches "{query.trim()}".</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <InventoryItemRow
                item={item}
                onPress={() => router.push(`/(tabs)/pantry/${item.id}`)}
                onDelete={() => confirmDelete(item)}
                onVerify={() => verify(item)}
                onAte={() => confirmAte(item)}
              />
            )}
          />
        )}
      </>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  segmentWrapper: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  primaryAction: {
    backgroundColor: colors.primary,
  },
  primaryActionLabel: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryActionLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.md,
  },
});
