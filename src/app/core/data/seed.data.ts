import { Category, Meal } from '../models/menu.model';
import { Plan } from '../models/plan.model';
import { CategoryMeta } from '../models/catalog-meta.model';

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;

/** Marketing copy the backend does not store (merged by slug). */
export const CATEGORY_META: CategoryMeta[] = [
  { slug: 'standard', badge: 'Most Popular', kcalRange: '1,800–2,200 kcal', proteinRange: '80–100g protein', tagline: 'Balanced, varied meals for everyday healthy eating.', imageUrl: unsplash('1512621776951-a57141f2eefd') },
  { slug: 'low-cal', badge: 'Weight Loss', kcalRange: '1,200–1,500 kcal', proteinRange: '70–90g protein', tagline: 'Calorie-controlled meals that never compromise on flavor.', imageUrl: unsplash('1467003909585-2f8a72700288') },
  { slug: 'weight-gain', badge: 'Bulking', kcalRange: '2,800–3,400 kcal', proteinRange: '140–160g protein', tagline: 'High-calorie, nutrient-dense meals to fuel serious gains.', imageUrl: unsplash('1546069901-ba9599a7e63c') },
  { slug: 'protein-power', badge: 'Performance', kcalRange: '2,000–2,400 kcal', proteinRange: '160g+ protein', tagline: 'Maximum protein for athletes and performance-focused individuals.', imageUrl: unsplash('1600891964092-4316c288032e') },
];

/** Mirrors the categories seeded by the backend's plans migration. */
export const SEED_CATEGORIES: Category[] = [
  { id: 1, name: 'Standard', slug: 'standard', description: 'Balanced meals with moderate calories and macros for everyday nutrition.' },
  { id: 2, name: 'Low Cal', slug: 'low-cal', description: 'Lighter meals designed for calorie-conscious diets and weight loss.' },
  { id: 3, name: 'Weight Gain', slug: 'weight-gain', description: 'Calorie-dense meals designed to support healthy weight gain.' },
  { id: 4, name: 'Protein Power', slug: 'protein-power', description: 'High-protein meals designed to support muscle growth and recovery.' },
];

/**
 * The seeded rate card: one plan per category, priced per meal (AED).
 * What a customer pays follows from the meal count. See core/utils/pricing.
 */
const PRICE_PER_MEAL: Record<string, string> = {
  standard: '40.00', 'low-cal': '35.00', 'weight-gain': '50.00', 'protein-power': '75.00',
};

export const SEED_PLANS: Plan[] = SEED_CATEGORIES.map((cat) => ({
  id: cat.id,
  category: cat,
  name: cat.name,
  price_per_meal: PRICE_PER_MEAL[cat.slug],
  is_active: true,
}));

