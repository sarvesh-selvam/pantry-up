import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { OptionPicker } from '../../../components/OptionPicker';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { TextField } from '../../../components/TextField';
import { colors, spacing } from '../../../constants/theme';
import { STORAGE_LOCATION_LABELS, STORAGE_LOCATION_ORDER } from '../../../lib/formatInventory';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import type { PreparationState, QuantityState, StorageLocation } from '../../../types/database';

const PREPARATION_OPTIONS: { value: PreparationState; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'prepared', label: 'Prepared' },
  { value: 'leftover', label: 'Leftover' },
];

const QUANTITY_STATE_OPTIONS: { value: QuantityState; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'mostly_full', label: 'Mostly full' },
  { value: 'half', label: 'Half' },
  { value: 'low', label: 'Low' },
  { value: 'almost_empty', label: 'Almost empty' },
];

const STORAGE_OPTIONS = STORAGE_LOCATION_ORDER.map((value) => ({
  value,
  label: STORAGE_LOCATION_LABELS[value],
}));

export default function AddItemScreen() {
  const router = useRouter();
  const { addItem } = useInventory();

  const [name, setName] = useState('');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [quantityState, setQuantityState] = useState<QuantityState | null>(null);
  const [storageLocation, setStorageLocation] = useState<StorageLocation>('fridge');
  const [preparationState, setPreparationState] = useState<PreparationState>('raw');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the item a name before saving.');
      return;
    }

    const parsedQuantity = quantityValue.trim() ? Number(quantityValue) : null;
    if (quantityValue.trim() && Number.isNaN(parsedQuantity)) {
      Alert.alert('Invalid quantity', 'Quantity must be a number.');
      return;
    }

    setSaving(true);
    try {
      await addItem({
        canonical_food_id: null,
        display_name: name.trim(),
        category: null,
        quantity_value: parsedQuantity,
        quantity_unit: quantityUnit.trim() || null,
        quantity_confidence: 'confirmed',
        quantity_state: parsedQuantity == null ? quantityState : null,
        preparation_state: preparationState,
        storage_location: storageLocation,
        source: 'manual',
        raw_input_text: null,
        source_recipe_id: null,
        purchased_at: null,
        opened_at: null,
        expiry_user_provided: null,
        expiry_estimated: null,
        verification_status: 'confirmed',
        last_verified_at: null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TextField
          label="Name*"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Chicken breast"
          autoFocus
        />

        <TextField
          label="Quantity"
          value={quantityValue}
          onChangeText={setQuantityValue}
          placeholder="e.g. 2"
          keyboardType="numeric"
        />
        <TextField
          label="Unit"
          value={quantityUnit}
          onChangeText={setQuantityUnit}
          placeholder="e.g. lb"
        />

        {!quantityValue.trim() && (
          <OptionPicker
            label="Or describe how much is left"
            options={QUANTITY_STATE_OPTIONS}
            value={quantityState}
            onChange={setQuantityState}
          />
        )}

        <OptionPicker
          label="Storage location"
          options={STORAGE_OPTIONS}
          value={storageLocation}
          onChange={setStorageLocation}
        />

        <OptionPicker
          label="Preparation"
          options={PREPARATION_OPTIONS}
          value={preparationState}
          onChange={setPreparationState}
        />

        <PrimaryButton label="Save item" onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
});
