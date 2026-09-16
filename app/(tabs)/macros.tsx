import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MacroRingRow } from '../../components/MacroRingRow';
import { colors, radii, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth/AuthContext';
import { fetchDailyNutrition, shiftLocalDate, todayLocalDate } from '../../lib/api/dailyNutrition';
import type { DailyNutrition } from '../../types/database';

function formatDateLabel(date: string): string {
  const today = todayLocalDate();
  if (date === today) return 'Today';
  if (date === shiftLocalDate(today, -1)) return 'Yesterday';
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MacrosScreen() {
  const { session } = useAuth();
  const [date, setDate] = useState(todayLocalDate());
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    fetchDailyNutrition(session.user.id, date)
      .then((result) => {
        if (!cancelled) setNutrition(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load nutrition');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, date]);

  const isToday = date === todayLocalDate();

  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setDate((d) => shiftLocalDate(d, -1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
        <Pressable
          onPress={() => setDate((d) => shiftLocalDate(d, 1))}
          hitSlop={12}
          disabled={isToday}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Ionicons name="chevron-forward" size={22} color={isToday ? colors.border : colors.text} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={styles.card}>
          <MacroRingRow
            calories={nutrition?.calories ?? 0}
            proteinG={nutrition?.protein_g ?? 0}
            carbsG={nutrition?.carbs_g ?? 0}
            fatG={nutrition?.fat_g ?? 0}
            size="full"
          />
          {!nutrition && (
            <Text style={styles.emptyText}>
              Nothing logged {isToday ? 'yet today' : 'for this day'} — finish cooking a recipe or eat a
              leftover to start tracking.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    minWidth: 100,
    textAlign: 'center',
  },
  spinner: {
    marginTop: spacing.xl,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
