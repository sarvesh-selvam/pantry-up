import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { TextField } from '../../../components/TextField';
import { UncertaintyBadge } from '../../../components/UncertaintyBadge';
import { colors, radii, spacing } from '../../../constants/theme';
import { createRecipe } from '../../../lib/api/recipes';
import { useAuth } from '../../../lib/auth/AuthContext';
import { useCookbookScan } from '../../../lib/cookbook/CookbookScanContext';
import type { RecipeIngredient } from '../../../types/recipe';

interface IngredientDraft {
  key: string;
  displayName: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  canonicalFoodId: string | null;
  confidence: number;
  included: boolean;
}

export default function ScanReviewScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { scannedRecipeDraft } = useCookbookScan();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [instructionsText, setInstructionsText] = useState('');
  const [ingredientDrafts, setIngredientDrafts] = useState<IngredientDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scannedRecipeDraft) return;
    setTitle(scannedRecipeDraft.title);
    setDescription(scannedRecipeDraft.description ?? '');
    setCuisine(scannedRecipeDraft.cuisine ?? '');
    setServings(scannedRecipeDraft.servings != null ? String(scannedRecipeDraft.servings) : '');
    setPrepTime(scannedRecipeDraft.prep_time != null ? String(scannedRecipeDraft.prep_time) : '');
    setCookTime(scannedRecipeDraft.cook_time != null ? String(scannedRecipeDraft.cook_time) : '');
    setInstructionsText(scannedRecipeDraft.instructions.join('\n'));
    setIngredientDrafts(
      scannedRecipeDraft.ingredients.map((ing, index) => ({
        key: `${index}`,
        displayName: ing.display_name,
        quantityValue: ing.quantity_value,
        quantityUnit: ing.quantity_unit,
        canonicalFoodId: ing.canonical_food_id_guess,
        confidence: ing.confidence,
        included: true,
      }))
    );
  }, [scannedRecipeDraft]);

  function updateIngredient(key: string, updates: Partial<IngredientDraft>) {
    setIngredientDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...updates } : d)));
  }

  if (!scannedRecipeDraft) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Nothing to review — scan a cookbook page first.</Text>
      </View>
    );
  }

  async function handleSave() {
    if (!session) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Give the recipe a name before saving.');
      return;
    }
    const includedIngredients = ingredientDrafts.filter((d) => d.included);
    if (includedIngredients.length === 0) {
      Alert.alert('Nothing to save', 'Include at least one ingredient.');
      return;
    }

    setSaving(true);
    try {
      const ingredients: RecipeIngredient[] = includedIngredients.map((d) => ({
        canonical_food_id: d.canonicalFoodId,
        display_name: d.displayName,
        quantity_value: d.quantityValue,
        quantity_unit: d.quantityUnit,
        inventory_match: null,
        verification_status: d.canonicalFoodId && d.confidence >= 0.5 ? 'confirmed' : 'needs_verification',
      }));

      const created = await createRecipe(session.user.id, {
        source_type: 'cookbook_scan',
        title: title.trim(),
        description: description.trim() || null,
        cuisine: cuisine.trim() || null,
        servings: servings.trim() ? Number(servings) || null : null,
        prep_time: prepTime.trim() ? Number(prepTime) || null : null,
        cook_time: cookTime.trim() ? Number(cookTime) || null : null,
        ingredients,
        instructions: instructionsText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        nutrition: scannedRecipeDraft!.nutrition,
        youtube_metadata: null,
        tags: scannedRecipeDraft!.tags,
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {scannedRecipeDraft.needs_verification && (
        <View style={styles.uncertaintyBanner}>
          <UncertaintyBadge />
          <Text style={styles.uncertaintyText}>
            Some of this was hard to read — double-check the fields below before saving.
          </Text>
        </View>
      )}

      <TextField label="Title*" value={title} onChangeText={setTitle} />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      <TextField label="Cuisine" value={cuisine} onChangeText={setCuisine} />
      <TextField label="Servings" value={servings} onChangeText={setServings} keyboardType="numeric" />
      <TextField label="Prep time (min)" value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" />
      <TextField label="Cook time (min)" value={cookTime} onChangeText={setCookTime} keyboardType="numeric" />

      <Text style={styles.sectionTitle}>Ingredients</Text>
      {ingredientDrafts.map((draft) => (
        <View key={draft.key} style={[styles.draftRow, !draft.included && styles.draftRowExcluded]}>
          <View style={styles.draftInfo}>
            <View style={styles.draftNameRow}>
              {draft.confidence < 0.5 && <UncertaintyBadge />}
              <TextInput
                style={styles.draftNameInput}
                value={draft.displayName}
                onChangeText={(text) => updateIngredient(draft.key, { displayName: text })}
                editable={draft.included}
              />
            </View>
            <View style={styles.draftQuantityRow}>
              <TextInput
                style={styles.draftQuantityInput}
                value={draft.quantityValue != null ? String(draft.quantityValue) : ''}
                onChangeText={(text) =>
                  updateIngredient(draft.key, { quantityValue: text.trim() ? Number(text) || null : null })
                }
                placeholder="Qty"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                editable={draft.included}
              />
              <TextInput
                style={styles.draftQuantityInput}
                value={draft.quantityUnit ?? ''}
                onChangeText={(text) => updateIngredient(draft.key, { quantityUnit: text || null })}
                placeholder="Unit"
                placeholderTextColor={colors.textMuted}
                editable={draft.included}
              />
            </View>
          </View>
          <Switch
            value={draft.included}
            onValueChange={(value) => updateIngredient(draft.key, { included: value })}
          />
        </View>
      ))}

      <View style={styles.textareaField}>
        <Text style={styles.textareaLabel}>Instructions (one step per line)</Text>
        <TextInput
          style={styles.textarea}
          value={instructionsText}
          onChangeText={setInstructionsText}
          multiline
        />
      </View>

      {saving ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <PrimaryButton label="Save Recipe" onPress={handleSave} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
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
  uncertaintyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.uncertainBackground,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  uncertaintyText: {
    flex: 1,
    fontSize: 13,
    color: colors.uncertain,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
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
  },
  draftRowExcluded: {
    opacity: 0.5,
  },
  draftInfo: {
    flex: 1,
    gap: 4,
  },
  draftNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  draftNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 2,
  },
  draftQuantityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  textareaField: {
    gap: spacing.xs,
  },
  textareaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
});
