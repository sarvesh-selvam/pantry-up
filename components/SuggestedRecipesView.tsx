import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import { useDailySuggestions, useOpenDailySuggestion } from '../lib/suggestions/DailySuggestionsContext';
import { RecipeCard } from './RecipeCard';

/** Cook › Suggested: today's (at most three) AI suggestions. Unsaved until
 * the user taps the bookmark here or Save on the preview screen. */
export function SuggestedRecipesView() {
  const openSuggestion = useOpenDailySuggestion();
  const { suggestions, isLoading, error, saveSuggestion } = useDailySuggestions();
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  async function handleSave(index: number) {
    setSavingIndex(index);
    try {
      await saveSuggestion(index);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>
        Ranked by what's running out, what you have, and what you've cooked lately.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : suggestions.length === 0 ? (
        <Text style={styles.empty}>Add a few items to your pantry and check back for cooking ideas.</Text>
      ) : (
        suggestions.map(({ suggestion, savedRecipeId }, index) => (
          <View key={suggestion.title} style={styles.cardWrapper}>
            <RecipeCard recipe={suggestion} onPress={() => openSuggestion(index)} />
            <Pressable
              style={styles.saveButton}
              onPress={() => handleSave(index)}
              disabled={savedRecipeId != null || savingIndex != null}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={savedRecipeId ? 'Saved to Cookbook' : 'Save to Cookbook'}
            >
              {savingIndex === index ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={savedRecipeId ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={savedRecipeId ? colors.primary : colors.textMuted}
                />
              )}
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  cardWrapper: {
    position: 'relative',
  },
  saveButton: {
    position: 'absolute',
    top: spacing.sm + spacing.xs,
    right: spacing.sm + spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 6,
    minWidth: 30,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
