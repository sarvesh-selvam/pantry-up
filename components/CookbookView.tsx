import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { fetchUserRecipes } from '../lib/api/recipes';
import { useInventory } from '../lib/inventory/InventoryContext';
import { matchRecipeToInventory } from '../lib/recipeMatching';
import type { Recipe } from '../types/recipe';
import { RecipeCard } from './RecipeCard';

/** Cook › Cookbook: every saved recipe, newest first. Refetches on focus so
 * a suggestion saved from the preview screen shows up on return. */
export function CookbookView() {
  const router = useRouter();
  const { items } = useInventory();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchUserRecipes()
        .then((result) => {
          if (!cancelled) {
            setRecipes(result);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recipes');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={styles.spinner} />;
  }

  return (
    <>
      {error && <Text style={styles.error}>{error}</Text>}
      {recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your cookbook is empty</Text>
          <Text style={styles.emptySubtitle}>Recipes you save from Suggested or Sous Chef show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(recipe) => recipe.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item: recipe }) => {
            const match = matchRecipeToInventory(recipe.ingredients, items);
            return (
              <View style={styles.gridCell}>
                <RecipeCard
                  recipe={{
                    title: recipe.title,
                    description: recipe.description,
                    cuisine: recipe.cuisine,
                    servings: recipe.servings,
                    prep_time: recipe.prep_time,
                    cook_time: recipe.cook_time,
                    instructions: recipe.instructions,
                    tags: recipe.tags,
                    ingredients: match.ingredients,
                    pantry_coverage_label: match.pantryCoverageLabel,
                    missing_ingredient_count: match.missingIngredientCount,
                    why_this_works: recipe.generated_context?.why_this_works ?? '',
                    why_bullets: recipe.generated_context?.why_bullets ?? [],
                    score: recipe.generated_context?.score ?? null,
                    score_breakdown: recipe.generated_context?.score_breakdown ?? null,
                    rescued_ingredient_names: [],
                    nutrition: recipe.nutrition,
                    equipment_needed: recipe.equipment_needed,
                    youtube_metadata: recipe.youtube_metadata,
                  }}
                  variant="compact"
                  style={styles.gridCard}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
              </View>
            );
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  spinner: {
    marginTop: spacing.xl,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  gridCell: {
    flex: 1,
  },
  gridCard: {
    flex: 1,
    width: undefined,
    marginRight: 0,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