/** A representative weekly menu for offline display (backend seeds fewer). */
export const SEED_MEALS: Meal[] = [
  { id: 1, category: 'standard', name: 'Grilled Chicken Quinoa Bowl', description: 'Free-range chicken breast, tri-color quinoa, roasted bell peppers, harissa drizzle', meal_type: 'main', meal_type_display: 'Main Course', image: unsplash('1512621776951-a57141f2eefd'), calories: 520, protein_g: 42, is_active: true },
  { id: 2, category: 'low-cal', name: 'Seared Salmon & Asparagus', description: 'Atlantic salmon fillet, steamed asparagus, lemon herb sauce, brown rice', meal_type: 'main', meal_type_display: 'Main Course', image: unsplash('1467003909585-2f8a72700288'), calories: 380, protein_g: 35, is_active: true },
  { id: 3, category: 'weight-gain', name: 'Beef Kofta with Wild Rice', description: 'Premium beef kofta, wild rice pilaf, tzatziki, grilled tomato', meal_type: 'main', meal_type_display: 'Main Course', image: unsplash('1544025162-d76694265947'), calories: 750, protein_g: 55, is_active: true },
  { id: 4, category: 'protein-power', name: 'Protein Shawarma Bowl', description: 'Double chicken shawarma, brown rice, tahini, garlic sauce, pickles', meal_type: 'main', meal_type_display: 'Main Course', image: unsplash('1600891964092-4316c288032e'), calories: 620, protein_g: 65, is_active: true },
  { id: 5, category: 'standard', name: 'Mediterranean Vegan Platter', description: 'Crispy falafel, creamy hummus, tabbouleh, warm pita, olives', meal_type: 'main', meal_type_display: 'Main Course', image: null, calories: 490, protein_g: 22, is_active: true },
  { id: 6, category: 'low-cal', name: 'Turkey Zucchini Noodles', description: 'Lean turkey meatballs, spiralized zucchini, fresh marinara, basil', meal_type: 'main', meal_type_display: 'Main Course', image: unsplash('1473093295043-cdd812d0e601'), calories: 420, protein_g: 38, is_active: true },
  { id: 7, category: 'weight-gain', name: 'Lamb Ouzi with Saffron Rice', description: 'Slow-braised UAE lamb shoulder, saffron basmati, caramelised onions, toasted nuts', meal_type: 'main', meal_type_display: 'Main Course', image: unsplash('1504674900247-0877df9cc836'), calories: 840, protein_g: 60, is_active: true },
  { id: 8, category: 'protein-power', name: 'Egg White Omelette Plate', description: 'Eight-egg white omelette, wilted spinach, crumbled feta, whole grain sourdough', meal_type: 'main', meal_type_display: 'Main Course', image: unsplash('1525351484163-7529414344d8'), calories: 310, protein_g: 50, is_active: true },
  { id: 9, category: 'standard', name: 'Date & Almond Bites', description: 'Medjool dates stuffed with almond butter, rolled in sesame seeds', meal_type: 'snack', meal_type_display: 'Snack', image: unsplash('1490474418585-ba9bad8fd0ea'), calories: 180, protein_g: 8, is_active: true },
  { id: 10, category: 'low-cal', name: 'Greek Yogurt Parfait', description: 'Strained Greek yogurt, fresh mixed berries, raw honey, granola', meal_type: 'snack', meal_type_display: 'Snack', image: unsplash('1488477181946-6428a0291777'), calories: 140, protein_g: 14, is_active: true },
  { id: 11, category: 'weight-gain', name: 'Peanut Butter Banana Oats', description: 'Steel-cut oats, sliced banana, natural peanut butter, chia seeds', meal_type: 'snack', meal_type_display: 'Snack', image: unsplash('1517673132405-a56a62b18caf'), calories: 340, protein_g: 14, is_active: true },
  { id: 12, category: 'protein-power', name: 'Protein Energy Balls', description: 'Whey protein, rolled oats, dark chocolate chips, desiccated coconut', meal_type: 'snack', meal_type_display: 'Snack', image: unsplash('1490567674331-0eab1b1a24e2'), calories: 210, protein_g: 20, is_active: true },
  { id: 13, category: 'standard', name: 'Dark Chocolate Protein Mousse', description: 'Rich protein mousse, 72% dark chocolate, fresh raspberry coulis', meal_type: 'dessert', meal_type_display: 'Dessert', image: unsplash('1541783245831-57d6fb0926d3'), calories: 195, protein_g: 14, is_active: true },
  { id: 14, category: 'low-cal', name: 'Mango Chia Pudding', description: 'Coconut milk chia pudding, fresh UAE mango, fresh mint', meal_type: 'dessert', meal_type_display: 'Dessert', image: unsplash('1568158879083-c42860933ed7'), calories: 155, protein_g: 8, is_active: true },
  { id: 15, category: 'weight-gain', name: 'Low-Sugar Baklava Bites', description: 'Traditional baklava, reduced sugar, pistachio & walnut filling, rose water', meal_type: 'dessert', meal_type_display: 'Dessert', image: unsplash('1519676867240-f03562e64548'), calories: 240, protein_g: 6, is_active: true },
  { id: 16, category: 'protein-power', name: 'Protein Brownie Slice', description: 'Black bean brownie, whey protein enriched, sugar-free chocolate glaze', meal_type: 'dessert', meal_type_display: 'Dessert', image: unsplash('1606313564200-e75d5e30476c'), calories: 270, protein_g: 18, is_active: true },
];

export const DELIVERY_EMIRATES = [
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain',
] as const;
