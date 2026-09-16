// Client for the sous-chef-chat Edge Function. Stateless per request — this
// module sends the full text-only message history each call; the server
// re-gathers fresh inventory/rescue/preference data every turn rather than
// trusting anything from earlier in the conversation (see that function's
// header comment for why).

import { supabase } from './supabase';
import { describeFunctionInvokeError } from './functionsError';
import type { RecipeSuggestion } from '../types/recipe';

export interface SousChefMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SousChefReply {
  reply: string;
  recipe: RecipeSuggestion | null;
}

export async function sendSousChefMessage(history: SousChefMessage[]): Promise<SousChefReply> {
  const { data, error } = await supabase.functions.invoke<SousChefReply>('sous-chef-chat', {
    body: { messages: history },
  });

  if (error) {
    throw new Error(await describeFunctionInvokeError(error, 'Sous Chef failed to respond'));
  }
  if (!data) {
    throw new Error('Sous Chef returned no data');
  }
  return data;
}
