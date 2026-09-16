import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { UncertaintyBadge } from '../../../components/UncertaintyBadge';
import { colors, radii, spacing } from '../../../constants/theme';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import type { QuickAddDraftItem } from '../../../types/quickAdd';

export default function QuickAddReviewScreen() {
  const router = useRouter();
  const { quickAddDraft, saveQuickAddItems, canonicalFoods } = useInventory();
  const [draft, setDraft] = useState<QuickAddDraftItem[]>(quickAddDraft);
  const [saving, setSaving] = useState(false);

  function updateItem(key: string, updates: Partial<QuickAddDraftItem>) {
    setDraft((prev) => prev.map((item) => (item.key === key ? { ...item, ...updates } : item)));
  }

  function removeItem(key: string) {
    setDraft((prev) => prev.filter((item) => item.key !== key));
  }

  const includedCount = draft.filter((item) => item.included).length;

  async function handleConfirm() {
    if (includedCount === 0) {
      Alert.alert('Nothing selected', 'Select at least one item to save, or go back.');
      return;
    }
    setSaving(true);
    try {
      await saveQuickAddItems(draft);
      router.replace('/(tabs)/pantry');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save items');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Review what we parsed. Edit any name, remove items you didn't mean to add, then confirm.
      </Text>
      <FlatList
        data={draft}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const matchedFood = canonicalFoods.find((food) => food.id === item.canonicalFoodId);
          return (
            <View style={[styles.row, !item.included && styles.rowExcluded]}>
              <View style={styles.rowHeader}>
                <UncertaintyBadge />
                <TextInput
                  style={styles.nameInput}
                  value={item.displayName}
                  onChangeText={(text) => updateItem(item.key, { displayName: text })}
                  editable={item.included}
                />
                <Pressable
                  onPress={() => removeItem(item.key)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.displayName}`}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
              <Text style={styles.rawText}>Parsed from: "{item.rawText}"</Text>
              <Text style={styles.matchText}>
                {matchedFood
                  ? `Matched to: ${matchedFood.canonical_name}`
                  : 'No canonical match — will save as-is'}
              </Text>
              <View style={styles.quantityRow}>
                <TextInput
                  style={styles.quantityInput}
                  value={item.quantityValue != null ? String(item.quantityValue) : ''}
                  onChangeText={(text) =>
                    updateItem(item.key, {
                      quantityValue: text.trim() ? Number(text) || null : null,
                    })
                  }
                  placeholder="Qty"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  editable={item.included}
                />
                <TextInput
                  style={styles.quantityInput}
                  value={item.quantityUnit ?? ''}
                  onChangeText={(text) => updateItem(item.key, { quantityUnit: text || null })}
                  placeholder="Unit"
                  placeholderTextColor={colors.textMuted}
                  editable={item.included}
                />
                <Pressable
                  style={styles.toggle}
                  onPress={() => updateItem(item.key, { included: !item.included })}
                >
                  <Text style={styles.toggleLabel}>{item.included ? 'Included' : 'Skipped'}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.footer}>
        <PrimaryButton
          label={`Save ${includedCount} item${includedCount === 1 ? '' : 's'}`}
          onPress={handleConfirm}
          loading={saving}
          disabled={includedCount === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    padding: spacing.md,
    paddingBottom: 0,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
    marginBottom: spacing.sm,
  },
  rowExcluded: {
    opacity: 0.5,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 2,
  },
  rawText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  matchText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignItems: 'center',
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
  toggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
