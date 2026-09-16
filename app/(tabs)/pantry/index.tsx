import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { InventoryItemRow } from '../../../components/InventoryItemRow';
import { colors, spacing } from '../../../constants/theme';
import {
  STORAGE_LOCATION_LABELS,
  STORAGE_LOCATION_ORDER,
} from '../../../lib/formatInventory';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import type { InventoryItem, StorageLocation } from '../../../types/database';

interface Section {
  title: string;
  data: InventoryItem[];
}

export default function PantryListScreen() {
  const router = useRouter();
  const { items, isLoading, error, refresh, removeItem } = useInventory();

  const sections = useMemo<Section[]>(() => {
    const byLocation = new Map<StorageLocation, InventoryItem[]>();
    for (const item of items) {
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
  }, [items]);

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

  return (
    <View style={styles.container}>
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
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {isLoading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Your pantry is empty</Text>
          <Text style={styles.emptySubtitle}>Add an item or try Quick Add to get started.</Text>
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
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
