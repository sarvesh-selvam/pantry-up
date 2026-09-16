// Receipt Scan — Phase 2. Picks/captures a photo, uploads it to the private
// "receipts" Storage bucket, then calls the receipt-scan Edge Function
// (server-side Claude vision + the same canonical-food matching pipeline
// Quick Add uses — see lib/quickAddParser.ts's mapNormalizedItems). Never
// writes to inventory_items itself; the caller routes the result through
// the same Quick Add review/confirm screen before saving anything.

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { uploadReceiptImage } from './api/receipts';
import { describeFunctionInvokeError } from './functionsError';
import { mapNormalizedItems, type NormalizedItemResponse, type ParsedQuickAddItem } from './quickAddParser';
import { supabase } from './supabase';
import type { CanonicalFood } from '../types/database';

export type ReceiptPhotoSource = 'camera' | 'library';

/**
 * Prompts for permission and opens the camera or photo library. Returns the
 * picked photo's local URI, or null if the user cancelled.
 */
export async function pickReceiptPhoto(source: ReceiptPhotoSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera access is required to scan a receipt.'
        : 'Photo library access is required to pick a receipt photo.'
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

// Claude's vision API doesn't accept HEIC — the iOS camera's default format
// — so every photo is normalized to JPEG (and downscaled, since receipts
// don't need full camera resolution) before it ever leaves the device.
async function normalizeToJpegBase64(uri: string): Promise<string> {
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

/**
 * Uploads the given photo and asks the receipt-scan Edge Function to
 * extract and normalize its grocery line items.
 */
export async function scanReceipt(
  userId: string,
  photoUri: string,
  canonicalFoods: CanonicalFood[]
): Promise<ParsedQuickAddItem[]> {
  const base64Jpeg = await normalizeToJpegBase64(photoUri);
  const storagePath = await uploadReceiptImage(userId, base64Jpeg);

  const { data, error } = await supabase.functions.invoke<{ items: NormalizedItemResponse[] }>(
    'receipt-scan',
    { body: { storagePath } }
  );

  if (error) {
    throw new Error(await describeFunctionInvokeError(error, 'Receipt scan failed'));
  }
  if (!data) {
    throw new Error('Receipt scan returned no data');
  }

  return mapNormalizedItems(data.items, canonicalFoods);
}
