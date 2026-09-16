import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RescueRowCard } from '../../components/RescueRowCard';
import { colors, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth/AuthContext';
import { useInventory } from '../../lib/inventory/InventoryContext';
import { getRescueRowEntries } from '../../lib/rescueRow';

export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { items } = useInventory();

  const rescueRowEntries = useMemo(() => getRescueRowEntries(items), [items]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to PantryUp</Text>
      <Text style={styles.subtitle}>{session?.user.email}</Text>

      {rescueRowEntries.length > 0 && (
        <View style={styles.rescueSection}>
          <Text style={styles.sectionTitle}>Needs attention</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.rescueRow}>
              {rescueRowEntries.map((entry) => (
                <RescueRowCard
                  key={entry.item.id}
                  entry={entry}
                  onPress={() => router.push(`/(tabs)/pantry/${entry.item.id}`)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <Text style={styles.comingSoon}>
        Meal recommendations, Sous Chef, and Kitchen Check-In land in later phases. For now, head
        to the Pantry tab to manage your inventory.
      </Text>
      <View style={styles.signOut}>
        <PrimaryButton label="Log out" onPress={signOut} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  rescueSection: {
    width: '100%',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rescueRow: {
    flexDirection: 'row',
  },
  comingSoon: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  signOut: {
    marginTop: spacing.lg,
    width: '60%',
  },
});
