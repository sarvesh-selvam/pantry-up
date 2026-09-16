import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import type { RecipeSuggestion } from '../types/recipe';

interface Props {
  recipe: RecipeSuggestion;
  onPress: () => void;
  /** Compact = Home's horizontal-scroll suggestion cards; full = the richer
   * card Sous Chef renders inline in chat. */
  variant?: 'compact' | 'full';
  /** Overrides cardCompact's fixed 200px width — used by Cookbook's
   * 2-column grid, which needs cards to fill their column instead. */
  style?: StyleProp<ViewStyle>;
}

function totalTimeLabel(prepTime: number | null, cookTime: number | null): string | null {
  const total = (prepTime ?? 0) + (cookTime ?? 0);
  return total > 0 ? `${total} min` : null;
}

export function RecipeCard({ recipe, onPress, variant = 'full', style }: Props) {
  const timeLabel = totalTimeLabel(recipe.prep_time, recipe.cook_time);
  const isCompact = variant === 'compact';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isCompact && styles.cardCompact,
        pressed && styles.cardPressed,
        style,
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

      {!isCompact && recipe.why_bullets.length > 0 ? (
        <View style={styles.whyBullets}>
          {recipe.why_bullets.map((bullet, index) => (
            <Text key={index} style={styles.whyBulletText} numberOfLines={2}>
              • {bullet}
            </Text>
          ))}
        </View>
      ) : (
        !isCompact && (
          <Text style={styles.whyText} numberOfLines={3}>
            {recipe.why_this_works}
          </Text>
        )
      )}

      {!isCompact && recipe.youtube_metadata && recipe.youtube_metadata.results.length > 0 && (
        <View style={styles.videoRow}>
          {recipe.youtube_metadata.results.slice(0, 2).map((video) => (
            <View key={video.video_id} style={styles.videoItem}>
              <Image source={{ uri: video.thumbnail_url }} style={styles.videoThumb} />
              <Text style={styles.videoTitle} numberOfLines={2}>
                {video.title}
              </Text>
            </View>
          ))}
        </View>
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
  whyBullets: {
    marginTop: spacing.xs,
    gap: 2,
  },
  whyBulletText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  videoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  videoItem: {
    flex: 1,
    gap: 2,
  },
  videoThumb: {
    width: '100%',
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  videoTitle: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
