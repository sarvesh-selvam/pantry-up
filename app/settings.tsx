import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../lib/auth/AuthContext';
import { fetchUserPreferences, updateUserPreferences } from '../lib/api/userPreferences';
import {
  CUISINE_OPTIONS,
  CUISINE_TIER_VALUES,
  DIETARY_RESTRICTION_OPTIONS,
  EQUIPMENT_OPTIONS,
  weightToTier,
  type CuisineWeightTier,
} from '../lib/preferenceOptions';
import type { SkillLevel, UserPreferences } from '../types/database';

const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const TIER_ORDER: CuisineWeightTier[] = ['avoid', 'neutral', 'favorite'];
const TIER_LABELS: Record<CuisineWeightTier, string> = { avoid: 'Avoid', neutral: 'Neutral', favorite: 'Favorite' };

export default function SettingsScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [cuisineWeights, setCuisineWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchUserPreferences(session.user.id)
      .then((prefs: UserPreferences | null) => {
        if (cancelled || !prefs) return;
        setSkillLevel(prefs.skill_level);
        setDietaryRestrictions(prefs.dietary_restrictions);
        setEquipment(prefs.equipment);
        setCuisineWeights(prefs.cuisine_weights);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load preferences');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const cuisineTiers = useMemo(() => {
    const tiers: Record<string, CuisineWeightTier> = {};
    for (const cuisine of CUISINE_OPTIONS) {
      tiers[cuisine] = weightToTier(cuisineWeights[cuisine]);
    }
    return tiers;
  }, [cuisineWeights]);

  function toggleRestriction(key: string) {
    setDietaryRestrictions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleEquipment(key: string) {
    setEquipment((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function cycleCuisineTier(cuisine: string) {
    const currentTier = cuisineTiers[cuisine];
    const nextTier = TIER_ORDER[(TIER_ORDER.indexOf(currentTier) + 1) % TIER_ORDER.length];
    setCuisineWeights((prev) => ({ ...prev, [cuisine]: CUISINE_TIER_VALUES[nextTier] }));
  }

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await updateUserPreferences(session.user.id, {
        skill_level: skillLevel,
        dietary_restrictions: dietaryRestrictions,
        equipment,
        cuisine_weights: cuisineWeights,
      });
      Alert.alert('Saved', 'Your preferences are updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        These shape recommendation ranking (Home's suggestions and Sous Chef) — dietary restrictions are still a hard
        filter enforced before anything else runs, never just a preference. Only edits made here ever change them;
        cooking behavior nudges ranking, not these stored values.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>Skill level</Text>
      <View style={styles.segmentRow}>
        {SKILL_LEVELS.map(({ value, label }) => (
          <Pressable
            key={value}
            style={[styles.segment, skillLevel === value && styles.segmentActive]}
            onPress={() => setSkillLevel(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: skillLevel === value }}
          >
            <Text style={[styles.segmentLabel, skillLevel === value && styles.segmentLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Dietary restrictions</Text>
      <Text style={styles.sectionHint}>Hard constraints — a recipe violating one of these is never suggested.</Text>
      <View style={styles.chipRow}>
        {DIETARY_RESTRICTION_OPTIONS.map(({ key, label }) => {
          const active = dietaryRestrictions.includes(key);
          return (
            <Pressable
              key={key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleRestriction(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Equipment you have</Text>
      <Text style={styles.sectionHint}>Recipes needing equipment you don't have rank a little lower.</Text>
      <View style={styles.chipRow}>
        {EQUIPMENT_OPTIONS.map(({ key, label }) => {
          const active = equipment.includes(key);
          return (
            <Pressable
              key={key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleEquipment(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Cuisine preferences</Text>
      <Text style={styles.sectionHint}>
        A soft signal, not a filter — tap to cycle Avoid / Neutral / Favorite. Cooking a cuisine often nudges its
        ranking up over time too, but never rewrites what you set here.
      </Text>
      <View style={styles.chipRow}>
        {CUISINE_OPTIONS.map((cuisine) => {
          const tier = cuisineTiers[cuisine];
          return (
            <Pressable
              key={cuisine}
              style={[styles.chip, tier !== 'neutral' && (tier === 'favorite' ? styles.chipFavorite : styles.chipAvoid)]}
              onPress={() => cycleCuisineTier(cuisine)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.chipLabel,
                  tier !== 'neutral' && styles.chipLabelActive,
                ]}
              >
                {cuisine} · {TIER_LABELS[tier]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.saveButton}>
        <PrimaryButton label="Save preferences" onPress={handleSave} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  intro: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  segmentLabelActive: {
    color: colors.primaryText,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipFavorite: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipAvoid: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  chipLabelActive: {
    color: colors.primaryText,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
