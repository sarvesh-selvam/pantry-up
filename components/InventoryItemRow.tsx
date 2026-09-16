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
}

export function InventoryItemRow({ item, onPress, onDelete }: Props) {
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
          {isUncertain(item) && <UncertaintyBadge />}
        </View>
        <Text style={styles.quantity}>{formatQuantity(item)}</Text>
      </View>
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
  deleteButton: {
    padding: spacing.xs,
  },
});
