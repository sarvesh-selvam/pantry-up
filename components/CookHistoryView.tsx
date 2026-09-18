import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import { fetchCookEvents, type CookEventWithRecipeTitle } from '../lib/api/cookEvents';

/** Cook › History: every completed cook (one `cook_events` row per Finish
 * Cooking), newest first. Refetches on focus so a cook just finished
 * shows up on return. */
export function CookHistoryView() {
  const router = useRouter();
  const [events, setEvents] = useState<CookEventWithRecipeTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchCookEvents()
        .then((result) => {
          if (!cancelled) {
            setEvents(result);
            setError(null);
          }
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
    }, [])
  );

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={styles.spinner} />;
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing cooked yet — finish a recipe to see it here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(event) => event.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={item.recipe_id ? () => router.push(`/recipe/${item.recipe_id}`) : undefined}
          disabled={!item.recipe_id}
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
