import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * A Supabase client scoped to the calling user's own JWT (forwarded from the
 * client's Authorization header), so every query — reading canonical_foods,
 * downloading a receipt photo — goes through RLS as that user, not as an
 * elevated service role. This function never writes to inventory_items; it
 * only reads reference data and returns suggestions for the client to
 * confirm (see the Phase 2 rule: the LLM must never silently write to
 * inventory).
 */
export function getUserSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
}
