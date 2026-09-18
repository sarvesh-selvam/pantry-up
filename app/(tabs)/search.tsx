import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../../constants/theme';
import { fetchCookEvents, type CookEventWithRecipeTitle } from '../../lib/api/cookEvents';

// History lives here for now — it's the real data source Global Search
// (Phase 5) will search across, and the Search tab is the architecturally
// simplest place to host it until Search itself is built. This screen
// isn't Search yet; the note below says so on purpose.
export default function SearchScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<CookEventWithRecipeTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCookEvents()
      .then((result) => {
        if (!cancelled) setEvents(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Search across your cooking history lands in a later phase.</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing cooked yet — finish a recipe to see it here.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(event) => event.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/recipe/${item.recipe_id}`)}
              accessibilityRole="button"
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.recipeTitle}
              </Text>
              <Text style={styles.rowMeta}>
                {formatDate(item.cooked_at)}
                {item.servings_prepared != null
                  ? ` · ${item.servings_prepared} serving${item.servings_prepared === 1 ? '' : 's'} made`
                  : ''}
                {item.servings_consumed != null ? `, ${item.servings_consumed} eaten` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
