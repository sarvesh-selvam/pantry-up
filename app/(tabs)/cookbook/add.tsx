import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { TextField } from '../../../components/TextField';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth/AuthContext';
import { createRecipe } from '../../../lib/api/recipes';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import { computeRecipeNutrition } from '../../../lib/nutritionCalculation';
import { parseQuickAddText } from '../../../lib/quickAddParser';
import type { RecipeIngredient } from '../../../types/recipe';

type Stage = 'form' | 'review';

interface IngredientDraft {
  key: string;
  displayName: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  canonicalFoodId: string | null;
  matchedName: string | null;
  included: boolean;
}

export default function AddRecipeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { canonicalFoods, nutritionData } = useInventory();

  const [stage, setStage] = useState<Stage>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [instructionsText, setInstructionsText] = useState('');
  const [tagsText, setTagsText] = useState('');

  const [parsing, setParsing] = useState(false);
  const [drafts, setDrafts] = useState<IngredientDraft[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleParseIngredients() {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give the recipe a name before continuing.');
      return;
    }
    if (!ingredientsText.trim()) {
      Alert.alert('Ingredients required', 'List at least one ingredient, one per line.');
      return;
    }
    if (!instructionsText.trim()) {
      Alert.alert('Instructions required', 'Add at least one instruction step, one per line.');
      return;
    }

    setParsing(true);
    try {
      const parsed = await parseQuickAddText(ingredientsText, canonicalFoods);
      setDrafts(
        parsed.map((item, index) => ({
          key: `${Date.now()}-${index}`,
          displayName: item.displayName,
          quantityValue: item.quantityValue,
          quantityUnit: item.quantityUnit,
          canonicalFoodId: item.canonicalFood?.id ?? null,
          matchedName: item.canonicalFood?.canonical_name ?? null,
          included: true,
        }))
      );
      setStage('review');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to process ingredients');
    } finally {
      setParsing(false);
    }
  }

  function updateDraft(key: string, updates: Partial<IngredientDraft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...updates } : d)));
  }

  async function handleSaveRecipe() {
    if (!session) return;
    const includedDrafts = drafts.filter((d) => d.included);
    if (includedDrafts.length === 0) {
      Alert.alert('Nothing to save', 'Include at least one ingredient.');
      return;
    }

    setSaving(true);
    try {
      const ingredients: RecipeIngredient[] = includedDrafts.map((d) => ({
        canonical_food_id: d.canonicalFoodId,
        display_name: d.displayName,
        quantity_value: d.quantityValue,
        quantity_unit: d.quantityUnit,
        inventory_match: null,
        verification_status: d.canonicalFoodId ? 'confirmed' : 'needs_verification',
      }));

      const parsedServings = servings.trim() ? Number(servings) : null;
      const nutrition = computeRecipeNutrition(ingredients, nutritionData, parsedServings);

      const created = await createRecipe(session.user.id, {
        source_type: 'manual',
        title: title.trim(),
        description: description.trim() || null,
        cuisine: cuisine.trim() || null,
        servings: Number.isFinite(parsedServings) ? parsedServings : null,
        prep_time: prepTime.trim() ? Number(prepTime) || null : null,
        cook_time: cookTime.trim() ? Number(cookTime) || null : null,
        ingredients,
        instructions: instructionsText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        nutrition,
        youtube_metadata: null,
        tags: tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        is_favorite: false,
        generated_context: null,
      });

      router.replace(`/recipe/${created.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  }

  if (stage === 'review') {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>
          We matched these ingredients against your canonical food list — edit or exclude anything
          that's wrong.
        </Text>
        <ScrollView contentContainerStyle={styles.reviewList}>
          {drafts.map((draft) => (
            <View key={draft.key} style={[styles.draftRow, !draft.included && styles.draftRowExcluded]}>
              <View style={styles.draftInfo}>
                <TextInput
                  style={styles.draftNameInput}
                  value={draft.displayName}
                  onChangeText={(text) => updateDraft(draft.key, { displayName: text })}
                  editable={draft.included}
                />
                <Text style={styles.draftMatch}>
                  {draft.matchedName ? `Matched to: ${draft.matchedName}` : 'No canonical match'}
                </Text>
                <View style={styles.draftQuantityRow}>
                  <TextInput
                    style={styles.draftQuantityInput}
                    value={draft.quantityValue != null ? String(draft.quantityValue) : ''}
                    onChangeText={(text) =>
                      updateDraft(draft.key, { quantityValue: text.trim() ? Number(text) || null : null })
                    }
                    placeholder="Qty"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    editable={draft.included}
                  />
                  <TextInput
                    style={styles.draftQuantityInput}
                    value={draft.quantityUnit ?? ''}
                    onChangeText={(text) => updateDraft(draft.key, { quantityUnit: text || null })}
                    placeholder="Unit"
                    placeholderTextColor={colors.textMuted}
                    editable={draft.included}
                  />
                </View>
              </View>
              <Switch
                value={draft.included}
                onValueChange={(value) => updateDraft(draft.key, { included: value })}
              />
            </View>
          ))}
        </ScrollView>
        {saving ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PrimaryButton label="Save Recipe" onPress={handleSaveRecipe} />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form}>
        <TextField label="Title*" value={title} onChangeText={setTitle} placeholder="e.g. Weeknight Chili" />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline />
        <TextField label="Cuisine" value={cuisine} onChangeText={setCuisine} placeholder="e.g. Mexican" />
        <TextField label="Servings" value={servings} onChangeText={setServings} keyboardType="numeric" />
        <TextField label="Prep time (min)" value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" />
        <TextField label="Cook time (min)" value={cookTime} onChangeText={setCookTime} keyboardType="numeric" />

        <View style={styles.textareaField}>
          <Text style={styles.textareaLabel}>Ingredients* (one per line)</Text>
          <TextInput
            style={styles.textarea}
            value={ingredientsText}
            onChangeText={setIngredientsText}
            placeholder={'2 lbs chicken breast\n1 onion, diced\n2 cups rice'}
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>

        <View style={styles.textareaField}>
          <Text style={styles.textareaLabel}>Instructions* (one step per line)</Text>
          <TextInput
            style={styles.textarea}
            value={instructionsText}
            onChangeText={setInstructionsText}
            placeholder={'Season the chicken.\nSear until browned.\nSimmer for 20 minutes.'}
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>

        <TextField label="Tags (comma-separated)" value={tagsText} onChangeText={setTagsText} placeholder="quick, spicy" />

        {parsing ? (
          <View style={styles.parsingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.parsingLabel}>Matching ingredients…</Text>
          </View>
        ) : (
          <Pressable style={styles.nextButton} onPress={handleParseIngredients}>
            <Ionicons name="arrow-forward" size={16} color={colors.primaryText} />
            <Text style={styles.nextButtonText}>Review Ingredients</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  form: {
    padding: spacing.md,
    gap: spacing.md,
  },
  textareaField: {
    gap: spacing.xs,
  },
  textareaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  nextButtonText: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
  parsingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  parsingLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    padding: spacing.md,
    paddingBottom: 0,
  },
  reviewList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  draftRowExcluded: {
    opacity: 0.5,
  },
  draftInfo: {
    flex: 1,
    gap: 4,
  },
  draftNameInput: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 2,
  },
  draftMatch: {
    fontSize: 12,
    color: colors.textMuted,
  },
  draftQuantityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  draftQuantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.text,
  },
});
