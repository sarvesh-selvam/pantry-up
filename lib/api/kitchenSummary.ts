// Client for the kitchen-summary Edge Function — a short, witty narration
// of Home's Rescue Row + today's ranked suggestions, grounded strictly in
// that already-on-screen data (see the function's header comment).

import { supabase } from '../supabase';
import { describeFunctionInvokeError } from '../functionsError';

export interface KitchenSummaryRescueItem {
  name: string;
  status: string;
  detail: string;
}

export interface KitchenSummarySuggestion {
  title: string;
  coverage: string;
  missing: number;
}

export async function fetchKitchenSummary(
  rescueItems: KitchenSummaryRescueItem[],
  suggestions: KitchenSummarySuggestion[]
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ summary: string }>('kitchen-summary', {
    body: { rescueItems, suggestions },
  });

  if (error) {
    throw new Error(await describeFunctionInvokeError(error, 'Failed to load kitchen summary'));
  }
  if (!data) {
    throw new Error('kitchen-summary returned no data');
  }
  return data.summary;
}
