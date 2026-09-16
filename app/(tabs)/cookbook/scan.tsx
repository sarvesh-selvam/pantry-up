import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth/AuthContext';
import { useCookbookScan } from '../../../lib/cookbook/CookbookScanContext';
import { pickCookbookPhoto, scanCookbookPage } from '../../../lib/cookbookScanner';

export default function CookbookScanScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { setScannedRecipeDraft } = useCookbookScan();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function handlePick(source: 'camera' | 'library') {
    try {
      const uri = await pickCookbookPhoto(source);
      if (uri) setPhotoUri(uri);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to open the camera.');
    }
  }

  async function handleScan() {
    if (!photoUri || !session) return;

    setScanning(true);
    try {
      const draft = await scanCookbookPage(session.user.id, photoUri);
      setScannedRecipeDraft(draft);
      router.push('/(tabs)/cookbook/scan-review');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to scan that page.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Take a photo of a cookbook page, or pick one from your library. We'll pull out the title,
        ingredients, and instructions for you to review before anything is saved.
      </Text>

      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="book-outline" size={40} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.pickRow}>
        <Pressable
          style={[styles.pickButton, styles.pickButtonSecondary]}
          onPress={() => handlePick('camera')}
          disabled={scanning}
        >
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.pickButtonLabel}>Camera</Text>
        </Pressable>
        <Pressable
          style={[styles.pickButton, styles.pickButtonSecondary]}
          onPress={() => handlePick('library')}
          disabled={scanning}
        >
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={styles.pickButtonLabel}>Photo Library</Text>
        </Pressable>
      </View>

      {scanning ? (
        <View style={styles.scanningRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.scanningLabel}>Reading the page…</Text>
        </View>
      ) : (
        <PrimaryButton label="Scan page" onPress={handleScan} disabled={!photoUri} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  preview: {
    width: '100%',
    height: 260,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  placeholder: {
    width: '100%',
    height: 260,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  pickButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pickButtonLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  scanningLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
