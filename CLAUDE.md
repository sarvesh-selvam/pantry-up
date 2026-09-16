# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```sh
npm install              # requires .npmrc's legacy-peer-deps=true (see Gotchas)
npm start                # expo start — press i/a/w for iOS/Android/web
npm run ios / android / web
npx tsc --noEmit          # typecheck the app (excludes supabase/functions — see Gotchas)
npx expo-doctor           # validate SDK/config/dependency health
npx expo export --platform web   # bundle-only smoke test; useful when no simulator is available
cd supabase/functions && deno check <fn>/index.ts   # typecheck one Edge Function (needs `brew install deno`)
supabase functions deploy quick-add-parse   # deploy an Edge Function (needs `supabase link` first)
supabase secrets set ANTHROPIC_API_KEY=...  # required by both Edge Functions, never a client env var
```

Env vars: copy `.env.example` to `.env` and fill in a Supabase project's URL/anon key (`EXPO_PUBLIC_`-prefixed, inlined by Metro at build time — see `lib/supabase.ts`, which throws at import time if they're missing). The Anthropic key is a **Supabase secret**, not an app env var — it's only ever read inside `supabase/functions/*/index.ts` (Deno), never bundled into the client.

Database: schema lives only in `db/migrations/*.sql`, applied in filename order via the Supabase SQL Editor (or `supabase db push` with the CLI). There is no ORM — the Supabase dashboard is never the source of truth; if the schema changes, write a new numbered migration and update `types/database.ts` to match.

## Architecture

**Routing (expo-router, file-based):** `app/_layout.tsx` wraps the whole tree in `AuthProvider` and mounts two route groups, `(auth)` and `(tabs)`. Route groups don't add URL segments, so exactly one `index.tsx` across the two groups may claim `/` — `(tabs)/index.tsx` owns it; `(auth)` has no `index.tsx` on purpose (see git history for why: both groups having an index route collides on `/`). The auth gate isn't a redirect at the root — each group's own `_layout.tsx` checks `useAuth().session` and calls `<Redirect>` to the other group. `(tabs)/_layout.tsx` wraps the whole tab set in `InventoryProvider` (moved up from the Pantry stack in Phase 2 so Home's Rescue Row can read inventory too). `(tabs)/pantry/` is a nested `Stack` (list → add → `[id]` edit → quick-add → receipt-scan → quick-add-review, the last shared by both add flows).

**State:** two React contexts, not a global store. `lib/auth/AuthContext.tsx` wraps Supabase auth session state. `lib/inventory/InventoryContext.tsx` wraps inventory items, canonical foods, and `food_storage_rules` for the whole authenticated app, and also carries `quickAddDraft` — the parsed-but-unsaved batch from either Quick Add or Receipt Scan (each `QuickAddDraftItem` carries its own `source`) — so the two entry screens → `quick-add-review.tsx` handoff doesn't need to serialize items through router params.

**Supabase typing gotcha:** `types/database.ts`'s `Database` type must use `type X = {...}` (type aliases), never `interface X {...}`, for every `Row`/`Insert`/`Update` shape. `@supabase/supabase-js`'s generics require each table to structurally satisfy `Record<string, unknown>`-style index signatures, and TypeScript only allows that implicit match for type aliases, not named interfaces — using an interface silently degrades every `.from(...)` call to `never`. Each table also needs a `Relationships: []` field and the schema needs `Views`/`Functions`/`Enums`/`CompositeTypes`, matching what `supabase gen types typescript` would produce.

**Quick Add / Receipt Scan normalization pipeline (Phase 2):** `lib/quickAddParser.ts` no longer parses anything itself — it calls the `quick-add-parse` Edge Function (`supabase/functions/quick-add-parse/`) and maps the response. `lib/receiptScanner.ts` does the same via `receipt-scan`, after normalizing the photo to JPEG (`expo-image-manipulator` — Claude's vision API rejects HEIC, the iOS camera default) and uploading it to the private `receipts` Storage bucket. Both Edge Functions share one normalization contract in `supabase/functions/_shared/matching.ts` (the canonical-foods prompt fragment + JSON response validator) — that shared module, not a literal two-call pipeline, is what "reuse the normalization pipeline" means here; each function still makes just one Claude call. Neither function ever writes to `inventory_items` — both only return suggestions, and every result still lands on `quick-add-review.tsx` before saving. `lib/functionsError.ts` unwraps the real error message from a `FunctionsHttpError`, shared by both client modules.

**Deterministic expiry (Phase 2, no LLM):** `db/migrations/0006_expiry_estimation.sql` installs a Postgres trigger that looks up `food_storage_rules` (seeded in `0005_food_storage_rules.sql`, keyed by `canonical_food_id` + `preparation_state` + `storage_location` + `is_opened`) and sets `expiry_estimated` whenever those fields or `purchased_at`/`opened_at` change. No match (unresolved `canonical_food_id`, or a combination with no seeded rule) means `expiry_estimated` stays null — never a guessed number. The client mirrors this same lookup in `lib/foodStorageRules.ts`'s `findStorageRule` to read `is_safety_critical` for display tone (see the edit screen). `lib/formatInventory.ts`'s `getEffectiveExpiry` prefers `expiry_user_provided` over `expiry_estimated`.

**Uncertainty rule (cross-cutting):** any inventory data not confirmed by the user must be visually distinguishable everywhere it's shown. This is enforced by a single component, `components/UncertaintyBadge.tsx`, rendered whenever `verification_status` is `ai_estimated` or `needs_verification` (see `lib/formatInventory.ts`'s `isUncertain`). Don't build a second/parallel way to flag uncertain data — route new cases through this component and status field. Saving from the edit screen, or tapping a row's quick-verify checkmark (`InventoryItemRow`'s `onVerify`), is what clears it — both set `verification_status: 'confirmed'` and `last_verified_at`.

**Rescue Row (Phase 2):** `lib/rescueRow.ts`'s `getRescueRowEntries` is a pure function over already-loaded `items` — no query, no LLM. It classifies each item by at most one reason (expiring > leftover > low quantity, in that priority order) and sorts soonest-first. Keep it that way — this is explicitly "what needs attention," not recommendation logic (that's a later phase).

## Gotchas

- `.npmrc` sets `legacy-peer-deps=true`. Without it, `npm install` fails: `expo-router`'s `@expo/metro-runtime` pulls in `react-dom@19.3.0`, which wants a newer React than `expo@57.0.23` pins — an upstream SDK 57 mismatch, not something in this repo's control.
- `react-dom` / `react-native-web` are installed only so `expo export --platform web` works as a bundling smoke test in environments without a simulator/device. Not part of the product requirements.
- Dates (purchased/opened/expiry) are plain `YYYY-MM-DD` text fields (`lib/dateInput.ts`), not a native date picker — a deliberate Phase 1 scope cut.
- `supabase/functions/` is Deno, not Node — it's excluded from the root `tsconfig.json` (`exclude: ["supabase/functions"]`) so `npx tsc --noEmit` doesn't choke on `Deno.env`/`npm:`/`jsr:` syntax. Typecheck Edge Functions separately with `deno check` (see Commands) from *inside* `supabase/functions/` — there's a `deno.json` there specifically so Deno doesn't climb up and get confused by the app's root `package.json`/node_modules. Don't run `deno check --all`: it deep-checks `@supabase/auth-js`'s WebAuthn `.d.ts` files against browser-only DOM lib types Deno doesn't have, which fails even though nothing in this codebase touches that code path. Plain `deno check <file>` is the correct signal.
- The Edge Functions never write to `inventory_items` — if you're tempted to have `quick-add-parse` or `receipt-scan` insert directly, don't; that breaks the "LLM never silently writes to inventory" rule. Suggestions only, client always confirms.

## Project phase

This is Phase 2 of an 8-phase build (see PLAN.md locally if present — it's gitignored, not in the repo). Phase 1 shipped project skeleton, auth, the canonical food model, inventory CRUD, and a non-AI Quick Add. Phase 2 (current) added the material above: real normalization, receipt scanning, deterministic expiry, verification handling, and the Rescue Row. Only Home (Rescue Row) and Pantry have real functionality; Search, Cookbook, and Macros are still `ComingSoon` placeholders (`components/ComingSoon.tsx`) — don't build features into them without new requirements from the user.
