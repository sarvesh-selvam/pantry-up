import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepTimer } from '../../../components/StepTimer';
import { TechniqueVideoSlot } from '../../../components/TechniqueVideoSlot';
import { colors, radii, spacing } from '../../../constants/theme';
import { fetchRecipeById } from '../../../lib/api/recipes';
import { findIngredientsInStep } from '../../../lib/matchIngredientsToStep';
import { stepMatchesTechnique } from '../../../lib/matchTechniqueToStep';
import { extractStepDurationSeconds } from '../../../lib/parseStepDuration';
import type { Recipe } from '../../../types/recipe';

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
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

  const stepText = recipe?.instructions[stepIndex] ?? null;
  const durationSeconds = useMemo(() => (stepText ? extractStepDurationSeconds(stepText) : null), [stepText]);
  const stepIngredients = useMemo(
    () => (recipe && stepText ? findIngredientsInStep(stepText, recipe.ingredients) : []),
    [recipe, stepText]
  );
  const stepMatchesRecipeTechnique = useMemo(
    () =>
      recipe?.youtube_metadata && stepText ? stepMatchesTechnique(stepText, recipe.youtube_metadata.technique) : false,
    [recipe, stepText]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !recipe || recipe.instructions.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'This recipe has no instructions to cook from.'}</Text>
        <Pressable onPress={() => router.back()} style={styles.exitLink}>
          <Text style={styles.exitLinkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const totalSteps = recipe.instructions.length;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exit cooking mode">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.stepCounter}>
          Step {stepIndex + 1} of {totalSteps}
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/sous-chef', params: { recipeId: id } })}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Ask Sous Chef"
        >
          <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((stepIndex + 1) / totalSteps) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.stepText}>{stepText}</Text>

        {stepIngredients.length > 0 && (
          <View style={styles.ingredientRow}>
            {stepIngredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientChip}>
                <Text style={styles.ingredientChipText}>
                  {ingredient.quantity_value != null
                    ? `${ingredient.quantity_value}${ingredient.quantity_unit ? ` ${ingredient.quantity_unit}` : ''} `
                    : ''}
                  {ingredient.display_name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {durationSeconds != null && <StepTimer durationSeconds={durationSeconds} />}

        <TechniqueVideoSlot youtubeMetadata={recipe.youtube_metadata} stepMatched={stepMatchesRecipeTechnique} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.navRow}>
          <Pressable
            style={[styles.navButton, isFirstStep && styles.navButtonDisabled]}
            onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirstStep}
          >
            <Ionicons name="chevron-back" size={20} color={isFirstStep ? colors.textMuted : colors.text} />
            <Text style={[styles.navButtonText, isFirstStep && styles.navButtonTextDisabled]}>Previous</Text>
          </Pressable>
          <Pressable
            style={[styles.navButton, isLastStep && styles.navButtonDisabled]}
            onPress={() => setStepIndex((i) => Math.min(totalSteps - 1, i + 1))}
            disabled={isLastStep}
          >
            <Text style={[styles.navButtonText, isLastStep && styles.navButtonTextDisabled]}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={isLastStep ? colors.textMuted : colors.text} />
          </Pressable>
        </View>
        <Pressable style={styles.finishButton} onPress={() => router.push(`/recipe/${id}/finish`)}>
          <Text style={styles.finishButtonText}>Finish Cooking</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  exitLink: {
    padding: spacing.sm,
  },
  exitLinkText: {
    color: colors.primary,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 32,
  },
  ingredientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  ingredientChip: {
    backgroundColor: `${colors.primary}1A`,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  ingredientChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  bottomBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  navButtonTextDisabled: {
    color: colors.textMuted,
  },
  finishButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  finishButtonText: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
});
