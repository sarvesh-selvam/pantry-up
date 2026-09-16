import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { createCookEvent } from '../../../lib/api/cookEvents';
import { fetchRecipeById } from '../../../lib/api/recipes';
import { proposeInventoryMutations, type ProposedMutation } from '../../../lib/cookingMutations';
import { useAuth } from '../../../lib/auth/AuthContext';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import type { AppliedMutation, LeftoverRecord } from '../../../types/cookEvent';
import type { Recipe } from '../../../types/recipe';

type Stage = 'loading' | 'servings' | 'mutations' | 'leftovers' | 'saving';

export default function FinishCookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { items, editItem, removeItem, addItem } = useInventory();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);

  const [servingsPreparedInput, setServingsPreparedInput] = useState('1');
  const [servingsConsumedInput, setServingsConsumedInput] = useState('1');
  const [mutations, setMutations] = useState<ProposedMutation[]>([]);
  const [appliedMutations, setAppliedMutations] = useState<AppliedMutation[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    fetchRecipeById(id)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError('Recipe not found.');
          return;
        }
        setRecipe(result);
        const defaultServings = result.servings ?? 1;
        setServingsPreparedInput(String(defaultServings));
        setServingsConsumedInput(String(defaultServings));
        setStage('servings');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recipe');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const servingsPrepared = Number(servingsPreparedInput);
  const servingsConsumed = Number(servingsConsumedInput);
  const leftoverServings = useMemo(() => {
    if (!Number.isFinite(servingsPrepared) || !Number.isFinite(servingsConsumed)) return 0;
    return Math.max(0, servingsPrepared - servingsConsumed);
  }, [servingsPrepared, servingsConsumed]);

  function handleContinueFromServings() {
    if (!recipe) return;
    if (!Number.isFinite(servingsPrepared) || servingsPrepared <= 0) {
      Alert.alert('Invalid input', 'Servings made must be a positive number.');
      return;
    }
    if (!Number.isFinite(servingsConsumed) || servingsConsumed < 0) {
      Alert.alert('Invalid input', 'Servings eaten must be zero or more.');
      return;
    }
    const proposed = proposeInventoryMutations(recipe.ingredients, items, servingsPrepared, recipe.servings);
    setMutations(proposed);
    setStage('mutations');
  }

  function updateMutation(key: string, updates: Partial<ProposedMutation>) {
    setMutations((prev) => prev.map((m) => (m.key === key ? { ...m, ...updates } : m)));
  }

  async function handleUpdatePantry() {
    setStage('saving');
    const applied: AppliedMutation[] = [];
    try {
      for (const mutation of mutations) {
        if (!mutation.included) continue;

        if (mutation.mode === 'quantity') {
          const currentValue = mutation.currentQuantityValue ?? 0;
          const deduct = mutation.deductQuantityValue ?? 0;
          const resulting = Math.max(0, roundToTwoDecimals(currentValue - deduct));
          const removed = resulting <= 0;

          if (removed) {
            await removeItem(mutation.inventoryItemId);
          } else {
            await editItem(mutation.inventoryItemId, { quantity_value: resulting });
          }

          applied.push({
            inventory_item_id: mutation.inventoryItemId,
            display_name: mutation.inventoryDisplayName,
            mode: 'quantity',
            previous_quantity_value: currentValue,
            new_quantity_value: removed ? null : resulting,
            previous_quantity_state: null,
            new_quantity_state: null,
            removed,
          });
        } else {
          await editItem(mutation.inventoryItemId, { quantity_state: mutation.nextState });
          applied.push({
            inventory_item_id: mutation.inventoryItemId,
            display_name: mutation.inventoryDisplayName,
            mode: 'state',
            previous_quantity_value: null,
            new_quantity_value: null,
            previous_quantity_state: mutation.currentState,
            new_quantity_state: mutation.nextState,
            removed: false,
          });
        }
      }

      setAppliedMutations(applied);

      if (leftoverServings > 0) {
        setStage('leftovers');
      } else {
        await finalize(applied, null);
      }
    } catch (err) {
      setStage('mutations');
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update pantry');
    }
  }

  async function handleLeftoverDecision(save: boolean) {
    if (!save) {
      await finalize(appliedMutations, null);
      return;
    }

    if (!recipe) return;
    setStage('saving');
    try {
      const created = await addItem({
        canonical_food_id: null,
        display_name: `Leftover ${recipe.title}`,
        category: null,
        quantity_value: leftoverServings,
        quantity_unit: 'serving',
        quantity_confidence: 'confirmed',
        quantity_state: null,
        preparation_state: 'leftover',
        storage_location: 'fridge',
        source: 'cooking',
        raw_input_text: null,
        source_recipe_id: recipe.id,
        purchased_at: null,
        opened_at: null,
        expiry_user_provided: null,
        expiry_estimated: null,
        verification_status: 'confirmed',
        last_verified_at: new Date().toISOString(),
      });

      const leftoverRecord: LeftoverRecord = {
        inventory_item_id: created.id,
        display_name: created.display_name,
        quantity_value: created.quantity_value,
        quantity_unit: created.quantity_unit,
      };
      await finalize(appliedMutations, [leftoverRecord]);
    } catch (err) {
      setStage('leftovers');
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save leftovers');
    }
  }

  async function finalize(applied: AppliedMutation[], leftovers: LeftoverRecord[] | null) {
    if (!recipe || !session) return;
    try {
      await createCookEvent(session.user.id, {
        recipe_id: recipe.id,
        cooked_at: new Date().toISOString(),
        servings_prepared: Number.isFinite(servingsPrepared) ? servingsPrepared : null,
        servings_consumed: Number.isFinite(servingsConsumed) ? servingsConsumed : null,
        inventory_mutations: applied,
        nutrition_consumed: null,
        leftovers_created: leftovers,
        user_feedback: null,
      });
      Alert.alert('Cooking complete!', 'Your pantry has been updated.', [
        { text: 'OK', onPress: () => router.dismissTo('/(tabs)') },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record this cook');
      setStage('leftovers');
    }
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (stage === 'loading' || !recipe) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (stage === 'servings') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>How many servings?</Text>
        <TextField
          label="Servings you made"
          value={servingsPreparedInput}
          onChangeText={setServingsPreparedInput}
          keyboardType="numeric"
        />
        <TextField
          label="Servings you'll eat now"
          value={servingsConsumedInput}
          onChangeText={setServingsConsumedInput}
          keyboardType="numeric"
        />
        <Text style={styles.hint}>
          If you're eating fewer than you made, we'll offer to save the rest as leftovers.
        </Text>
        <PrimaryButton label="Next" onPress={handleContinueFromServings} />
      </View>
    );
  }

  if (stage === 'mutations' || stage === 'saving') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Looks like you used:</Text>
        <Text style={styles.hint}>
          Nothing changes in your pantry until you confirm — check quantities and uncheck anything
          that's wrong.
        </Text>
        <ScrollView contentContainerStyle={styles.mutationList}>
          {mutations.length === 0 && (
            <Text style={styles.hint}>No matched pantry items to deduct from — nothing to update.</Text>
          )}
          {mutations.map((mutation) => (
            <View key={mutation.key} style={[styles.mutationRow, !mutation.included && styles.mutationRowExcluded]}>
              <View style={styles.mutationInfo}>
                <Text style={styles.mutationName}>{mutation.inventoryDisplayName}</Text>
                {mutation.mode === 'quantity' ? (
                  <View style={styles.mutationEditRow}>
                    <TextInput
                      style={styles.mutationInput}
                      value={mutation.deductQuantityValue != null ? String(mutation.deductQuantityValue) : ''}
                      onChangeText={(text) =>
                        updateMutation(mutation.key, { deductQuantityValue: text.trim() ? Number(text) || 0 : 0 })
                      }
                      keyboardType="numeric"
                      editable={mutation.included}
                    />
                    <Text style={styles.mutationUnit}>
                      {mutation.quantityUnit ?? ''} of {mutation.currentQuantityValue}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.mutationStateText}>
                    {formatState(mutation.currentState)} → {formatState(mutation.nextState)}
                  </Text>
                )}
              </View>
              <Switch
                value={mutation.included}
                onValueChange={(value) => updateMutation(mutation.key, { included: value })}
              />
            </View>
          ))}
        </ScrollView>
        {stage === 'saving' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PrimaryButton label="Update Pantry" onPress={handleUpdatePantry} />
        )}
      </View>
    );
  }

  // stage === 'leftovers'
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Save the leftovers?</Text>
      <Text style={styles.hint}>
        Add {leftoverServings} serving{leftoverServings === 1 ? '' : 's'} of leftover "{recipe.title}" to
        your fridge?
      </Text>
      <PrimaryButton label="Add to Fridge" onPress={() => handleLeftoverDecision(true)} />
      <Pressable style={styles.skipButton} onPress={() => handleLeftoverDecision(false)}>
        <Text style={styles.skipButtonText}>No thanks</Text>
      </Pressable>
    </View>
  );
}

function formatState(state: string | null): string {
  if (!state) return '—';
  return state
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  mutationList: {
    gap: spacing.sm,
  },
  mutationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mutationRowExcluded: {
    opacity: 0.5,
  },
  mutationInfo: {
    flex: 1,
    gap: 4,
  },
  mutationName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  mutationEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mutationInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    fontSize: 14,
    color: colors.text,
  },
  mutationUnit: {
    fontSize: 12,
    color: colors.textMuted,
  },
  mutationStateText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipButtonText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
});
