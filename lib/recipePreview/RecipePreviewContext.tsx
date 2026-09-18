import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import type { RecipeSuggestion } from '../../types/recipe';

/** An unsaved generated recipe handed to `app/recipe-preview.tsx`, plus how
 * to save it — each caller (daily suggestions, Sous Chef) owns its own save
 * bookkeeping, so the preview screen doesn't need to know where it came from. */
export interface RecipePreview {
  suggestion: RecipeSuggestion;
  /** Persists the recipe and returns its new `recipes.id`. */
  save: () => Promise<string>;
}

interface RecipePreviewContextValue {
  preview: RecipePreview | null;
  setPreview: (preview: RecipePreview) => void;
}

const RecipePreviewContext = createContext<RecipePreviewContextValue | undefined>(undefined);

/** Context rather than router params for the same reason as
 * InventoryContext.quickAddDraft: a whole recipe (and a save callback)
 * doesn't belong in a URL. */
export function RecipePreviewProvider({ children }: PropsWithChildren) {
  const [preview, setPreview] = useState<RecipePreview | null>(null);
  return <RecipePreviewContext.Provider value={{ preview, setPreview }}>{children}</RecipePreviewContext.Provider>;
}

export function useRecipePreview() {
  const ctx = useContext(RecipePreviewContext);
  if (!ctx) throw new Error('useRecipePreview must be used within a RecipePreviewProvider');
  return ctx;
}
