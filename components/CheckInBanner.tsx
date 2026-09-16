import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

/** Unobtrusive by design — this is the only entry point into Check-In, it
 * never auto-launches, and it's simply absent (see Home) when nothing
 * needs review rather than showing an empty/zero state. */
export function CheckInBanner({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} items to check`}
    >
      <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
      <Text style={styles.label}>
        {count} item{count === 1 ? '' : 's'} to check
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.primary}14`,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  bannerPressed: {
    opacity: 0.7,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
