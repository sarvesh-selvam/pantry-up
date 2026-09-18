import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecipeCard } from '../components/RecipeCard';
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../lib/auth/AuthContext';
import { createRecipe, fetchRecipeById, suggestionToRecipeInsert } from '../lib/api/recipes';
import { fetchRecipeVideos, toVideoLookupInput } from '../lib/api/youtube';
import { useRecipePreview } from '../lib/recipePreview/RecipePreviewContext';
import { sendSousChefMessage, type SousChefMessage, type SousChefRecipeContext } from '../lib/sousChef';
import type { RecipeSuggestion } from '../types/recipe';

interface DisplayMessage {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: RecipeSuggestion | null;
  /** Set once the user saves this reply's recipe from the preview screen —
   * nothing is written to `recipes` before that. */
  savedRecipeId?: string | null;
}

export default function SousChefScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
  const [recipeContext, setRecipeContext] = useState<SousChefRecipeContext | null>(null);

  useEffect(() => {
    if (!recipeId) return;
    fetchRecipeById(recipeId)
      .then((recipe) => {
        if (!recipe) return;
        setRecipeContext({
          title: recipe.title,
          ingredients: recipe.ingredients.map(
            (ing) =>
              `${ing.quantity_value != null ? `${ing.quantity_value}${ing.quantity_unit ? ` ${ing.quantity_unit}` : ''} ` : ''}${ing.display_name}`
          ),
          instructions: recipe.instructions,
        });
      })
      .catch(() => {
        // Non-fatal — chat still works without recipe grounding.
      });
  }, [recipeId]);

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      key: 'intro',
      role: 'assistant',
      content: recipeId
        ? "I'm here if you have a question about this recipe — substitutions, technique, timing, anything."
        : "Hi, I'm Sous Chef. Tell me what you're in the mood for — e.g. \"something spicy, 30 minutes, no chicken\" — and I'll suggest something using what's in your pantry.",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const { setPreview } = useRecipePreview();

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: DisplayMessage = { key: `${Date.now()}-user`, role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const history: SousChefMessage[] = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const { reply, recipe } = await sendSousChefMessage(history, recipeContext ?? undefined);
      const assistantKey = `${Date.now()}-assistant`;
      setMessages((prev) => [...prev, { key: assistantKey, role: 'assistant', content: reply, recipe }]);

      // Fire-and-forget: the reply/card render immediately; the compact
      // video preview pops in once the real YouTube search resolves,
      // rather than blocking the whole chat turn on it.
      if (recipe) {
        fetchRecipeVideos(toVideoLookupInput(recipe))
          .then((youtubeMetadata) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.key === assistantKey && m.recipe ? { ...m, recipe: { ...m.recipe, youtube_metadata: youtubeMetadata } } : m
              )
            );
          })
          .catch(() => {
            // Non-fatal — the card just renders without a video preview.
          });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          key: `${Date.now()}-error`,
          role: 'assistant',
          content:
            err instanceof Error ? `Sorry, something went wrong: ${err.message}` : 'Sorry, something went wrong.',
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleOpenRecipe(message: DisplayMessage) {
    const recipe = message.recipe;
    if (!recipe || !session) return;
    if (message.savedRecipeId) {
      router.push(`/recipe/${message.savedRecipeId}`);
      return;
    }
    const userId = session.user.id;
    // The user request that produced this reply — the nearest user message
    // before it — is the explainability record's `constraints`.
    const index = messages.findIndex((m) => m.key === message.key);
    const request = messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === 'user');
    setPreview({
      suggestion: recipe,
      save: async () => {
        const saved = await createRecipe(
          userId,
          suggestionToRecipeInsert(recipe, request?.content ?? 'Sous Chef suggestion')
        );
        setMessages((prev) => prev.map((m) => (m.key === message.key ? { ...m, savedRecipeId: saved.id } : m)));
        return saved.id;
      },
    });
    router.push('/recipe-preview');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {recipeContext && (
        <View style={styles.contextBanner}>
          <Ionicons name="restaurant-outline" size={14} color={colors.primary} />
          <Text style={styles.contextBannerText} numberOfLines={1}>
            Cooking: {recipeContext.title}
          </Text>
        </View>
      )}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.role === 'user' && styles.bubbleRowUser]}>
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>
                {item.content}
              </Text>
            </View>
            {item.recipe && (
              <View style={styles.cardWrapper}>
                <RecipeCard recipe={item.recipe} onPress={() => handleOpenRecipe(item)} variant="full" />
                <Text style={styles.tapHint}>
                  {item.savedRecipeId ? 'Saved to your Cookbook — tap to open' : 'Tap the recipe to preview and save it'}
                </Text>
              </View>
            )}
          </View>
        )}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.typingLabel}>Sous Chef is thinking…</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask for a recipe idea…"
          placeholderTextColor={colors.textMuted}
          editable={!sending}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Ionicons name="arrow-up" size={20} color={colors.primaryText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.primary}14`,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    flexShrink: 1,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  bubbleRow: {
    gap: spacing.xs,
  },
  bubbleRowUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
  },
  bubbleText: {
    fontSize: 15,
    color: colors.text,
  },
  bubbleTextUser: {
    color: colors.primaryText,
  },
  cardWrapper: {
    width: '100%',
    gap: 4,
  },
  tapHint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  typingLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
