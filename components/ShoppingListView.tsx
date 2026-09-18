import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { colors, radii, spacing } from '../constants/theme';
import { useShoppingList } from '../lib/shoppingList/ShoppingListContext';
import { groupShoppingItems } from '../lib/shoppingList/shoppingListLogic';
import type { ShoppingItem } from '../types/database';

function formatShoppingQuantity(item: ShoppingItem): string | null {
  if (item.quantity_value != null) {
    return `${item.quantity_value}${item.quantity_unit ? ` ${item.quantity_unit}` : ''}`;
  }
  return item.quantity_unit;
}

/** Pantry's "Need to Buy" view. Checking a box only toggles is_checked —
 * inventory is only ever touched from the Review & Add to Pantry screen. */
export function ShoppingListView() {
  const router = useRouter();
  const { items, recipeTitles, isLoading, error, refresh, addTypedItem, toggleChecked, removeItems } =
    useShoppingList();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const sections = useMemo(() => groupShoppingItems(items), [items]);
  const checkedCount = items.filter((item) => item.is_checked).length;

  async function handleAdd() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      await addTypedItem(text);
      setDraft('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setAdding(false);
    }
  }

  function handleToggle(item: ShoppingItem) {
    toggleChecked(item.id).catch((err) => Alert.alert('Error', err.message));
  }

  function confirmRemove(item: ShoppingItem) {
    Alert.alert('Remove item', `Take "${item.display_name}" off your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeItems([item.id]).catch((err) => Alert.alert('Error', err.message)),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.addBar}>
        <Ionicons name="add" size={20} color={colors.primary} />
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add Item"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          editable={!adding}
          accessibilityLabel="Add an item to your shopping list"
        />
        {adding ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          draft.trim().length > 0 && (
            <Pressable onPress={handleAdd} hitSlop={12} accessibilityRole="button" accessibilityLabel="Add">
              <Text style={styles.addButtonLabel}>Add</Text>
            </Pressable>
          )
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {isLoading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="basket-outline" size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>Nothing to pick up</Text>
          <Text style={styles.emptySubtitle}>
            Jot down what you're running low on, or add a recipe's missing ingredients from its page.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }) => {
            const quantity = formatShoppingQuantity(item);
            const recipeTitle = item.source_recipe_id ? recipeTitles.get(item.source_recipe_id) : undefined;
            return (
              <Pressable
                style={styles.row}
                onPress={() => handleToggle(item)}
                onLongPress={() => confirmRemove(item)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.is_checked }}
                accessibilityHint="Long press to remove from the list"
              >
                <Ionicons
                  name={item.is_checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={item.is_checked ? colors.primary : colors.textMuted}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.name, item.is_checked && styles.nameChecked]}>{item.display_name}</Text>
                  {recipeTitle && (
                    <Pressable
                      onPress={() => router.push(`/recipe/${item.source_recipe_id}`)}
                      hitSlop={6}
                      accessibilityRole="link"
                    >
                      <Text style={styles.recipeTag} numberOfLines={1}>
                        from {recipeTitle}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {quantity && <Text style={styles.quantity}>{quantity}</Text>}
              </Pressable>
            );
          }}
        />
      )}

      {checkedCount > 0 && (
        <View style={styles.reviewBar}>
          <Pressable
            style={styles.reviewButton}
            onPress={() => router.push('/(tabs)/pantry/shopping-review')}
            accessibilityRole="button"
          >
            <Ionicons name="bag-check-outline" size={18} color={colors.primaryText} />
            <Text style={styles.reviewButtonLabel}>
              Review & Add to Pantry ({checkedCount})
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  addButtonLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    color: colors.text,
  },
  nameChecked: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  recipeTag: {
    fontSize: 12,
    color: colors.primary,
  },
  quantity: {
    fontSize: 14,
    color: colors.textMuted,
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
    marginTop: spacing.xs,
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
  reviewBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 4,
  },
  reviewButtonLabel: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
});
