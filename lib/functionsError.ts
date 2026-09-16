import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Both normalization Edge Functions (quick-add-parse, receipt-scan) return
 * `{ error: string }` with a non-2xx status on failure, which supabase-js
 * surfaces as a FunctionsHttpError whose real message is in the response
 * body, not `error.message`. Shared by lib/quickAddParser.ts and
 * lib/receiptScanner.ts so both report the same underlying failure clearly.
 */
export async function describeFunctionInvokeError(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : fallback;
}
