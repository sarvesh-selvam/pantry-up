// Hands off a cookbook-scan draft between scan.tsx and scan-review.tsx
// without serializing it through router params — same reasoning as
// InventoryContext's quickAddDraft (see CLAUDE.md), just scoped to the
// Cookbook stack instead of living in the global inventory context, since
// this draft is a Cookbook concern, not an inventory one.

import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import type { ScannedRecipeDraft } from '../../types/recipe';

interface CookbookScanContextValue {
  scannedRecipeDraft: ScannedRecipeDraft | null;
  setScannedRecipeDraft: (draft: ScannedRecipeDraft | null) => void;
}

const CookbookScanContext = createContext<CookbookScanContextValue | undefined>(undefined);

export function CookbookScanProvider({ children }: PropsWithChildren) {
  const [scannedRecipeDraft, setScannedRecipeDraft] = useState<ScannedRecipeDraft | null>(null);
  return (
    <CookbookScanContext.Provider value={{ scannedRecipeDraft, setScannedRecipeDraft }}>
      {children}
    </CookbookScanContext.Provider>
  );
}

export function useCookbookScan() {
  const ctx = useContext(CookbookScanContext);
  if (!ctx) throw new Error('useCookbookScan must be used within a CookbookScanProvider');
  return ctx;
}
