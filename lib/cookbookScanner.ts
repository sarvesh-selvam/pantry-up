// Cookbook Scan — Phase 6. Picks/captures a photo of a physical cookbook
// page, uploads it to the private "receipts" Storage bucket (reused from
// Receipt Scan, Phase 2 — see lib/api/receipts.ts's uploadCookbookScanImage),
// then calls the cookbook-scan Edge Function. Never writes to `recipes`
// itself; the caller routes the result through
// app/(tabs)/cookbook/scan-review.tsx before saving anything.

import { pickPhoto, normalizeToJpegBase64, type PhotoSource } from './imageCapture';
import { uploadCookbookScanImage } from './api/receipts';
import { describeFunctionInvokeError } from './functionsError';
import { supabase } from './supabase';
import type { ScannedRecipeDraft } from '../types/recipe';

export type CookbookPhotoSource = PhotoSource;

export async function pickCookbookPhoto(source: CookbookPhotoSource): Promise<string | null> {
  return pickPhoto(source, 'cookbook page');
}

export async function scanCookbookPage(userId: string, photoUri: string): Promise<ScannedRecipeDraft> {
  const base64Jpeg = await normalizeToJpegBase64(photoUri);
  const storagePath = await uploadCookbookScanImage(userId, base64Jpeg);

  const { data, error } = await supabase.functions.invoke<{ recipe: ScannedRecipeDraft }>('cookbook-scan', {
    body: { storagePath },
  });

  if (error) {
    throw new Error(await describeFunctionInvokeError(error, 'Cookbook scan failed'));
  }
  if (!data) {
    throw new Error('Cookbook scan returned no data');
  }

  return data.recipe;
}
