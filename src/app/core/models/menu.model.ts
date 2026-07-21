/** Meal program category: Standard, Low Cal, Weight Gain, Protein Power. */
export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export type MealType = 'main' | 'snack' | 'dessert';

/** A dish on the weekly menu (menu.Meal serializer). */
export interface Meal {
  id: number;
  category: string;          // category slug (SlugRelatedField)
  name: string;
  description: string;
  meal_type: MealType;
  meal_type_display: string;
  image: string | null;
  calories: number | null;
  protein_g: number | null;
  is_active: boolean;
}
