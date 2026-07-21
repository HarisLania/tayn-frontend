import { Category } from './menu.model';

/**
 * The per-meal rate card for a category (plans.Plan serializer).
 *
 * There is exactly ONE plan per category. The meal count is no longer baked
 * into the plan, it follows from how many delivery days the customer picks.
 * `price_per_meal` is a DRF decimal, serialized as a 2-decimal string.
 */
export interface Plan {
  id: number;
  category: Category;
  name: string;                    // e.g. "Protein Power"
  price_per_meal: string;          // "75.00" AED
  is_active: boolean;
}
