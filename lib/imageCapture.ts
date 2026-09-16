// Shared camera/photo-library capture — originally built for Receipt Scan
// (Phase 2), reused as-is by Cookbook Scan (Phase 6) per spec. Claude's
// vision API doesn't accept HEIC — the iOS camera's default format — so
// every photo is normalized to JPEG (and downscaled, since neither a
// receipt nor a cookbook page needs full camera resolution) before it
// ever leaves the device.

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'camera' | 'library';

/**
 * Prompts for permission and opens the camera or photo library. Returns the
 * picked photo's local URI, or null if the user cancelled.
 */
export async function pickPhoto(source: PhotoSource, subject: string): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? `Camera access is required to scan a ${subject}.`
        : `Photo library access is required to pick a ${subject} photo.`
    );
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

export async function normalizeToJpegBase64(uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.7,
    base64: true,
  });
  if (!manipulated.base64) {
    throw new Error('Failed to process the photo.');
  }
  return manipulated.base64;
}
