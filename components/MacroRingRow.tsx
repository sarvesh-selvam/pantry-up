import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

interface Props {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** compact = Home's small glanceable summary; full = the Macros tab. */
  size?: 'compact' | 'full';
}

const RING_COLORS = {
  calories: colors.primary,
  protein: colors.uncertain,
  carbs: '#4A7FE0',
  fat: '#C4432B',
};

/**
 * A "ring-style" visualization per the product spec, kept deliberately
 * simple: circular badges with the day's totals, not a percent-of-goal
 * progress fill — there's no goal/target data model yet (no
 * personalization scoped), so a true fill-percentage ring would either be
 * meaningless or imply a target PantryUp hasn't actually set. Friendly and
 * glanceable, not a fitness-app dashboard, per spec.
 */
export function MacroRingRow({ calories, proteinG, carbsG, fatG, size = 'full' }: Props) {
  const isCompact = size === 'compact';
  const diameter = isCompact ? 52 : 72;

  return (
    <View style={styles.row}>
      <Ring
        diameter={diameter}
        color={RING_COLORS.calories}
        value={Math.round(calories)}
        label="Calories"
        compact={isCompact}
      />
      <Ring
        diameter={diameter}
        color={RING_COLORS.protein}
        value={`${Math.round(proteinG)}g`}
        label="Protein"
        compact={isCompact}
      />
      <Ring
        diameter={diameter}
        color={RING_COLORS.carbs}
        value={`${Math.round(carbsG)}g`}
        label="Carbs"
        compact={isCompact}
      />
      <Ring diameter={diameter} color={RING_COLORS.fat} value={`${Math.round(fatG)}g`} label="Fat" compact={isCompact} />
    </View>
  );
}

function Ring({
  diameter,
  color,
  value,
  label,
  compact,
}: {
  diameter: number;
  color: string;
  value: number | string;
  label: string;
  compact: boolean;
}) {
  return (
    <View style={styles.ringWrapper}>
      <View
        style={[
          styles.ring,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderColor: color,
          },
        ]}
      >
        <Text style={[styles.ringValue, compact && styles.ringValueCompact]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ringWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  ring: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
  },
  ringValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  ringValueCompact: {
    fontSize: 11,
  },
  ringLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
