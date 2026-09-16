import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import { formatQuantity, isUncertain } from '../lib/formatInventory';
import type { InventoryItem } from '../types/database';
import { UncertaintyBadge } from './UncertaintyBadge';

interface Props {
  item: InventoryItem;
  onPress: () => void;
  onDelete: () => void;
  /** Quick-confirm without opening the full edit screen — only rendered
   * when the item is uncertain. Correcting a field still happens via
   * onPress (the edit screen), which also clears the flag on save. */
  onVerify: () => void;
  /** Only rendered for preparation_state === 'leftover' items — logs
   * nutrition (if traceable to a recipe) and removes the item, same as
   * Kitchen Check-In's "Ate It" (see lib/nutritionLogging.ts). */
  onAte: () => void;
}

export function InventoryItemRow({ item, onPress, onDelete, onVerify, onAte }: Props) {
  const uncertain = isUncertain(item);
  const isLeftover = item.preparation_state === 'leftover';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.info}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {item.display_name}
          </Text>
          {uncertain && <UncertaintyBadge />}
        </View>
        <Text style={styles.quantity}>{formatQuantity(item)}</Text>
      </View>
      {uncertain && (
        <Pressable
          onPress={onVerify}
          hitSlop={12}
          style={styles.verifyButton}
          accessibilityRole="button"
          accessibilityLabel={`Verify ${item.display_name}`}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
        </Pressable>
      )}
      {isLeftover && (
        <Pressable
          onPress={onAte}
          hitSlop={12}
          style={styles.ateButton}
          accessibilityRole="button"
          accessibilityLabel={`I ate ${item.display_name}`}
        >
          <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
        </Pressable>
      )}
      <Pressable
        onPress={onDelete}
        hitSlop={12}
        style={styles.deleteButton}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.display_name}`}
      >
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  rowPressed: {
    opacity: 0.7,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  quantity: {
    fontSize: 14,
    color: colors.textMuted,
  },
  verifyButton: {
    padding: spacing.xs,
  },
  ateButton: {
    padding: spacing.xs,
  },
  deleteButton: {
    padding: spacing.xs,
  },
});
