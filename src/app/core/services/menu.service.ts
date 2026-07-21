import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { APP_CONFIG } from '../tokens/app-config.token';
import { Meal, MealType } from '../models';
import { SEED_MEALS } from '../data/seed.data';
import { resolveMealImage } from '../utils/meal-image';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  /**
   * GET /meals/?category=&meal_type=: this week's menu. Falls back to bundled
   * data when the request fails. The backend does not store meal photography
   * (image is always null), so any meal missing an image gets one resolved
   * from its name.
   */
  getMeals(filter?: { category?: string; meal_type?: MealType }): Observable<Meal[]> {
    let params = new HttpParams();
    if (filter?.category) params = params.set('category', filter.category);
    if (filter?.meal_type) params = params.set('meal_type', filter.meal_type);
    return this.http
      .get<Meal[]>(`${this.config.apiBaseUrl}/meals/`, { params })
      .pipe(
        catchError(() => of(SEED_MEALS)),
        map((meals) => meals.map((m) => ({ ...m, image: resolveMealImage(m) }))),
      );
  }
}
