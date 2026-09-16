import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import type { RecipeSuggestion } from '../types/recipe';

interface Props {
  recipe: RecipeSuggestion;
  onPress: () => void;
  /** Compact = Home's horizontal-scroll suggestion cards; full = the richer
   * card Sous Chef renders inline in chat. */
  variant?: 'compact' | 'full';
}

function totalTimeLabel(prepTime: number | null, cookTime: number | null): string | null {
  const total = (prepTime ?? 0) + (cookTime ?? 0);
  return total > 0 ? `${total} min` : null;
}

export function RecipeCard({ recipe, onPress, variant = 'full' }: Props) {
  const timeLabel = totalTimeLabel(recipe.prep_time, recipe.cook_time);
  const isCompact = variant === 'compact';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isCompact && styles.cardCompact,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.imagePlaceholder}>
        <Ionicons name="restaurant-outline" size={28} color={colors.textMuted} />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {recipe.title}
      </Text>

      <View style={styles.metaRow}>
        {timeLabel && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{timeLabel}</Text>
          </View>
        )}
        {recipe.servings != null && (
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{recipe.servings}</Text>
          </View>
        )}
      </View>

      <View style={styles.coveragePill}>
        <Text style={styles.coverageText}>Uses {recipe.pantry_coverage_label} you own</Text>
      </View>

      {recipe.rescued_ingredient_names.length > 0 && (
        <Text style={styles.rescueText} numberOfLines={1}>
          Rescues: {recipe.rescued_ingredient_names.join(', ')}
        </Text>
      )}

      {recipe.missing_ingredient_count > 0 && (
        <Text style={styles.missingText}>
          {recipe.missing_ingredient_count} ingredient{recipe.missing_ingredient_count === 1 ? '' : 's'} missing
        </Text>
      )}

      {!isCompact && (
        <Text style={styles.whyText} numberOfLines={3}>
          {recipe.why_this_works}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCompact: {
    width: 200,
    marginRight: spacing.sm,
  },
  cardPressed: {
    opacity: 0.7,
  },
  imagePlaceholder: {
    height: 90,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  coveragePill: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}1A`,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginTop: 2,
  },
  coverageText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  rescueText: {
    fontSize: 12,
    color: colors.uncertain,
  },
  missingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  whyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
