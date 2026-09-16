import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { RecipeCard } from '../../../components/RecipeCard';
import { colors, radii, spacing } from '../../../constants/theme';
import { fetchUserRecipes, setRecipeFavorite } from '../../../lib/api/recipes';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import { matchRecipeToInventory } from '../../../lib/recipeMatching';
import type { Recipe } from '../../../types/recipe';

export default function CookbookScreen() {
  const router = useRouter();
  const { items } = useInventory();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUserRecipes()
      .then((result) => {
        if (!cancelled) setRecipes(result);
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
  }, []);

  const visibleRecipes = useMemo(
    () => (favoritesOnly ? recipes.filter((r) => r.is_favorite) : recipes),
    [recipes, favoritesOnly]
  );

  async function toggleFavorite(recipe: Recipe) {
    const nextValue = !recipe.is_favorite;
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: nextValue } : r)));
    try {
      await setRecipeFavorite(recipe.id, nextValue);
    } catch {
      setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: !nextValue } : r)));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, styles.primaryAction]}
          onPress={() => router.push('/(tabs)/cookbook/add')}
        >
          <Ionicons name="add" size={18} color={colors.primaryText} />
          <Text style={styles.primaryActionLabel}>Add Recipe</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => router.push('/(tabs)/cookbook/scan')}
        >
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryActionLabel}>Scan Cookbook Page</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.filterChip, favoritesOnly && styles.filterChipActive]}
        onPress={() => setFavoritesOnly((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ selected: favoritesOnly }}
      >
        <Ionicons
          name={favoritesOnly ? 'star' : 'star-outline'}
          size={14}
          color={favoritesOnly ? colors.primaryText : colors.text}
        />
        <Text style={[styles.filterChipText, favoritesOnly && styles.filterChipTextActive]}>Favorites</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : visibleRecipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {favoritesOnly ? 'No favorites yet' : 'Your cookbook is empty'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {favoritesOnly
              ? 'Star a recipe to pin it here.'
              : 'Recipes you save from Sous Chef or Home, plus anything you add or scan, show up here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleRecipes}
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
                    rescued_ingredient_names: [],
                    nutrition: recipe.nutrition,
                    youtube_metadata: recipe.youtube_metadata,
                  }}
                  variant="compact"
                  style={styles.gridCard}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
                <Pressable
                  style={styles.favoriteButton}
                  onPress={() => toggleFavorite(recipe)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={recipe.is_favorite ? 'Unfavorite' : 'Favorite'}
                >
                  <Ionicons
                    name={recipe.is_favorite ? 'star' : 'star-outline'}
                    size={18}
                    color={recipe.is_favorite ? colors.uncertain : colors.textMuted}
                  />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: 0,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  primaryAction: {
    backgroundColor: colors.primary,
  },
  primaryActionLabel: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryActionLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.primaryText,
  },
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
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  gridCell: {
    flex: 1,
    position: 'relative',
  },
  gridCard: {
    flex: 1,
    width: undefined,
    marginRight: 0,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 4,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
});
