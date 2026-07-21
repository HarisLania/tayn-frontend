import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { Meal, MealType } from '../../core/models';
import { CATEGORY_META } from '../../core/data/seed.data';

type CategoryFilter = string | 'all';
type TypeFilter = MealType | 'all';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './menu.html',
  styleUrl: './menu.scss',
})
export class Menu {
  private readonly menuService = inject(MenuService);

  readonly meals = signal<Meal[]>([]);
  readonly categoryFilter = signal<CategoryFilter>('all');
  readonly typeFilter = signal<TypeFilter>('all');

  readonly categoryTabs: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All Plans' },
    { id: 'standard', label: 'Standard' },
    { id: 'low-cal', label: 'Low Cal' },
    { id: 'weight-gain', label: 'Weight Gain' },
    { id: 'protein-power', label: 'Protein Power' },
  ];

  readonly typeTabs: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'main', label: 'Mains' },
    { id: 'snack', label: 'Snacks' },
    { id: 'dessert', label: 'Desserts' },
  ];

  readonly filtered = computed(() => {
    const cat = this.categoryFilter();
    const type = this.typeFilter();
    return this.meals().filter(
      (m) => (cat === 'all' || m.category === cat) && (type === 'all' || m.meal_type === type),
    );
  });

  constructor() {
    this.menuService.getMeals().subscribe((m) => this.meals.set(m));
  }

  setCategory(id: CategoryFilter): void { this.categoryFilter.set(id); }
  setType(id: TypeFilter): void { this.typeFilter.set(id); }

  label(slug: string): string {
    return slug.replace('-', ' ').toUpperCase();
  }

  /** If the derived meal photo fails to load, fall back to the category's cover image. */
  onImageError(event: Event, meal: Meal): void {
    const img = event.target as HTMLImageElement;
    const fallback = CATEGORY_META.find((m) => m.slug === meal.category)?.imageUrl;
    if (fallback && img.src !== fallback) img.src = fallback;
  }
}
