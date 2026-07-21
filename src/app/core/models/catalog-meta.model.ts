/**
 * Marketing metadata the backend does not store (kcal ranges, hero copy,
 * badges, imagery). Keyed by category slug and merged with live plan data.
 */
export interface CategoryMeta {
  slug: string;
  badge: string | null;
  kcalRange: string;
  proteinRange: string;
  tagline: string;
  imageUrl: string;
}

/**
 * UI view-model: a category card enriched with its live per-meal rate.
 *
 * `planId` is null when the category has no purchasable plan. The backend
 * hides plans that are not yet synced to Stripe, so the card can still be
 * shown while checkout stays disabled.
 */
export interface PlanCard {
  slug: string;
  name: string;
  description: string;
  badge: string | null;
  kcalRange: string;
  proteinRange: string;
  imageUrl: string;
  /** AED per meal, the only price the backend stores. */
  pricePerMeal: number;
  planId: number | null;
}
