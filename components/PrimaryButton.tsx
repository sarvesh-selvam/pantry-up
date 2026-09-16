import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary' }: Props) {
  const isSecondary = variant === 'secondary';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        isSecondary && styles.buttonSecondary,
        (pressed || disabled) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.primary : colors.primaryText} />
      ) : (
        <Text style={[styles.label, isSecondary && styles.labelSecondary]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  labelSecondary: {
    color: colors.primary,
  },
});
