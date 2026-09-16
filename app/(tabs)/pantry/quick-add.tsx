import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { colors, radii, spacing } from '../../../constants/theme';
import { useInventory } from '../../../lib/inventory/InventoryContext';
import { coerceFoodCategory, parseQuickAddText } from '../../../lib/quickAddParser';
import type { QuickAddDraftItem } from '../../../types/quickAdd';

export default function QuickAddScreen() {
  const router = useRouter();
  const { canonicalFoods, setQuickAddDraft } = useInventory();
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);

  async function handleParse() {
    if (!text.trim()) {
      Alert.alert('Nothing to add', 'Type a few items first, e.g. "milk, onions and rice".');
      return;
    }

    setParsing(true);
    try {
      const parsed = await parseQuickAddText(text, canonicalFoods);
      if (parsed.length === 0) {
        Alert.alert('Nothing to add', "Couldn't find any items in that text.");
        return;
      }

      const draft: QuickAddDraftItem[] = parsed.map((item, index) => ({
        key: `${Date.now()}-${index}`,
        rawText: item.rawText,
        displayName: item.displayName,
        quantityValue: item.quantityValue,
        quantityUnit: item.quantityUnit,
        canonicalFoodId: item.canonicalFood?.id ?? null,
        category: item.canonicalFood?.category ?? coerceFoodCategory(item.categoryGuess),
        included: true,
        source: 'quick_add',
      }));

      setQuickAddDraft(draft);
      router.push('/(tabs)/pantry/quick-add-review');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to parse that text.');
    } finally {
      setParsing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.hint}>
          List what you bought, separated by commas or "and". Quantities and units are optional.
        </Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={'e.g. 2 chicken breasts, milk, onions, cilantro and rice'}
          placeholderTextColor={colors.textMuted}
          multiline
          autoFocus
          editable={!parsing}
        />
        {parsing ? (
          <View style={styles.parsingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.parsingLabel}>Reading your list…</Text>
          </View>
        ) : (
          <PrimaryButton label="Parse items" onPress={handleParse} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
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
});
