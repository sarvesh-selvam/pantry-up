import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckInCard } from '../components/CheckInCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../constants/theme';
import { applyCheckInResponse, type CheckInResponse } from '../lib/checkInResponses';
import { getCheckInBatch } from '../lib/checkInScoring';
import { useInventory } from '../lib/inventory/InventoryContext';

export default function CheckInScreen() {
  const router = useRouter();
  const { items, editItem, removeItem } = useInventory();

  // Snapshot once at mount — a session is a fixed batch. Later inventory
  // changes (from responses within this very session) shouldn't reshuffle
  // or grow the list the user is currently working through.
  const [batch] = useState(() => getCheckInBatch(items));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [applying, setApplying] = useState(false);

  const current = batch[currentIndex];
  const isDone = currentIndex >= batch.length;

  async function handleRespond(response: CheckInResponse) {
    if (!current || applying) return;
    setApplying(true);
    try {
      await applyCheckInResponse(current.item.id, response, { editItem, removeItem });
      setCurrentIndex((i) => i + 1);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update this item');
    } finally {
      setApplying(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        {!isDone && batch.length > 0 && (
          <Text style={styles.progress}>
            {currentIndex + 1} of {batch.length}
          </Text>
        )}
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {batch.length === 0 ? (
          <SummaryState icon="checkmark-circle-outline" title="All caught up!" subtitle="Nothing needs a check right now." />
        ) : isDone ? (
          <SummaryState
            icon="checkmark-done-circle-outline"
            title={`${batch.length} item${batch.length === 1 ? '' : 's'} reviewed`}
            subtitle="Your pantry is more up to date now."
          />
        ) : (
          <CheckInCard candidate={current} onRespond={handleRespond} disabled={applying} />
        )}
      </View>

      {(batch.length === 0 || isDone) && (
        <View style={styles.doneButton}>
          <PrimaryButton label="Back to Home" onPress={() => router.back()} />
        </View>
      )}
    </SafeAreaView>
  );
}

function SummaryState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View style={styles.summary}>
      <Ionicons name={icon} size={48} color={colors.primary} />
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  progress: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  summary: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  summarySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  doneButton: {
    padding: spacing.md,
  },
});
