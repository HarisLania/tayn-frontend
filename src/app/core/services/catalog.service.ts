import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG } from '../tokens/app-config.token';
import { Category, Plan, PlanCard } from '../models';
import { CATEGORY_META, SEED_CATEGORIES, SEED_PLANS } from '../data/seed.data';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private get api(): string { return this.config.apiBaseUrl; }

  /**
   * GET /plans/ merged with marketing metadata into cards.
   *
   * Cards are built from plans rather than categories on purpose: there is now
   * exactly one plan per category, each plan embeds its category, and the
   * endpoint already hides plans that are not purchasable (no Stripe price).
   * Building from plans is therefore the same list minus the ones a customer
   * could not check out anyway, and one request instead of two.
   */
  getPlanCards(): Observable<PlanCard[]> {
    return this.getPlans().pipe(map((plans) => plans.map((p) => this.toCard(p))));
  }

  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.api}/plans/`).pipe(catchError(() => of(SEED_PLANS)));
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.api}/categories/`).pipe(catchError(() => of(SEED_CATEGORIES)));
  }

  private toCard(plan: Plan): PlanCard {
    const cat = plan.category;
    const meta = CATEGORY_META.find((m) => m.slug === cat.slug);
    return {
      slug: cat.slug,
      name: cat.name,
      description: meta?.tagline ?? cat.description,
      badge: meta?.badge ?? null,
      kcalRange: meta?.kcalRange ?? '',
      proteinRange: meta?.proteinRange ?? '',
      imageUrl: meta?.imageUrl ?? '',
      pricePerMeal: Number(plan.price_per_meal),
      planId: plan.id,
    };
  }
}
