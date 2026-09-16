import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth/AuthContext';

export default function HomeScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to PantryUp</Text>
      <Text style={styles.subtitle}>{session?.user.email}</Text>
      <Text style={styles.comingSoon}>
        Meal recommendations, Sous Chef, and Kitchen Check-In land in later phases. For now, head
        to the Pantry tab to manage your inventory.
      </Text>
      <View style={styles.signOut}>
        <PrimaryButton label="Log out" onPress={signOut} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
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
  comingSoon: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  signOut: {
    marginTop: spacing.lg,
    width: '60%',
  },
});
