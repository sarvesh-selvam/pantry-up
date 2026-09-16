import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OptionPicker } from '../../../components/OptionPicker';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { TextField } from '../../../components/TextField';
import { colors, spacing } from '../../../constants/theme';
import { formatDateInput, parseDateInput } from '../../../lib/dateInput';
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

export default function EditItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, editItem, removeItem } = useInventory();

  const item = useMemo(() => items.find((candidate) => candidate.id === id), [items, id]);

  const [name, setName] = useState(item?.display_name ?? '');
  const [quantityValue, setQuantityValue] = useState(
    item?.quantity_value != null ? String(item.quantity_value) : ''
  );
  const [quantityUnit, setQuantityUnit] = useState(item?.quantity_unit ?? '');
  const [quantityState, setQuantityState] = useState<QuantityState | null>(
    item?.quantity_state ?? null
  );
  const [storageLocation, setStorageLocation] = useState<StorageLocation>(
    item?.storage_location ?? 'fridge'
  );
  const [preparationState, setPreparationState] = useState<PreparationState>(
    item?.preparation_state ?? 'raw'
  );
  const [purchasedAt, setPurchasedAt] = useState(formatDateInput(item?.purchased_at ?? null));
  const [openedAt, setOpenedAt] = useState(formatDateInput(item?.opened_at ?? null));
  const [expiryUserProvided, setExpiryUserProvided] = useState(
    formatDateInput(item?.expiry_user_provided ?? null)
  );
  const [saving, setSaving] = useState(false);

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Item not found.</Text>
      </View>
    );
  }

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

    for (const [label, value] of [
      ['Purchased date', purchasedAt],
      ['Opened date', openedAt],
      ['Expiry date', expiryUserProvided],
    ] as const) {
      if (value.trim() && !parseDateInput(value)) {
        Alert.alert('Invalid date', `${label} must be in YYYY-MM-DD format.`);
        return;
      }
    }

    setSaving(true);
    try {
      await editItem(item!.id, {
        display_name: name.trim(),
        quantity_value: parsedQuantity,
        quantity_unit: quantityUnit.trim() || null,
        quantity_state: parsedQuantity == null ? quantityState : null,
        storage_location: storageLocation,
        preparation_state: preparationState,
        purchased_at: parseDateInput(purchasedAt),
        opened_at: parseDateInput(openedAt),
        expiry_user_provided: parseDateInput(expiryUserProvided),
        last_verified_at: new Date().toISOString(),
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert('Delete item', `Remove "${item!.display_name}" from your pantry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeItem(item!.id);
            router.back();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete item');
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TextField label="Name*" value={name} onChangeText={setName} />

        <TextField
          label="Quantity"
          value={quantityValue}
          onChangeText={setQuantityValue}
          keyboardType="numeric"
        />
        <TextField label="Unit" value={quantityUnit} onChangeText={setQuantityUnit} />

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

        <TextField
          label="Purchased on (YYYY-MM-DD)"
          value={purchasedAt}
          onChangeText={setPurchasedAt}
          placeholder="2026-09-01"
        />
        <TextField
          label="Opened on (YYYY-MM-DD)"
          value={openedAt}
          onChangeText={setOpenedAt}
          placeholder="2026-09-10"
        />
        <TextField
          label="Expiry date (YYYY-MM-DD)"
          value={expiryUserProvided}
          onChangeText={setExpiryUserProvided}
          placeholder="2026-09-20"
        />

        <PrimaryButton label="Save changes" onPress={handleSave} loading={saving} />
        <PrimaryButton label="Delete item" onPress={handleDelete} variant="secondary" />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  notFound: {
    color: colors.textMuted,
    fontSize: 16,
  },
});
