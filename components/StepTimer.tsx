import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** A simple countdown timer for one cooking step. Resets whenever
 * `durationSeconds` changes (i.e. when the user moves to a different step). */
export function StepTimer({ durationSeconds }: { durationSeconds: number }) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(durationSeconds);
    setRunning(false);
  }, [durationSeconds]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const done = remaining <= 0;

  return (
    <View style={styles.container}>
      <Ionicons name="timer-outline" size={18} color={done ? colors.primary : colors.textMuted} />
      <Text style={[styles.clock, done && styles.clockDone]}>{done ? "Time's up!" : formatClock(remaining)}</Text>
      <Pressable
        style={styles.button}
        onPress={() => setRunning((prev) => !prev)}
        disabled={done}
        accessibilityRole="button"
        accessibilityLabel={running ? 'Pause timer' : 'Start timer'}
      >
        <Ionicons name={running ? 'pause' : 'play'} size={16} color={colors.primary} />
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => {
          setRunning(false);
          setRemaining(durationSeconds);
        }}
        accessibilityRole="button"
        accessibilityLabel="Reset timer"
      >
        <Ionicons name="refresh" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  clock: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    minWidth: 40,
  },
  clockDone: {
    color: colors.primary,
  },
  button: {
    padding: 2,
  },
});
