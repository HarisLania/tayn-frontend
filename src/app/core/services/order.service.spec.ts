import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

const STANDARD = {
  id: 11, category: { id: 1, name: 'Standard', slug: 'standard', description: '' },
  name: 'Standard', price_per_meal: '40.00', is_active: true,
};

function loadStandard(http: HttpTestingController): void {
  http.expectOne('http://api.test/api/plans/').flush([STANDARD]);
}

/**
 * Run the debounced quote effect and answer whatever it asked for. Quoting is
 * fire-and-forget from the wizard's point of view, so tests that don't care
 * about the server figure still have to drain it.
 */
function settleQuotes(http: HttpTestingController, body: Record<string, unknown> = {}): void {
  TestBed.tick();          // run the effect that feeds the quote subject
  tick(200);               // clear the debounce window
  http.match('http://api.test/api/checkout/quote/').forEach((req) => req.flush({
    plan_id: 11, price_per_meal: '40.00', meals_per_week: 5, meals_per_cycle: 20,
    price_per_cycle: '800.00', cycle_days: 28, ...body,
  }));
}

describe('OrderService (wizard state)', () => {
  let service: OrderService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: CFG }],
    });
    service = TestBed.inject(OrderService);
    http = TestBed.inject(HttpTestingController);
    service.reset();
  });
  afterEach(() => http.verify());

  it('has no price until a plan is chosen', () => {
    service.loadCatalog();
    loadStandard(http);
    expect(service.price()).toBeNull();
  });

  it('prices the selection locally the moment a category is picked', () => {
    service.loadCatalog();
    loadStandard(http);
    service.selectCategory('standard');           // default Mon–Fri = 5 days
    const price = service.price();
    expect(price?.pricePerMeal).toBe(40);
    expect(price?.mealsPerWeek).toBe(5);
    expect(price?.mealsPerCycle).toBe(20);
    expect(price?.pricePerCycle).toBe(800);       // 40 x 20
  });

  it('re-prices when delivery days change', () => {
    service.loadCatalog();
    loadStandard(http);
    service.selectCategory('standard');
    service.patch({ deliveryDays: ['mon', 'wed', 'fri'] });
    expect(service.price()?.mealsPerCycle).toBe(12);
    expect(service.price()?.pricePerCycle).toBe(480);
  });

  it('prefers the server quote once it describes the current selection', fakeAsync(() => {
    service.loadCatalog();
    loadStandard(http);
    service.selectCategory('standard');
    // The rate card moved since page load, so the server's number wins.
    settleQuotes(http, { price_per_meal: '45.00', price_per_cycle: '900.00' });
    expect(service.price()?.pricePerCycle).toBe(900);
  }));

  it('keeps the local price when the quote request fails', fakeAsync(() => {
    service.loadCatalog();
    loadStandard(http);
    service.selectCategory('standard');
    TestBed.tick();
    tick(200);
    http.match('http://api.test/api/checkout/quote/')
      .forEach((req) => req.flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' }));
    expect(service.price()?.pricePerCycle).toBe(800);
  }));

  it('resolves the plan id from the chosen category', () => {
    service.loadCatalog();
    loadStandard(http);
    service.selectCategory('standard');
    expect(service.resolvePlanId()).toBe(11);
  });

  it('builds an anonymous checkout request with account fields and sorted days', fakeAsync(() => {
    service.loadCatalog();
    loadStandard(http);
    service.selectCategory('standard');
    service.patch({
      startDate: '2026-07-30', deliveryDays: ['fri', 'mon'], fullName: 'Jo Doe', email: 'j@d.com',
      phone: '500000000', building: 'B', street: 'S', emirate: 'Dubai',
      password: 'password1', confirmPassword: 'password1',
    });
    const body = service.toCheckoutRequest(false);
    expect(body?.plan_id).toBe(11);
    expect(body?.delivery_days).toEqual(['mon', 'fri']);
    expect(body?.start_date).toBe('2026-07-30');
    expect(body?.email).toBe('j@d.com');
    expect(body?.phone).toBe('+971500000000');
    settleQuotes(http);
  }));

  it('omits the account fields for a signed-in customer', () => {
    service.loadCatalog();
    loadStandard(http);
    service.selectCategory('standard');
    service.patch({ startDate: '2026-07-30' });
    const body = service.toCheckoutRequest(true);
    expect(body?.email).toBeUndefined();
    expect(body?.password).toBeUndefined();
  });

  it('advances and rewinds steps within bounds', () => {
    service.back();
    expect(service.step()).toBe(0);
    service.next();
    expect(service.step()).toBe(1);
  });
});
