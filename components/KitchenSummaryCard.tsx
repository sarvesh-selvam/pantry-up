import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

interface Props {
  summary: string;
}

/**
 * A short AI narration of what's in Rescue Row + today's suggestions —
 * grounded in real data the model was given (see
 * supabase/functions/kitchen-summary/index.ts), never invented flavor
 * text. Deliberately styled as a distinct dark accent card rather than
 * the app's usual light surface, so it reads as a single glanceable
 * moment, not another list section.
 */
export function KitchenSummaryCard({ summary }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.dot} />
        <Text style={styles.headerText}>SOUS CHEF · RANKED YOUR KITCHEN</Text>
      </View>
      <Text style={styles.summaryText}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.cardDarkMuted,
    letterSpacing: 0.6,
  },
  summaryText: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    color: colors.cardDarkText,
  },
});
