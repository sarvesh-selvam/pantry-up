import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckInBanner } from '../../components/CheckInBanner';
import { KitchenStatusRow } from '../../components/KitchenStatusRow';
import { KitchenSummaryCard } from '../../components/KitchenSummaryCard';
import { MacroRingRow } from '../../components/MacroRingRow';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RecipeCard } from '../../components/RecipeCard';
import { RescueRowCard } from '../../components/RescueRowCard';
import { SousChefEntryBar } from '../../components/SousChefEntryBar';
import { colors, spacing } from '../../constants/theme';
import { fetchDailyNutrition, todayLocalDate } from '../../lib/api/dailyNutrition';
import { fetchKitchenSummary } from '../../lib/api/kitchenSummary';
import { useAuth } from '../../lib/auth/AuthContext';
import { getCheckInCandidates } from '../../lib/checkInScoring';
import { isUncertain } from '../../lib/formatInventory';
import { useInventory } from '../../lib/inventory/InventoryContext';
import { getRescueRowEntries } from '../../lib/rescueRow';
import { useDailySuggestions, useOpenDailySuggestion } from '../../lib/suggestions/DailySuggestionsContext';
import type { DailyNutrition } from '../../types/database';

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { items } = useInventory();

  const rescueRowEntries = useMemo(() => getRescueRowEntries(items), [items]);
  const checkInCandidates = useMemo(() => getCheckInCandidates(items), [items]);
  const uncertainCount = useMemo(() => items.filter(isUncertain).length, [items]);

  const [todayNutrition, setTodayNutrition] = useState<DailyNutrition | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchDailyNutrition(session.user.id, todayLocalDate())
      .then((result) => {
        if (!cancelled) setTodayNutrition(result);
      })
      .catch(() => {
        // Non-fatal — Home's ring is a glanceable summary, not critical path.
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const {
    suggestions: dailySuggestions,
    isLoading: suggestionsLoading,
    error: suggestionsError,
  } = useDailySuggestions();
  const openSuggestion = useOpenDailySuggestion();
  const suggestions = useMemo(() => dailySuggestions.map((d) => d.suggestion), [dailySuggestions]);
  const [kitchenSummary, setKitchenSummary] = useState<string | null>(null);
  const summaryRequested = useRef(false);
  const isMounted = useRef(true);
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    []
  );

  // The summary card narrates exactly this data (Rescue Row + today's
  // suggestions) — requested once per mount, after suggestions settle, and
  // skipped entirely when there's nothing real to say rather than prompting
  // the model into manufacturing something. Fire-and-forget: the rest of
  // Home renders immediately either way.
  useEffect(() => {
    if (suggestionsLoading || summaryRequested.current) return;
    if (rescueRowEntries.length === 0 && suggestions.length === 0) return;
    summaryRequested.current = true;
    fetchKitchenSummary(
      rescueRowEntries.map((entry) => ({
        name: entry.item.display_name,
        status: entry.statusLabel,
        detail: entry.detail,
      })),
      suggestions.map((r) => ({
        title: r.title,
        coverage: r.pantry_coverage_label,
        missing: r.missing_ingredient_count,
      }))
    )
      .then((summary) => {
        if (isMounted.current) setKitchenSummary(summary);
      })
      .catch(() => {
        // Non-fatal — the card just doesn't render without it.
      });
  }, [suggestionsLoading, rescueRowEntries, suggestions]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Welcome to PantryUp</Text>
          <Text style={styles.subtitle}>{session?.user.email}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Section A: compact daily macro summary — a glance, not the full
          Macros tab experience. Always shown (even at all-zero) so Home has
          a consistent, predictable layout day to day. */}
      <View style={styles.macroWrapper}>
        <MacroRingRow
          calories={todayNutrition?.calories ?? 0}
          proteinG={todayNutrition?.protein_g ?? 0}
          carbsG={todayNutrition?.carbs_g ?? 0}
          fatG={todayNutrition?.fat_g ?? 0}
          size="compact"
        />
      </View>

      <View style={styles.entryBarWrapper}>
        <SousChefEntryBar onPress={() => router.push('/sous-chef')} />
      </View>

      {kitchenSummary && (
        <View style={styles.summaryWrapper}>
          <KitchenSummaryCard summary={kitchenSummary} />
        </View>
      )}

      {/* Section B: Rescue Row — what needs attention soon. */}
      {rescueRowEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Needs attention</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.horizontalRow}>
              {rescueRowEntries.map((entry) => (
                <RescueRowCard
                  key={entry.item.id}
                  entry={entry}
                  onPress={() => router.push(`/(tabs)/pantry/${entry.item.id}`)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Section C: What should I cook? */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What should I cook?</Text>
        {suggestionsLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.suggestionsSpinner} />
        ) : suggestionsError ? (
          <Text style={styles.suggestionsError}>{suggestionsError}</Text>
        ) : suggestions.length === 0 ? (
          <Text style={styles.suggestionsEmpty}>
            Add a few items to your pantry and check back for cooking ideas.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.horizontalRow}>
              {dailySuggestions.map(({ suggestion }, index) => (
                <RecipeCard
                  key={suggestion.title}
                  recipe={suggestion}
                  variant="compact"
                  onPress={() => openSuggestion(index)}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Section D: Kitchen Status + the Check-In entry point. */}
      {items.length > 0 && (
        <View style={styles.statusWrapper}>
          <KitchenStatusRow
            totalItems={items.length}
            needsCheckIn={checkInCandidates.length}
            uncertain={uncertainCount}
          />
        </View>
      )}

      {checkInCandidates.length > 0 && (
        <View style={styles.statusWrapper}>
          <CheckInBanner count={checkInCandidates.length} onPress={() => router.push('/check-in')} />
        </View>
      )}

      <View style={styles.signOut}>
        <PrimaryButton label="Log out" onPress={signOut} variant="secondary" />
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  titleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  macroWrapper: {
    width: '100%',
    marginTop: spacing.md,
  },
  entryBarWrapper: {
    width: '100%',
    marginTop: spacing.md,
  },
  summaryWrapper: {
    width: '100%',
    marginTop: spacing.md,
  },
  statusWrapper: {
    width: '100%',
    marginTop: spacing.sm,
  },
  section: {
    width: '100%',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  horizontalRow: {
    flexDirection: 'row',
  },
  suggestionsSpinner: {
    alignSelf: 'flex-start',
  },
  suggestionsError: {
    color: colors.danger,
    fontSize: 13,
  },
  suggestionsEmpty: {
    color: colors.textMuted,
    fontSize: 13,
  },
  signOut: {
    marginTop: spacing.lg,
    width: '60%',
  },
});
