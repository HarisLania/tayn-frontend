import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Menu } from './menu';
import { APP_CONFIG } from '../../core/tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';
import { Meal } from '../../core/models';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

const MEALS: Meal[] = [
  { id: 1, category: 'standard', name: 'Grilled Chicken with Rice', description: 'x', meal_type: 'main', meal_type_display: 'Main Course', image: null, calories: 500, protein_g: 40, is_active: true },
  { id: 2, category: 'low-cal', name: 'Cucumber Slices', description: 'x', meal_type: 'snack', meal_type_display: 'Snack', image: null, calories: 50, protein_g: 1, is_active: true },
  { id: 3, category: 'standard', name: 'Chocolate Brownie', description: 'x', meal_type: 'dessert', meal_type_display: 'Dessert', image: 'https://cdn.tayn.ae/real.jpg', calories: 300, protein_g: 5, is_active: true },
];

describe('Menu', () => {
  let http: HttpTestingController;

  function setup() {
    const fixture = TestBed.createComponent(Menu);
    fixture.detectChanges();
    http.expectOne((r) => r.url === 'http://api.test/api/meals/').flush(MEALS);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Menu],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: APP_CONFIG, useValue: CFG },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads meals and resolves a photo for every dish, real or derived', () => {
    const fixture = setup();
    const meals = fixture.componentInstance.meals();
    expect(meals.length).toBe(3);
    expect(meals.every((m) => !!m.image)).toBeTrue();
    expect(meals.find((m) => m.id === 3)!.image).toBe('https://cdn.tayn.ae/real.jpg');
    expect(meals.find((m) => m.id === 1)!.image).toContain('loremflickr.com');
  });

  it('shows every meal by default', () => {
    const fixture = setup();
    expect(fixture.componentInstance.filtered().length).toBe(3);
  });

  it('filters by category', () => {
    const fixture = setup();
    fixture.componentInstance.setCategory('low-cal');
    fixture.detectChanges();
    const filtered = fixture.componentInstance.filtered();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it('filters by meal type', () => {
    const fixture = setup();
    fixture.componentInstance.setType('dessert');
    fixture.detectChanges();
    const filtered = fixture.componentInstance.filtered();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(3);
  });

  it('combines category and type filters', () => {
    const fixture = setup();
    fixture.componentInstance.setCategory('standard');
    fixture.componentInstance.setType('dessert');
    fixture.detectChanges();
    expect(fixture.componentInstance.filtered().length).toBe(1);
  });

  it('shows the empty state when no meal matches the filters', () => {
    const fixture = setup();
    fixture.componentInstance.setCategory('protein-power');
    fixture.detectChanges();
    expect(fixture.componentInstance.filtered().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
  });

  it('falls back to the category cover image if a resolved photo fails to load', () => {
    const fixture = setup();
    const meal = MEALS[0];
    const img = document.createElement('img');
    img.src = 'https://loremflickr.com/900/600/chicken,rice';
    fixture.componentInstance.onImageError({ target: img } as unknown as Event, meal);
    expect(img.src).not.toContain('loremflickr.com');
  });
});
