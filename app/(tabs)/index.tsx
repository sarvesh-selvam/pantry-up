import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RecipeCard } from '../../components/RecipeCard';
import { RescueRowCard } from '../../components/RescueRowCard';
import { SousChefEntryBar } from '../../components/SousChefEntryBar';
import { colors, spacing } from '../../constants/theme';
import { createRecipe, suggestionToRecipeInsert } from '../../lib/api/recipes';
import { fetchHomeSuggestions } from '../../lib/api/recipeSuggestions';
import { useAuth } from '../../lib/auth/AuthContext';
import { useInventory } from '../../lib/inventory/InventoryContext';
import { getRescueRowEntries } from '../../lib/rescueRow';
import type { RecipeSuggestion } from '../../types/recipe';

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { items } = useInventory();

  const rescueRowEntries = useMemo(() => getRescueRowEntries(items), [items]);

  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [savingTitle, setSavingTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    fetchHomeSuggestions()
      .then((recipes) => {
        if (!cancelled) setSuggestions(recipes);
      })
      .catch((err) => {
        if (!cancelled) setSuggestionsError(err instanceof Error ? err.message : 'Failed to load suggestions');
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Regenerating on every inventory change would be expensive (an LLM
    // call per keystroke-adjacent edit) — Home suggestions refresh once per
    // visit to this screen mount, not live with every inventory edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveSuggestion(suggestion: RecipeSuggestion) {
    if (!session) return;
    setSavingTitle(suggestion.title);
    try {
      const saved = await createRecipe(
        session.user.id,
        suggestionToRecipeInsert(suggestion, 'Home suggestion (no specific request)')
      );
      router.push(`/recipe/${saved.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSavingTitle(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to PantryUp</Text>
      <Text style={styles.subtitle}>{session?.user.email}</Text>

      <View style={styles.entryBarWrapper}>
        <SousChefEntryBar onPress={() => router.push('/sous-chef')} />
      </View>

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
              {suggestions.map((suggestion) => (
                <RecipeCard
                  key={suggestion.title}
                  recipe={suggestion}
                  variant="compact"
                  onPress={() => handleSaveSuggestion(suggestion)}
                />
              ))}
            </View>
          </ScrollView>
        )}
        {savingTitle && (
          <View style={styles.savingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.savingLabel}>Saving "{savingTitle}"…</Text>
          </View>
        )}
      </View>

      <Text style={styles.comingSoon}>
        Cooking mode, nutrition, and Kitchen Check-In land in later phases. Head to the Pantry tab
        to manage your inventory.
      </Text>
      <View style={styles.signOut}>
        <PrimaryButton label="Log out" onPress={signOut} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
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
  entryBarWrapper: {
    width: '100%',
    marginTop: spacing.md,
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
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  savingLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  comingSoon: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  signOut: {
    marginTop: spacing.lg,
    width: '60%',
  },
});
