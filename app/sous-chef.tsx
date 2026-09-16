import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { createRecipe, suggestionToRecipeInsert } from '../lib/api/recipes';
import { sendSousChefMessage, type SousChefMessage } from '../lib/sousChef';
import type { RecipeSuggestion } from '../types/recipe';

interface DisplayMessage {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: RecipeSuggestion | null;
}

export default function SousChefScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      key: 'intro',
      role: 'assistant',
      content:
        "Hi, I'm Sous Chef. Tell me what you're in the mood for — e.g. \"something spicy, 30 minutes, no chicken\" — and I'll suggest something using what's in your pantry.",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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
      const { reply, recipe } = await sendSousChefMessage(history);
      setMessages((prev) => [
        ...prev,
        { key: `${Date.now()}-assistant`, role: 'assistant', content: reply, recipe },
      ]);
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

  async function handleSaveRecipe(message: DisplayMessage) {
    if (!message.recipe || !session) return;
    setSavingKey(message.key);
    try {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      const saved = await createRecipe(
        session.user.id,
        suggestionToRecipeInsert(message.recipe, lastUserMessage?.content ?? 'Sous Chef suggestion')
      );
      router.push(`/recipe/${saved.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
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
                <RecipeCard recipe={item.recipe} onPress={() => handleSaveRecipe(item)} variant="full" />
                {savingKey === item.key && (
                  <View style={styles.savingOverlay}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}
                <Text style={styles.tapHint}>Tap the recipe to save it and view details</Text>
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
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
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
