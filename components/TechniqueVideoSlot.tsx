import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

/** Empty placeholder — real technique video lookup arrives in Phase 7
 * (YouTube integration). This just reserves the UI slot per spec. */
export function TechniqueVideoSlot() {
  return (
    <View style={styles.container}>
      <Ionicons name="play-circle-outline" size={20} color={colors.textMuted} />
      <Text style={styles.label}>Technique video — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
