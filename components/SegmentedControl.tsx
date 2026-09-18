import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: Props<T>) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(segment.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radii.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md - 3,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelSelected: {
    color: colors.text,
  },
});
