import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../../constants/theme';
import { useInventory } from '../../lib/inventory/InventoryContext';
import { matchRecipeToInventory } from '../../lib/recipeMatching';
import { useDailySuggestions } from '../../lib/suggestions/DailySuggestionsContext';
import type { IngredientMatchStatus, RecipeIngredient } from '../../types/recipe';

const STATUS_LABELS: Record<IngredientMatchStatus, string> = {
  have: 'Already Have',
  verify: 'Verify',
  missing: 'Missing',
};

const STATUS_ORDER: IngredientMatchStatus[] = ['have', 'verify', 'missing'];

/**
 * Read-only preview of one of today's suggestions. Nothing here writes to
 * `recipes` until the user taps Save — after that they land on the real
 * recipe detail screen, which is where cooking, favorites, videos and the
 * shopping-list action live (all of which need a saved recipe id).
 */
export default function SuggestionPreviewScreen() {
  const { index: indexParam } = useLocalSearchParams<{ index: string }>();
  const index = Number(indexParam);
  const router = useRouter();
  const { items } = useInventory();
  const { suggestions, saveSuggestion } = useDailySuggestions();
  const [saving, setSaving] = useState(false);

  const entry = suggestions[index];
  const recipe = entry?.suggestion;

  // Live re-match, same reasoning as the recipe detail screen.
  const groupedIngredients = useMemo(() => {
    if (!recipe) return null;
    const { ingredients } = matchRecipeToInventory(recipe.ingredients, items);
    const groups: Record<IngredientMatchStatus, RecipeIngredient[]> = { have: [], verify: [], missing: [] };
    for (const ingredient of ingredients) {
      groups[ingredient.inventory_match?.status ?? 'missing'].push(ingredient);
    }
    return groups;
  }, [recipe, items]);

  async function handleSave() {
    setSaving(true);
    try {
      const recipeId = await saveSuggestion(index);
      router.replace(`/recipe/${recipeId}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save recipe');
      setSaving(false);
    }
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>This suggestion is no longer available.</Text>
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

      {(recipe.why_bullets.length > 0 || recipe.why_this_works) && (
        <View style={styles.whyBox}>
          <Text style={styles.whyLabel}>Why this works</Text>
          {recipe.why_bullets.length > 0 ? (
            recipe.why_bullets.map((bullet, i) => (
              <Text key={i} style={styles.whyText}>
                • {bullet}
              </Text>
            ))
          ) : (
            <Text style={styles.whyText}>{recipe.why_this_works}</Text>
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
              {groupedIngredients[status].map((ingredient, i) => (
                <Text key={`${status}-${i}`} style={styles.ingredientText}>
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
      {recipe.instructions.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{i + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      {entry.savedRecipeId ? (
        <Pressable
          style={styles.saveButton}
          onPress={() => router.replace(`/recipe/${entry.savedRecipeId}`)}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>Open in Cookbook</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving} accessibilityRole="button">
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <>
              <Ionicons name="bookmark-outline" size={18} color={colors.primaryText} />
              <Text style={styles.saveButtonText}>Save to Cookbook</Text>
            </>
          )}
        </Pressable>
      )}
      <Text style={styles.saveHint}>Save it to cook it — cooking needs a saved recipe.</Text>
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
  saveButton: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 40,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
  saveHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
