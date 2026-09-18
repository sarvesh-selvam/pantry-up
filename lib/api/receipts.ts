import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';

/**
 * Uploads a JPEG receipt photo (already base64-encoded, already normalized
 * to JPEG — see lib/receiptScanner.ts) to the private "receipts" bucket,
 * under the user's own folder (required by the bucket's RLS policies — see
 * db/migrations/0007_receipts_storage.sql). Returns the storage path so the
 * caller can hand it to the receipt-scan Edge Function.
 */
export async function uploadReceiptImage(userId: string, base64Jpeg: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('receipts').upload(path, decode(base64Jpeg), {
    contentType: 'image/jpeg',
  });
  if (error) throw error;
  return path;
}
