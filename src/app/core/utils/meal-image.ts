import { Meal } from '../models';

/** Multi-word dish terms that must stay paired for the image search to make sense. */
const COMPOUNDS: Record<string, string> = {
  'ice cream': 'icecream',
  'peanut butter': 'peanutbutter',
  'cottage cheese': 'cottagecheese',
  'stir fry': 'stirfry',
  'stir-fry': 'stirfry',
  'stir fried': 'stirfry',
  'fried rice': 'friedrice',
  'cookie dough': 'cookiedough',
  'trail mix': 'trailmix',
  'mashed potato': 'mashedpotato',
  'mashed potatoes': 'mashedpotato',
  'mac and cheese': 'maccheese',
  'egg white': 'eggwhite',
  'egg whites': 'eggwhite',
  'greek yogurt': 'greekyogurt',
  'protein shake': 'proteinshake',
  'protein milkshake': 'milkshake',
  'chia pudding': 'chiapudding',
  'rice pudding': 'ricepudding',
  'chocolate mousse': 'chocolatemousse',
  'banana bread': 'bananabread',
  'lettuce wrap': 'lettucewrap',
  'lettuce wraps': 'lettucewrap',
  'lettuce tacos': 'tacos',
  'burrito bowl': 'burritobowl',
  'rice cakes': 'ricecakes',
  'boiled egg': 'boiledegg',
  'boiled eggs': 'boiledegg',
  'quinoa bowl': 'grainbowl',
};

/** Linking words that carry no visual meaning. */
const STOPWORDS = new Set([
  'with', 'and', 'of', 'the', 'a', 'an', 'in', 'on', 'to', 'no', 'for',
  'extra', 'double', 'single', 'two', 'three', 'x3', '(x3)', 'per',
]);

/** Cooking methods and intensifiers: real, but not what makes an image recognizable. */
const DESCRIPTORS = new Set([
  'grilled', 'baked', 'roasted', 'steamed', 'seared', 'pan-fried', 'fried',
  'boiled', 'slow-cooked', 'slow-braised', 'breaded', 'creamy', 'crisp',
  'crispy', 'light', 'lightly', 'fresh', 'homemade', 'classic', 'rich',
  'buttery', 'plain', 'air-popped', 'reduced', 'low-cal', 'low-sugar',
  'sugar-free', 'whole', 'whole-grain', 'cinnamon-baked', 'edible', 'loaded',
  'cheesy', 'herb-roasted', 'herb', 'moist', 'fudgy', 'fluffy', 'seasoned',
  'raw', 'premium', 'traditional', 'rose', 'water', 'free-range', 'sliced',
  'strained', 'protein-packed', 'low-sugar',
  // generic collective-noun suffixes that add nothing on their own
  'bites', 'balls', 'sticks', 'slices',
]);

/** Longest-phrase-first so e.g. "boiled eggs" matches before "boiled egg" can eat half of it. */
const COMPOUND_ENTRIES = Object.entries(COMPOUNDS).sort((a, b) => b[0].length - a[0].length);

/**
 * Pulls the 1-2 most visually distinctive words out of a dish name.
 * Keeps hyphens intact while filtering so compound descriptors like
 * "sugar-free" or "air-popped" match as a single token, not two meaningless
 * halves, then takes the first word (usually the protein or main ingredient)
 * and the last (usually the dish type: bowl, pasta, pudding…), since that
 * pairing survives naming patterns like "[protein] [prep] [dish-type]".
 */
function extractTags(name: string): string[] {
  let text = name.toLowerCase().replace(/[()]/g, '');
  for (const [phrase, token] of COMPOUND_ENTRIES) {
    text = text.replaceAll(phrase, token);
  }
  const words = text
    .split(/[\s/&,]+/)
    .filter((w) => w && !STOPWORDS.has(w) && !DESCRIPTORS.has(w) && !/^\d+$/.test(w));
  if (words.length <= 2) return words;
  return [words[0], words[words.length - 1]];
}

/**
 * Resolves a display image for a meal. The backend does not store photography
 * (menu.Meal.image is null for every seeded dish), so when a real image isn't
 * set we derive search tags straight from the dish name and pull a matching,
 * stable food photo. Stable because it's locked to the meal id, so the same
 * dish always renders the same picture across reloads.
 */
export function resolveMealImage(meal: Pick<Meal, 'id' | 'name' | 'image' | 'meal_type'>): string {
  if (meal.image) return meal.image;
  const tags = extractTags(meal.name);
  // "food" is always appended as an anchor tag: dish keywords alone can collide
  // with unrelated photos (e.g. "chicken,rice" once matched a shop called
  // "Chicken Rice"), and anchoring to "food" reliably steers the search back
  // to actual dishes without needing the name-derived tags to be any more precise.
  const query = (tags.length ? [...tags, 'food'] : [meal.meal_type, 'food']).map(encodeURIComponent).join(',');
  return `https://loremflickr.com/900/600/${query}?lock=${meal.id}`;
}
