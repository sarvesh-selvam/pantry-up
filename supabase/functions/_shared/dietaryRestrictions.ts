// Structural (non-LLM) enforcement of dietary restrictions and allergies.
//
// PantryUp's AI priority order is: food safety > dietary restrictions >
// user's explicit request > rescue ingredients > pantry availability >
// cooking time > cuisine preference > nutrition preference > equipment >
// variety. Dietary restrictions/allergies are HARD constraints — this
// module is what makes that structural rather than a hope that the model
// follows its system prompt. generate_recipe (recipeGeneration.ts) runs
// every candidate recipe through findDietaryViolations and rejects/retries
// on any hit, rather than trusting the model to have already avoided them.
//
// Keyword-based on purpose: it doesn't require the model to have resolved
// a canonical_food_id (which can be wrong or null) — it checks the actual
// ingredient text, which is the one thing a generated recipe always has.

export interface DietaryRestrictionRule {
  /** Canonical key this rule matches against (case-insensitive, synonyms
   * normalized — see normalizeRestriction). */
  key: string;
  label: string;
  blockedKeywords: string[];
}

// Deliberately a curated, common set — not exhaustive. An unrecognized
// restriction string still reaches the model's system prompt as a soft
// instruction, but isn't structurally enforced here. See PLAN.md.
const RULES: DietaryRestrictionRule[] = [
  {
    key: 'vegetarian',
    label: 'Vegetarian',
    blockedKeywords: [
      'chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham',
      'fish', 'salmon', 'shrimp', 'tuna', 'anchovy', 'gelatin', 'lard',
    ],
  },
  {
    key: 'vegan',
    label: 'Vegan',
    blockedKeywords: [
      'chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham',
      'fish', 'salmon', 'shrimp', 'tuna', 'anchovy', 'gelatin', 'lard',
      'egg', 'eggs', 'honey', 'milk', 'cheese', 'butter', 'yogurt', 'cream',
    ],
  },
  {
    key: 'pescatarian',
    label: 'Pescatarian',
    blockedKeywords: ['chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham'],
  },
  {
    key: 'gluten-free',
    label: 'Gluten-free',
    blockedKeywords: ['wheat', 'flour', 'pasta', 'bread', 'barley', 'rye', 'tortilla', 'cereal'],
  },
  {
    key: 'dairy-free',
    label: 'Dairy-free',
    blockedKeywords: ['milk', 'cheese', 'butter', 'cream', 'yogurt'],
  },
  {
    key: 'nut-free',
    label: 'Nut-free',
    blockedKeywords: ['peanut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut'],
  },
  {
    key: 'shellfish-free',
    label: 'Shellfish-free',
    blockedKeywords: ['shrimp', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'],
  },
  {
    key: 'egg-free',
    label: 'Egg-free',
    blockedKeywords: ['egg', 'eggs', 'mayonnaise'],
  },
];

const RULES_BY_KEY = new Map(RULES.map((rule) => [rule.key, rule]));

function normalizeRestriction(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export interface DietaryViolation {
  restriction: string;
  ingredientDisplayName: string;
  matchedKeyword: string;
}

/** Checks a candidate recipe's ingredient names against the user's
 * dietary restrictions. Returns an empty array when compliant. */
export function findDietaryViolations(
  ingredientDisplayNames: string[],
  dietaryRestrictions: string[]
): DietaryViolation[] {
  const violations: DietaryViolation[] = [];

  for (const rawRestriction of dietaryRestrictions) {
    const rule = RULES_BY_KEY.get(normalizeRestriction(rawRestriction));
    if (!rule) continue; // not a recognized key — see module header

    for (const name of ingredientDisplayNames) {
      const lowerName = name.toLowerCase();
      const matchedKeyword = rule.blockedKeywords.find((keyword) => lowerName.includes(keyword));
      if (matchedKeyword) {
        violations.push({ restriction: rule.label, ingredientDisplayName: name, matchedKeyword });
      }
    }
  }

  return violations;
}

/** Which of the user's restrictions are structurally enforced vs.
 * prompt-only — used to build the generation system prompt honestly. */
export function splitEnforceableRestrictions(dietaryRestrictions: string[]): {
  enforced: string[];
  promptOnly: string[];
} {
  const enforced: string[] = [];
  const promptOnly: string[] = [];
  for (const raw of dietaryRestrictions) {
    const rule = RULES_BY_KEY.get(normalizeRestriction(raw));
    (rule ? enforced : promptOnly).push(rule ? rule.label : raw);
  }
  return { enforced, promptOnly };
}
