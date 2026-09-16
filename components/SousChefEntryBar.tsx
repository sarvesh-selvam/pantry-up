import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

export function SousChefEntryBar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ask Sous Chef"
    >
      <Ionicons name="sparkles-outline" size={18} color={colors.primaryText} />
      <Text style={styles.label}>Ask Sous Chef what to cook…</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  barPressed: {
    opacity: 0.85,
  },
  label: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
});
