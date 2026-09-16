import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../../constants/theme';
import { fetchRecipeById, setRecipeFavorite, updateRecipeYoutubeMetadata } from '../../lib/api/recipes';
import { fetchRecipeVideos, toVideoLookupInput } from '../../lib/api/youtube';
import { useInventory } from '../../lib/inventory/InventoryContext';
import { matchRecipeToInventory } from '../../lib/recipeMatching';
import type { IngredientMatchStatus, Recipe, RecipeIngredient } from '../../types/recipe';

const STATUS_LABELS: Record<IngredientMatchStatus, string> = {
  have: 'Already Have',
  verify: 'Verify',
  missing: 'Missing',
};

const STATUS_ORDER: IngredientMatchStatus[] = ['have', 'verify', 'missing'];

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { items } = useInventory();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videosLoading, setVideosLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoading(true);
    fetchRecipeById(id)
      .then((result) => {
        if (!cancelled) setRecipe(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recipe');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function loadVideos() {
    if (!recipe) return;
    setVideosLoading(true);
    try {
      const youtubeMetadata = await fetchRecipeVideos(toVideoLookupInput(recipe));
      const updated = await updateRecipeYoutubeMetadata(recipe.id, youtubeMetadata);
      setRecipe(updated);
    } catch (err) {
      console.warn('Failed to load technique videos', err);
    } finally {
      setVideosLoading(false);
    }
  }

  // Lazy fetch, once per recipe: only when this recipe has never been
  // looked up before (no cached youtube_metadata). Manual refresh (below)
  // re-runs loadVideos unconditionally. Not re-triggered by the state
  // update loadVideos itself causes, since the dependency is just the id.
  useEffect(() => {
    if (recipe && !recipe.youtube_metadata && !videosLoading) {
      loadVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  // Re-run the matching engine against current inventory rather than
  // trusting the stored snapshot — inventory changes after a recipe is
  // saved, and this is the one screen where staleness would be misleading.
  const groupedIngredients = useMemo(() => {
    if (!recipe) return null;
    const { ingredients } = matchRecipeToInventory(recipe.ingredients, items);
    const groups: Record<IngredientMatchStatus, RecipeIngredient[]> = { have: [], verify: [], missing: [] };
    for (const ingredient of ingredients) {
      groups[ingredient.inventory_match?.status ?? 'missing'].push(ingredient);
    }
    return groups;
  }, [recipe, items]);

  async function toggleFavorite() {
    if (!recipe) return;
    const nextValue = !recipe.is_favorite;
    setRecipe({ ...recipe, is_favorite: nextValue });
    try {
      await setRecipeFavorite(recipe.id, nextValue);
    } catch {
      setRecipe((prev) => (prev ? { ...prev, is_favorite: !nextValue } : prev));
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Recipe not found.'}</Text>
      </View>
    );
  }

  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Pressable
          onPress={toggleFavorite}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={recipe.is_favorite ? 'Unfavorite' : 'Favorite'}
        >
          <Ionicons
            name={recipe.is_favorite ? 'star' : 'star-outline'}
            size={26}
            color={recipe.is_favorite ? colors.uncertain : colors.textMuted}
          />
        </Pressable>
      </View>
      {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

      <View style={styles.metaRow}>
        {recipe.cuisine && <Text style={styles.metaChip}>{recipe.cuisine}</Text>}
        {totalTime > 0 && <Text style={styles.metaChip}>{totalTime} min</Text>}
        {recipe.servings != null && <Text style={styles.metaChip}>Serves {recipe.servings}</Text>}
      </View>

      {recipe.generated_context?.why_this_works && (
        <View style={styles.whyBox}>
          <Text style={styles.whyLabel}>Why this works</Text>
          {recipe.generated_context.why_bullets.length > 0 ? (
            recipe.generated_context.why_bullets.map((bullet, index) => (
              <Text key={index} style={styles.whyText}>
                • {bullet}
              </Text>
            ))
          ) : (
            <Text style={styles.whyText}>{recipe.generated_context.why_this_works}</Text>
          )}
        </View>
      )}

      {recipe.nutrition && (
        <View style={styles.nutritionBox}>
          <Text style={styles.sectionTitle}>Nutrition (per serving)</Text>
          <View style={styles.nutritionRow}>
            <NutritionStat label="Calories" value={Math.round(recipe.nutrition.calories_per_serving)} />
            <NutritionStat label="Protein" value={`${Math.round(recipe.nutrition.protein_g_per_serving)}g`} />
            <NutritionStat label="Carbs" value={`${Math.round(recipe.nutrition.carbs_g_per_serving)}g`} />
            <NutritionStat label="Fat" value={`${Math.round(recipe.nutrition.fat_g_per_serving)}g`} />
          </View>
          {recipe.nutrition.is_partial && (
            <Text style={styles.nutritionPartialNote}>
              Nutrition estimate — {recipe.nutrition.total_ingredient_count - recipe.nutrition.matched_ingredient_count}{' '}
              of {recipe.nutrition.total_ingredient_count} ingredients weren't matched to nutrition data, so this is
              likely an undercount.
            </Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Ingredients</Text>
      {groupedIngredients &&
        STATUS_ORDER.map((status) =>
          groupedIngredients[status].length > 0 ? (
            <View key={status} style={styles.ingredientGroup}>
              <Text style={styles.ingredientGroupTitle}>{STATUS_LABELS[status]}</Text>
              {groupedIngredients[status].map((ingredient, index) => (
                <Text key={`${status}-${index}`} style={styles.ingredientText}>
                  •{' '}
                  {ingredient.quantity_value != null
                    ? `${ingredient.quantity_value}${ingredient.quantity_unit ? ` ${ingredient.quantity_unit}` : ''} `
                    : ''}
                  {ingredient.display_name}
                </Text>
              ))}
            </View>
          ) : null
        )}

      <Text style={styles.sectionTitle}>Instructions</Text>
      {recipe.instructions.map((step, index) => (
        <View key={index} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      <View style={styles.watchHeaderRow}>
        <Text style={styles.sectionTitle}>Watch</Text>
        <Pressable
          onPress={loadVideos}
          disabled={videosLoading}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Refresh technique videos"
        >
          {videosLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          )}
        </Pressable>
      </View>
      {recipe.youtube_metadata && recipe.youtube_metadata.results.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.watchRow}>
            {recipe.youtube_metadata.results.map((video) => (
              <Pressable
                key={video.video_id}
                style={styles.watchCard}
                onPress={() => Linking.openURL(video.video_url)}
                accessibilityRole="button"
                accessibilityLabel={`Watch ${video.title} on YouTube`}
              >
                <Image source={{ uri: video.thumbnail_url }} style={styles.watchThumb} />
                <Text style={styles.watchTitle} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={styles.watchChannel} numberOfLines={1}>
                  {video.channel_title}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.watchEmpty}>
          {videosLoading ? 'Looking for technique videos…' : 'No technique videos found yet.'}
        </Text>
      )}

      {recipe.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {recipe.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
      )}

      <Pressable
        style={styles.cookButton}
        onPress={() => router.push(`/recipe/${id}/cook`)}
        accessibilityRole="button"
      >
        <Text style={styles.cookButtonText}>Cook This</Text>
      </Pressable>
    </ScrollView>
  );
}

function NutritionStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.nutritionStat}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  metaChip: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  whyBox: {
    backgroundColor: `${colors.primary}14`,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 2,
  },
  whyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  whyText: {
    fontSize: 14,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  nutritionBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionStat: {
    alignItems: 'center',
    gap: 2,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  nutritionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nutritionPartialNote: {
    fontSize: 12,
    color: colors.uncertain,
  },
  ingredientGroup: {
    gap: 2,
  },
  ingredientGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: spacing.xs,
  },
  ingredientText: {
    fontSize: 14,
    color: colors.text,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    width: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  watchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  watchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  watchCard: {
    width: 140,
    gap: 2,
  },
  watchThumb: {
    width: 140,
    height: 80,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  watchTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  watchChannel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  watchEmpty: {
    fontSize: 13,
    color: colors.textMuted,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cookButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cookButtonText: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
});
