import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { OptionPicker } from '../../../components/OptionPicker';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { colors, radii, spacing } from '../../../constants/theme';
import { STORAGE_LOCATION_LABELS, STORAGE_LOCATION_ORDER } from '../../../lib/formatInventory';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import { useShoppingList } from '../../../lib/shoppingList/ShoppingListContext';
import { defaultStorageLocation } from '../../../lib/shoppingList/shoppingListLogic';
import type {
  FoodCategory,
  InventoryItemInsert,
  QuantityState,
  StorageLocation,
} from '../../../types/database';

const QUANTITY_STATE_OPTIONS: { value: QuantityState; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'mostly_full', label: 'Mostly full' },
  { value: 'half', label: 'Half' },
  { value: 'low', label: 'Low' },
  { value: 'almost_empty', label: 'Almost empty' },
];

const STORAGE_OPTIONS = STORAGE_LOCATION_ORDER.map((value) => ({
  value,
  label: STORAGE_LOCATION_LABELS[value],
}));

interface ReviewDraft {
  shoppingItemId: string;
  displayName: string;
  canonicalFoodId: string | null;
  category: FoodCategory | null;
  quantityValue: string;
  quantityUnit: string;
  quantityState: QuantityState;
  storageLocation: StorageLocation;
  included: boolean;
}

/**
 * The only path from the shopping list into real inventory — nothing is
 * written until the user taps confirm. Included items become new
 * inventory_items (verification_status 'confirmed', since the user is
 * confirming them right here) and are deleted from the list; excluded
 * items go back to unchecked, still on the list.
 *
 * Always creates new inventory rows rather than merging into an existing
 * one for the same food: a fresh purchase has its own purchased_at, so it
 * gets its own expiry estimate and Rescue Row keeps treating the older
 * batch as older.
 */
export default function ShoppingReviewScreen() {
  const router = useRouter();
  const { addItem } = useInventory();
  const { items, removeItems, setChecked } = useShoppingList();

  // Snapshot once, same as Check-In: the list being reviewed shouldn't
  // shift underneath the user while they edit it.
  const [drafts, setDrafts] = useState<ReviewDraft[]>(() =>
    items
      .filter((item) => item.is_checked)
      .map((item) => ({
        shoppingItemId: item.id,
        displayName: item.display_name,
        canonicalFoodId: item.canonical_food_id,
        category: item.category,
        quantityValue: item.quantity_value != null ? String(item.quantity_value) : '',
        quantityUnit: item.quantity_unit ?? '',
        quantityState: 'full',
        storageLocation: defaultStorageLocation(item.category),
        included: true,
      }))
  );
  const [saving, setSaving] = useState(false);

  function updateDraft(id: string, updates: Partial<ReviewDraft>) {
    setDrafts((prev) => prev.map((draft) => (draft.shoppingItemId === id ? { ...draft, ...updates } : draft)));
  }

  const included = drafts.filter((draft) => draft.included);
  const excluded = drafts.filter((draft) => !draft.included);

  async function handleConfirm() {
    for (const draft of included) {
      if (draft.quantityValue.trim() && Number.isNaN(Number(draft.quantityValue))) {
        Alert.alert('Invalid quantity', `Quantity for "${draft.displayName}" must be a number.`);
        return;
      }
    }

    setSaving(true);
    const now = new Date().toISOString();
    const results = await Promise.allSettled(
      included.map((draft) => {
        const parsedQuantity = draft.quantityValue.trim() ? Number(draft.quantityValue) : null;
        const insert: InventoryItemInsert = {
          canonical_food_id: draft.canonicalFoodId,
          display_name: draft.displayName,
          category: draft.category,
          quantity_value: parsedQuantity,
          quantity_unit: parsedQuantity != null ? draft.quantityUnit.trim() || null : null,
          quantity_confidence: 'confirmed',
          quantity_state: parsedQuantity == null ? draft.quantityState : null,
          preparation_state: 'raw',
          storage_location: draft.storageLocation,
          source: 'shopping_list',
          raw_input_text: null,
          source_recipe_id: null,
          purchased_at: now,
          opened_at: null,
          expiry_user_provided: null,
          expiry_estimated: null,
          verification_status: 'confirmed',
          last_verified_at: now,
        };
        return addItem(insert);
      })
    );

    const addedIds = included
      .filter((_, index) => results[index].status === 'fulfilled')
      .map((draft) => draft.shoppingItemId);
    const failedNames = included
      .filter((_, index) => results[index].status === 'rejected')
      .map((draft) => draft.displayName);

    try {
      await removeItems(addedIds);
      await setChecked(
        excluded.map((draft) => draft.shoppingItemId),
        false
      );
    } catch (err) {
      console.warn('Failed to update shopping list after adding to pantry', err);
    }
    setSaving(false);

    if (failedNames.length > 0) {
      // Successful ones are already gone from the list; keep the failures
      // checked so the user can retry just those.
      Alert.alert(
        "Some items weren't added",
        `Couldn't add ${failedNames.join(', ')} to your pantry. They're still checked on your list — try again.`
      );
    }
    router.back();
  }

  if (drafts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Nothing checked off yet.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.hint}>
        Check how much you got and where it's going. Skip anything you didn't end up buying — it'll stay on
        your list.
      </Text>
      <FlatList
        data={drafts}
        keyExtractor={(draft) => draft.shoppingItemId}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: draft }) => (
          <View style={[styles.card, !draft.included && styles.cardExcluded]}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{draft.displayName}</Text>
              <Pressable
                style={[styles.toggle, draft.included && styles.toggleIncluded]}
                onPress={() => updateDraft(draft.shoppingItemId, { included: !draft.included })}
                accessibilityRole="switch"
                accessibilityState={{ checked: draft.included }}
              >
                <Text style={[styles.toggleLabel, draft.included && styles.toggleLabelIncluded]}>
                  {draft.included ? 'Adding' : 'Skipped'}
                </Text>
              </Pressable>
            </View>

            {draft.included && (
              <>
                <View style={styles.quantityRow}>
                  <TextInput
                    style={styles.quantityInput}
                    value={draft.quantityValue}
                    onChangeText={(text) => updateDraft(draft.shoppingItemId, { quantityValue: text })}
                    placeholder="Qty"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.quantityInput}
                    value={draft.quantityUnit}
                    onChangeText={(text) => updateDraft(draft.shoppingItemId, { quantityUnit: text })}
                    placeholder="Unit"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                {!draft.quantityValue.trim() && (
                  <OptionPicker
                    label="Or how much"
                    options={QUANTITY_STATE_OPTIONS}
                    value={draft.quantityState}
                    onChange={(value) => updateDraft(draft.shoppingItemId, { quantityState: value })}
                  />
                )}
                <OptionPicker
                  label="Storage location"
                  options={STORAGE_OPTIONS}
                  value={draft.storageLocation}
                  onChange={(value) => updateDraft(draft.shoppingItemId, { storageLocation: value })}
                />
              </>
            )}
          </View>
        )}
      />
      <View style={styles.footer}>
        <PrimaryButton
          label={
            included.length === 0
              ? 'Return all to list'
              : `Add ${included.length} item${included.length === 1 ? '' : 's'} to Pantry`
          }
          onPress={handleConfirm}
          loading={saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    padding: spacing.md,
    paddingBottom: 0,
  },
  listContent: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardExcluded: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  toggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleIncluded: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  toggleLabelIncluded: {
    color: colors.primaryText,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.text,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
