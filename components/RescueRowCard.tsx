import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import type { RescueRowEntry } from '../lib/rescueRow';

const STATUS_COLORS: Record<RescueRowEntry['reason'], string> = {
  expiring: colors.danger,
  leftover: colors.uncertain,
  low_quantity: colors.primary,
};

export function RescueRowCard({ entry, onPress }: { entry: RescueRowEntry; onPress: () => void }) {
  const accentColor = STATUS_COLORS[entry.reason];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.statusPill, { backgroundColor: `${accentColor}1A` }]}>
        <Text style={[styles.statusLabel, { color: accentColor }]}>{entry.statusLabel}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {entry.item.display_name}
      </Text>
      <Text style={styles.detail}>{entry.detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginRight: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.7,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  detail: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
