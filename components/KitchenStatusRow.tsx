import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

interface Props {
  totalItems: number;
  needsCheckIn: number;
  uncertain: number;
}

/** Section D from the product spec — a compact stat row, not a dashboard. */
export function KitchenStatusRow({ totalItems, needsCheckIn, uncertain }: Props) {
  return (
    <View style={styles.row}>
      <StatTile value={totalItems} label="items" />
      <StatTile value={needsCheckIn} label="to check" />
      <StatTile value={uncertain} label="uncertain" />
    </View>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
