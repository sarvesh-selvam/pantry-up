// Receipt Scan — Phase 2. Picks/captures a photo, uploads it to the private
// "receipts" Storage bucket, then calls the receipt-scan Edge Function
// (server-side Claude vision + the same canonical-food matching pipeline
// Quick Add uses — see lib/quickAddParser.ts's mapNormalizedItems). Never
// writes to inventory_items itself; the caller routes the result through
// the same Quick Add review/confirm screen before saving anything.
//
// Photo capture itself lives in lib/imageCapture.ts — Cookbook Scan
// (Phase 6) reuses it too, per spec.

import { pickPhoto, normalizeToJpegBase64, type PhotoSource } from './imageCapture';
import { uploadReceiptImage } from './api/receipts';
import { describeFunctionInvokeError } from './functionsError';
import { mapNormalizedItems, type NormalizedItemResponse, type ParsedQuickAddItem } from './quickAddParser';
import { supabase } from './supabase';
import type { CanonicalFood } from '../types/database';

export type ReceiptPhotoSource = PhotoSource;

export async function pickReceiptPhoto(source: ReceiptPhotoSource): Promise<string | null> {
  return pickPhoto(source, 'receipt');
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
