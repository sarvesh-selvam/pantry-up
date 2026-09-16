import { Ionicons } from '@expo/vector-icons';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import type { RecipeYoutubeMetadata } from '../types/recipe';

interface Props {
  youtubeMetadata: RecipeYoutubeMetadata | null;
  /** Whether this specific step's text matched the recipe's key technique
   * (lib/matchTechniqueToStep.ts) — only changes the label; the same
   * cached videos show either way. */
  stepMatched: boolean;
}

/**
 * Real technique videos as of Phase 7 — reads the recipe's already-cached
 * `youtube_metadata` (looked up when the recipe detail screen was first
 * opened), never fetches per-step. Renders nothing when there's no cached
 * data yet, rather than a "coming soon" placeholder — Cooking Mode should
 * stay uncluttered when there's genuinely nothing to show. When the
 * current step doesn't obviously match the recipe's technique (a dumb
 * keyword check, not real NLP), this still surfaces the recipe's videos as
 * a persistent small section rather than forcing per-step precision, per
 * spec.
 */
export function TechniqueVideoSlot({ youtubeMetadata, stepMatched }: Props) {
  if (!youtubeMetadata || youtubeMetadata.results.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.label} numberOfLines={1}>
          {stepMatched ? `This step: ${youtubeMetadata.technique}` : `Watch: ${youtubeMetadata.technique}`}
        </Text>
      </View>
      <View style={styles.row}>
        {youtubeMetadata.results.slice(0, 3).map((video) => (
          <Pressable
            key={video.video_id}
            style={styles.thumbWrapper}
            onPress={() => Linking.openURL(video.video_url)}
            accessibilityRole="button"
            accessibilityLabel={`Watch ${video.title} on YouTube`}
          >
            <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} />
            <Text style={styles.thumbTitle} numberOfLines={2}>
              {video.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  thumbWrapper: {
    width: 100,
    gap: 2,
  },
  thumb: {
    width: 100,
    height: 60,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  thumbTitle: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
