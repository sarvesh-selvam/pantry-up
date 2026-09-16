# PantryUp

A mobile-first, inventory-aware kitchen app. This is **Phase 1: Foundation** —
project skeleton, authentication, the canonical food model, the inventory
database, a manual Pantry screen with full CRUD, and a deterministic
(non-AI) Quick Add flow.

## Stack

- **Frontend:** React Native + Expo (TypeScript), file-based routing via
  [expo-router](https://docs.expo.dev/router/introduction/)
- **Backend:** [Supabase](https://supabase.com) (Postgres, Auth)

## Project structure

```
app/              Screens and routes (expo-router)
  (auth)/         Login / signup, shown when signed out
  (tabs)/         Home, Search, Pantry, Cookbook, Macros tabs
    pantry/       Pantry list, add/edit item, Quick Add + review
components/       Shared UI components
constants/        Design tokens (colors, spacing)
lib/              Supabase client, auth context, inventory context,
                   API helpers, and the Quick Add parser
types/            Hand-written types mirroring the Postgres schema
db/migrations/    SQL migrations, applied in filename order
```

## Prerequisites

- Node.js 22+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- Expo Go app on your phone, or an iOS Simulator / Android Emulator

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy the env template and fill in your Supabase project's URL and anon
   key (Project Settings → API in the Supabase dashboard):

   ```sh
   cp .env.example .env
   ```

   These are `EXPO_PUBLIC_`-prefixed, so Metro inlines them into the app at
   build time. The anon key is meant to be public — it's safe as long as
   Row Level Security is enabled on every table (it is, see below).

3. Apply the database migrations. In the Supabase dashboard, open the SQL
   Editor and run each file in `db/migrations/` **in order**:

   ```
   db/migrations/0001_users.sql
   db/migrations/0002_canonical_foods.sql
   db/migrations/0003_inventory_items.sql
   ```

   (If you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
   linked to your project, `supabase db push` after copying these into a
   `supabase/migrations` folder works too.)

   This creates the `users`, `canonical_foods`, and `inventory_items`
   tables, enables Row Level Security with per-user policies on
   `users`/`inventory_items`, seeds ~70 common household ingredients into
   `canonical_foods`, and sets up a trigger that creates a `users` profile
   row automatically when someone signs up.

4. In Supabase Auth settings, email/password sign-in is enabled by default.
   If you want to skip email confirmation during local testing, turn off
   "Confirm email" under Authentication → Providers → Email.

## Running the app

```sh
npm start
```

Then press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR
code with Expo Go.

## What's implemented in this phase

- Email/password auth (sign up, log in, log out, persisted sessions)
- Pantry tab: list grouped by storage location, add/edit/delete items
- Manual entry (name required, everything else optional with sensible
  defaults) and Quick Add (deterministic text parsing — see
  `lib/quickAddParser.ts` — with a review/confirm step before saving)
- An orange "?" indicator on any item that isn't confirmed data
  (`verification_status` is `ai_estimated` or `needs_verification`)
- Home, Search, Cookbook, and Macros tabs are placeholder "Coming soon"
  screens — their real functionality lands in later phases

`lib/quickAddParser.ts` is intentionally isolated from the UI so it can be
swapped for an LLM-based parser in a later phase without touching any
screen.
