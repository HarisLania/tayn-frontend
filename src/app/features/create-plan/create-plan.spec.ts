import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { CreatePlan } from './create-plan';
import { AuthService } from '../../core/services/auth.service';
import { APP_CONFIG } from '../../core/tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';
import { toIsoDate, addDays } from '../../core/utils/pricing';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

const PLAN = {
  id: 11, category: { id: 1, name: 'Standard', slug: 'standard', description: '' },
  name: 'Standard', price_per_meal: '40.00', is_active: true,
};

describe('CreatePlan', () => {
  let http: HttpTestingController;

  function setup() {
    const fixture = TestBed.createComponent(CreatePlan);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/plans/').flush([PLAN]);
    fixture.detectChanges();
    return fixture;
  }

  /** Drain the wizard's debounced background quote so http.verify() is clean. */
  function settleQuotes(): void {
    tick(200);
    http.match('http://api.test/api/checkout/quote/').forEach((req) => req.flush({
      plan_id: 11, price_per_meal: '40.00', meals_per_week: 5, meals_per_cycle: 20,
      price_per_cycle: '800.00', cycle_days: 28,
    }));
  }

  beforeEach(async () => {
    try { localStorage.clear(); } catch { /* ignore */ }
    await TestBed.configureTestingModule({
      imports: [CreatePlan],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: APP_CONFIG, useValue: CFG },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the catalog into cards on init', () => {
    const fixture = setup();
    expect(fixture.componentInstance.cards().length).toBe(1);
    expect(fixture.componentInstance.cards()[0].pricePerMeal).toBe(40);
  });

  it('offers no start date inside the kitchen lead time', () => {
    const fixture = setup();
    const earliest = fixture.componentInstance.calendar()[0];
    expect(earliest.iso).toBe(toIsoDate(addDays(new Date(), CFG.minStartLeadDays)));
    expect(earliest.earliest).toBeTrue();
  });

  it('has six steps, since billing cycle is no longer a choice', () => {
    const fixture = setup();
    expect(fixture.componentInstance.steps.length).toBe(6);
    expect(fixture.componentInstance.steps as readonly string[]).not.toContain('Billing Cycle');
  });

  it('renders every step without a template error', () => {
    const fixture = setup();
    fixture.componentInstance.selectCategory('standard');
    fixture.componentInstance.order.patch({ startDate: '2026-08-03' });
    for (let step = 0; step < fixture.componentInstance.steps.length; step++) {
      fixture.componentInstance.order.goTo(step);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.wizard-panel')).toBeTruthy();
    }
    // Step 6 shows the cycle total, not a per-week or per-month figure.
    expect(fixture.nativeElement.textContent).toContain('800');
    expect(fixture.nativeElement.textContent).toContain('20 meals');
  });

  it('blocks continuing past step 0 until a plan is selected', () => {
    const fixture = setup();
    expect(fixture.componentInstance.step()).toBe(0);
    expect(fixture.componentInstance.canContinue()).toBeFalse();

    fixture.componentInstance.selectCategory('standard');
    expect(fixture.componentInstance.canContinue()).toBeTrue();

    fixture.componentInstance.continue();
    expect(fixture.componentInstance.step()).toBe(1);
  });

  it('gates the details step (4) behind form validity', () => {
    const fixture = setup();
    fixture.componentInstance.order.goTo(4);
    expect(fixture.componentInstance.canContinue()).toBeFalse();

    fixture.componentInstance.detailsForm.setValue({
      fullName: 'Layla Al Hashimi', email: 'layla@email.com', phone: '501234567',
      emirate: 'Dubai', building: 'Apt 1', street: 'JLT', dietaryNotes: '',
      password: 'password123', confirmPassword: 'password123',
    });
    expect(fixture.componentInstance.canContinue()).toBeTrue();
  });

  it('flags mismatched passwords as invalid', () => {
    const fixture = setup();
    fixture.componentInstance.detailsForm.setValue({
      fullName: 'Layla Al Hashimi', email: 'layla@email.com', phone: '501234567',
      emirate: 'Dubai', building: 'Apt 1', street: 'JLT', dietaryNotes: '',
      password: 'password123', confirmPassword: 'different',
    });
    expect(fixture.componentInstance.detailsForm.errors?.['mismatch']).toBeTrue();
  });

  it('prices the cycle as soon as a plan is chosen', () => {
    const fixture = setup();
    fixture.componentInstance.selectCategory('standard');   // default Mon–Fri
    const price = fixture.componentInstance.price();
    expect(price?.mealsPerCycle).toBe(20);
    expect(price?.pricePerCycle).toBe(800);                 // 40 x 20
  });

  it('re-prices when a delivery day is dropped', () => {
    const fixture = setup();
    fixture.componentInstance.selectCategory('standard');
    fixture.componentInstance.toggleDay('fri');
    expect(fixture.componentInstance.price()?.mealsPerWeek).toBe(4);
    expect(fixture.componentInstance.price()?.pricePerCycle).toBe(640);
  });

  it('creates a checkout session and navigates to /subscription for a logged-in user', fakeAsync(() => {
    const fixture = setup();
    TestBed.inject(AuthService).applyTokens(
      { access: 'acc', refresh: 'ref' },
      { id: 1, email: 'a@b.com', first_name: 'A', last_name: 'B', profile: null },
    );
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');

    fixture.componentInstance.selectCategory('standard');
    fixture.componentInstance.order.patch({ startDate: '2026-08-01' });
    fixture.componentInstance.confirm();

    const req = http.expectOne('http://api.test/api/checkout/create-session/');
    expect(req.request.body.delivery_days).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(req.request.body.billing_interval).toBeUndefined();
    req.flush({
      checkout_url: '', plan_id: 11, price_per_meal: '40.00', meals_per_week: 5,
      meals_per_cycle: 20, price_per_cycle: '800.00', cycle_days: 28,
    });

    expect(navSpy).toHaveBeenCalledWith(['/subscription']);
    expect(fixture.componentInstance.submitting()).toBeFalse();
    settleQuotes();
  }));

  it('persists new-account tokens returned by checkout for an anonymous signup', fakeAsync(() => {
    const fixture = setup();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const auth = TestBed.inject(AuthService);

    fixture.componentInstance.selectCategory('standard');
    fixture.componentInstance.order.patch({
      startDate: '2026-08-01', fullName: 'Layla Al Hashimi', email: 'layla@email.com',
      phone: '501234567', building: 'Apt 1', street: 'JLT',
    });
    fixture.componentInstance.confirm();

    http.expectOne('http://api.test/api/checkout/create-session/').flush({
      checkout_url: '', tokens: { access: 'new-acc', refresh: 'new-ref' },
    });

    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.accessToken()).toBe('new-acc');
    settleQuotes();
  }));

  it('re-enables the button and surfaces the backend message when checkout is rejected', fakeAsync(() => {
    const fixture = setup();
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');
    const auth = TestBed.inject(AuthService);

    fixture.componentInstance.selectCategory('standard');
    fixture.componentInstance.order.patch({
      startDate: '2026-08-01', fullName: 'Layla Al Hashimi', email: 'taken@email.com',
      phone: '501234567', building: 'Apt 1', street: 'JLT',
    });
    fixture.componentInstance.confirm();

    http.expectOne('http://api.test/api/checkout/create-session/').flush(
      { email: ['A user with this email already exists.'] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(fixture.componentInstance.submitting()).toBeFalse();
    expect(fixture.componentInstance.checkoutError()).toBe('A user with this email already exists.');
    expect(auth.isLoggedIn()).toBeFalse();
    expect(navSpy).not.toHaveBeenCalled();
    settleQuotes();
  }));

  it('surfaces a start date the backend rejects as too soon', fakeAsync(() => {
    const fixture = setup();
    TestBed.inject(AuthService).applyTokens(
      { access: 'acc', refresh: 'ref' },
      { id: 1, email: 'a@b.com', first_name: 'A', last_name: 'B', profile: null },
    );
    spyOn(TestBed.inject(Router), 'navigate');

    fixture.componentInstance.selectCategory('standard');
    fixture.componentInstance.order.patch({ startDate: '2026-08-01' });
    fixture.componentInstance.confirm();

    http.expectOne('http://api.test/api/checkout/create-session/').flush(
      { start_date: ['Earliest start date is 2026-08-03 (2 days from today).'] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(fixture.componentInstance.checkoutError()).toContain('Earliest start date');
    settleQuotes();
  }));
});
