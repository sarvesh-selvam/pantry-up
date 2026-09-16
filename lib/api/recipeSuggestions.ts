import { supabase } from '../supabase';
import { describeFunctionInvokeError } from '../functionsError';
import type { RecipeSuggestion } from '../../types/recipe';

/** Home's "What should I cook?" section — automatic, no chat, 3-5
 * suggestions from the same generate_recipe + match pipeline Sous Chef uses. */
export async function fetchHomeSuggestions(): Promise<RecipeSuggestion[]> {
  const { data, error } = await supabase.functions.invoke<{ recipes: RecipeSuggestion[] }>(
    'recipe-suggestions',
    { body: {} }
  );

  if (error) {
    throw new Error(await describeFunctionInvokeError(error, 'Failed to load suggestions'));
  }
  if (!data) {
    throw new Error('Recipe suggestions returned no data');
  }
  return data.recipes;
}
