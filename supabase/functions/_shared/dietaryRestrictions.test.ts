// Phase 8 explicitly asks to "verify (and add a test/check if reasonable)
// that dietary restrictions and allergies are enforced as filters before
// ranking even runs." There's no project-wide test framework (this repo
// has no simulator/device/CI in this environment, per every prior
// phase's Known limitations) — but Deno has `deno test` built in, and
// this module is exactly the kind of pure-function boundary it's cheap
// and genuinely useful to pin down. Run with:
//   cd supabase/functions && deno test _shared/dietaryRestrictions.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { findDietaryViolations, splitEnforceableRestrictions } from './dietaryRestrictions.ts';

Deno.test('findDietaryViolations flags a blocked ingredient', () => {
  const violations = findDietaryViolations(['Grilled Chicken Breast', 'Rice'], ['vegetarian']);
  assertEquals(violations.length, 1);
  assertEquals(violations[0].restriction, 'Vegetarian');
});

Deno.test('findDietaryViolations returns empty for a compliant recipe', () => {
  const violations = findDietaryViolations(['Rice', 'Broccoli', 'Olive Oil'], ['vegetarian', 'gluten-free']);
  assertEquals(violations.length, 0);
});

Deno.test('findDietaryViolations checks every stated restriction, not just the first', () => {
  const violations = findDietaryViolations(['Cheddar Cheese', 'Wheat Flour'], ['dairy-free', 'gluten-free']);
  assertEquals(violations.length, 2);
});

Deno.test('findDietaryViolations ignores unrecognized restriction strings (prompt-only, not structural)', () => {
  const violations = findDietaryViolations(['Anything'], ['low-fodmap']);
  assertEquals(violations.length, 0);
});

Deno.test('splitEnforceableRestrictions separates known keys from free text', () => {
  const { enforced, promptOnly } = splitEnforceableRestrictions(['vegan', 'low-fodmap']);
  assertEquals(enforced, ['Vegan']);
  assertEquals(promptOnly, ['low-fodmap']);
});
