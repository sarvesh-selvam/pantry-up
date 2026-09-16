# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```sh
npm install              # requires .npmrc's legacy-peer-deps=true (see Gotchas)
npm start                # expo start — press i/a/w for iOS/Android/web
npm run ios / android / web
npx tsc --noEmit          # typecheck (only verification currently wired up — no lint or test suite exists yet)
npx expo-doctor           # validate SDK/config/dependency health
npx expo export --platform web   # bundle-only smoke test; useful when no simulator is available
```

Env vars: copy `.env.example` to `.env` and fill in a Supabase project's URL/anon key (`EXPO_PUBLIC_`-prefixed, inlined by Metro at build time — see `lib/supabase.ts`, which throws at import time if they're missing).

Database: schema lives only in `db/migrations/*.sql`, applied in filename order via the Supabase SQL Editor (or `supabase db push` with the CLI). There is no ORM — the Supabase dashboard is never the source of truth; if the schema changes, write a new numbered migration and update `types/database.ts` to match.

## Architecture

**Routing (expo-router, file-based):** `app/_layout.tsx` wraps the whole tree in `AuthProvider` and mounts two route groups, `(auth)` and `(tabs)`. Route groups don't add URL segments, so exactly one `index.tsx` across the two groups may claim `/` — `(tabs)/index.tsx` owns it; `(auth)` has no `index.tsx` on purpose (see git history for why: both groups having an index route collides on `/`). The auth gate isn't a redirect at the root — each group's own `_layout.tsx` checks `useAuth().session` and calls `<Redirect>` to the other group. `(tabs)/pantry/` is a nested `Stack` (list → add → `[id]` edit → quick-add → quick-add-review) wrapped in its own `InventoryProvider`.

**State:** two React contexts, not a global store. `lib/auth/AuthContext.tsx` wraps Supabase auth session state. `lib/inventory/InventoryContext.tsx` wraps inventory items + canonical foods for the Pantry subtree, and also carries `quickAddDraft` — the parsed-but-unsaved Quick Add batch — so the `quick-add.tsx` → `quick-add-review.tsx` handoff doesn't need to serialize items through router params.

**Supabase typing gotcha:** `types/database.ts`'s `Database` type must use `type X = {...}` (type aliases), never `interface X {...}`, for every `Row`/`Insert`/`Update` shape. `@supabase/supabase-js`'s generics require each table to structurally satisfy `Record<string, unknown>`-style index signatures, and TypeScript only allows that implicit match for type aliases, not named interfaces — using an interface silently degrades every `.from(...)` call to `never`. Each table also needs a `Relationships: []` field and the schema needs `Views`/`Functions`/`Enums`/`CompositeTypes`, matching what `supabase gen types typescript` would produce.

**Quick Add is intentionally a swappable module:** `lib/quickAddParser.ts` (split → strip leading quantity/unit via regex → Levenshtein fuzzy-match against `canonical_foods`) is deliberately isolated from the UI screens. It's a Phase 1 placeholder for an LLM-based parser — later phases should be able to replace its internals without touching `quick-add.tsx` or `quick-add-review.tsx`, as long as the `ParsedQuickAddItem`/`QuickAddDraftItem` shapes are preserved.

**Uncertainty rule (cross-cutting):** any inventory data not confirmed by the user must be visually distinguishable everywhere it's shown. This is enforced by a single component, `components/UncertaintyBadge.tsx`, rendered whenever `verification_status` is `ai_estimated` or `needs_verification` (see `lib/formatInventory.ts`'s `isUncertain`). Don't build a second/parallel way to flag uncertain data — route new cases through this component and status field.

## Gotchas

- `.npmrc` sets `legacy-peer-deps=true`. Without it, `npm install` fails: `expo-router`'s `@expo/metro-runtime` pulls in `react-dom@19.3.0`, which wants a newer React than `expo@57.0.23` pins — an upstream SDK 57 mismatch, not something in this repo's control.
- `react-dom` / `react-native-web` are installed only so `expo export --platform web` works as a bundling smoke test in environments without a simulator/device. Not part of the product requirements.
- Dates (purchased/opened/expiry) are plain `YYYY-MM-DD` text fields (`lib/dateInput.ts`), not a native date picker — a deliberate Phase 1 scope cut.

## Project phase

This is Phase 1 of an 8-phase build (see PLAN.md locally if present — it's gitignored, not in the repo). Phase 1 scope: project skeleton, auth, the canonical food model, the inventory schema/CRUD, and a non-AI Quick Add. Only the Pantry tab has real functionality; Home, Search, Cookbook, and Macros are intentionally `ComingSoon` placeholders (`components/ComingSoon.tsx`) — don't build features into them without new requirements from the user.
