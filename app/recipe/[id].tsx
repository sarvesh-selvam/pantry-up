import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../../constants/theme';
import { fetchRecipeById } from '../../lib/api/recipes';
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
      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

      <View style={styles.metaRow}>
        {recipe.cuisine && <Text style={styles.metaChip}>{recipe.cuisine}</Text>}
        {totalTime > 0 && <Text style={styles.metaChip}>{totalTime} min</Text>}
        {recipe.servings != null && <Text style={styles.metaChip}>Serves {recipe.servings}</Text>}
      </View>

      {recipe.generated_context?.why_this_works && (
        <View style={styles.whyBox}>
          <Text style={styles.whyLabel}>Why this works</Text>
          <Text style={styles.whyText}>{recipe.generated_context.why_this_works}</Text>
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
  title: {
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
