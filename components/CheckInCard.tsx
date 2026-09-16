import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';
import { STORAGE_LOCATION_LABELS } from '../lib/formatInventory';
import type { CheckInCandidate } from '../lib/checkInScoring';
import type { CheckInResponse } from '../lib/checkInResponses';

interface ResponseButtonConfig {
  label: string;
  response: CheckInResponse;
  tone: 'confirm' | 'neutral' | 'destructive';
}

function buttonsFor(candidate: CheckInCandidate): ResponseButtonConfig[] {
  if (candidate.promptType === 'existence') {
    return [
      { label: 'Gone', response: { kind: 'existence', value: 'gone' }, tone: 'destructive' },
      { label: 'Still Here', response: { kind: 'existence', value: 'still_here' }, tone: 'confirm' },
      { label: 'Frozen', response: { kind: 'existence', value: 'frozen' }, tone: 'neutral' },
    ];
  }
  if (candidate.promptType === 'leftover') {
    return [
      { label: 'Discarded', response: { kind: 'leftover', value: 'discarded' }, tone: 'destructive' },
      { label: 'Ate It', response: { kind: 'leftover', value: 'ate_it' }, tone: 'confirm' },
      { label: 'Still Here', response: { kind: 'leftover', value: 'still_here' }, tone: 'neutral' },
    ];
  }
  return [
    { label: 'Empty', response: { kind: 'quantity', value: 'almost_empty' }, tone: 'neutral' },
    { label: 'Low', response: { kind: 'quantity', value: 'low' }, tone: 'neutral' },
    { label: 'Half', response: { kind: 'quantity', value: 'half' }, tone: 'neutral' },
    { label: 'Mostly Full', response: { kind: 'quantity', value: 'mostly_full' }, tone: 'neutral' },
    { label: 'Full', response: { kind: 'quantity', value: 'full' }, tone: 'neutral' },
  ];
}

const PROMPT_QUESTION: Record<CheckInCandidate['promptType'], string> = {
  existence: 'Still here?',
  quantity: 'Approximately how much remains?',
  leftover: 'Still in the fridge?',
};

export function CheckInCard({
  candidate,
  onRespond,
  disabled,
}: {
  candidate: CheckInCandidate;
  onRespond: (response: CheckInResponse) => void;
  disabled?: boolean;
}) {
  const { item } = candidate;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.display_name}</Text>
      <Text style={styles.detail}>
        {candidate.detail} · {STORAGE_LOCATION_LABELS[item.storage_location]}
      </Text>
      <Text style={styles.question}>{PROMPT_QUESTION[candidate.promptType]}</Text>

      <View style={styles.buttonRow}>
        {buttonsFor(candidate).map((button) => (
          <Pressable
            key={button.label}
            style={({ pressed }) => [
              styles.button,
              styles[`button_${button.tone}`],
              pressed && styles.buttonPressed,
              disabled && styles.buttonDisabled,
            ]}
            onPress={() => onRespond(button.response)}
            disabled={disabled}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles[`buttonText_${button.tone}`]]}>{button.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  detail: {
    fontSize: 13,
    color: colors.textMuted,
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  button_confirm: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  button_neutral: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  button_destructive: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonText_confirm: {
    color: colors.primaryText,
  },
  buttonText_neutral: {
    color: colors.text,
  },
  buttonText_destructive: {
    color: colors.danger,
  },
});
