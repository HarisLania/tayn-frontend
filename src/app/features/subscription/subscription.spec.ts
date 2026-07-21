import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SubscriptionPage } from './subscription';
import { AuthService } from '../../core/services/auth.service';
import { APP_CONFIG } from '../../core/tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';
import { Subscription } from '../../core/models';
import { addDays, toIsoDate } from '../../core/utils/pricing';

const CFG: AppConfig = { name: 'testing', production: false, apiBaseUrl: 'http://api.test/api', currency: 'AED', enableDebugLogs: false, minStartLeadDays: 2 };

const SUB: Subscription = {
  id: 7,
  plan: {
    id: 1, category: { id: 1, name: 'Standard', slug: 'standard', description: '' },
    name: 'Standard', price_per_meal: '40.00', is_active: true,
  },
  delivery_days: ['mon', 'wed', 'fri'],
  start_date: '2026-08-03',
  first_delivery_date: '2026-08-03',
  meals_per_week: 3,
  meals_per_cycle: 12,
  price_per_cycle: '480.00',
  status: 'active',
  current_period_end: '2026-08-31T00:00:00Z',
  cancel_at_period_end: false,
  created_at: '2026-07-01T00:00:00Z',
};

describe('SubscriptionPage', () => {
  let http: HttpTestingController;

  /** Answer the three requests the dashboard makes for a live subscription. */
  function loadDashboard(sub: Subscription = SUB, dates: string[] = []) {
    const fixture = TestBed.createComponent(SubscriptionPage);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(sub);
    http.expectOne(`http://api.test/api/subscriptions/${sub.id}/invoices/`).flush([]);
    http.expectOne(`http://api.test/api/subscriptions/${sub.id}/deliveries/`).flush({
      delivery_days: sub.delivery_days,
      first_delivery_date: sub.first_delivery_date,
      meals_per_cycle: sub.meals_per_cycle,
      dates,
    });
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    try { localStorage.clear(); } catch { /* ignore */ }
    await TestBed.configureTestingModule({
      imports: [SubscriptionPage],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: APP_CONFIG, useValue: CFG },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).applyTokens(
      { access: 'acc', refresh: 'ref' },
      { id: 1, email: 'a@b.com', first_name: 'Layla', last_name: 'H', profile: null },
    );
  });
  afterEach(() => http.verify());

  it('shows a loading state before the subscription resolves', () => {
    const fixture = TestBed.createComponent(SubscriptionPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBeTrue();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(
      { detail: 'No active subscription.' }, { status: 404, statusText: 'Not Found' },
    );
  });

  it('shows the empty state when the customer has no active subscription', () => {
    const fixture = TestBed.createComponent(SubscriptionPage);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(
      { detail: 'No active subscription.' }, { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.subscription()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No active subscription');
  });

  it('renders the cycle totals from the server, not a local calculation', () => {
    const fixture = loadDashboard();
    expect(fixture.componentInstance.subscription()?.id).toBe(7);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Standard');
    expect(text).toContain('480');        // price_per_cycle
    expect(text).toContain('12 meals');   // meals_per_cycle
  });

  it('counts down to the next delivery still to come, not the start date', () => {
    const soon = toIsoDate(addDays(new Date(), 3));
    const past = toIsoDate(addDays(new Date(), -4));
    const fixture = loadDashboard(SUB, [past, soon]);

    expect(fixture.componentInstance.nextDelivery()).toBe(soon);
    expect(fixture.componentInstance.daysUntil()).toBe(3);
    expect(fixture.componentInstance.upcoming()).toEqual([soon]);
  });

  it('falls back to first_delivery_date before the schedule arrives', () => {
    const fixture = loadDashboard({ ...SUB, first_delivery_date: toIsoDate(addDays(new Date(), 5)) }, []);
    expect(fixture.componentInstance.daysUntil()).toBe(5);
  });

  it('says a scheduled subscription is paid and waiting on its first delivery', () => {
    const fixture = loadDashboard({ ...SUB, status: 'scheduled' });
    expect(fixture.componentInstance.statusCopy()?.label).toBe('Scheduled');
    expect(fixture.nativeElement.textContent).toContain('first cycle is paid');
  });

  it('shows the checkout charge as a payment', () => {
    const fixture = TestBed.createComponent(SubscriptionPage);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(SUB);
    http.expectOne('http://api.test/api/subscriptions/7/invoices/').flush([
      { id: 2, stripe_invoice_id: 'in_real', amount: '480.00', status: 'paid', paid_at: '2026-08-03T00:00:00Z', created_at: '2026-08-03T00:00:00Z' },
    ]);
    http.expectOne('http://api.test/api/subscriptions/7/deliveries/').flush({
      delivery_days: SUB.delivery_days, first_delivery_date: SUB.first_delivery_date,
      meals_per_cycle: SUB.meals_per_cycle, dates: [],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('AED 480.00');
    expect(text).toContain('✓ Paid');
  });

  it('previews the prorated cost of a delivery-day change without applying it', () => {
    const fixture = loadDashboard();
    const page = fixture.componentInstance;

    page.startEditingDays();
    page.toggleDraftDay('tue');
    expect(page.draftChanged()).toBeTrue();

    page.previewDays();
    const req = http.expectOne('http://api.test/api/subscriptions/7/delivery-days/');
    expect(req.request.body.preview).toBeTrue();
    expect(req.request.body.delivery_days).toEqual(['mon', 'tue', 'wed', 'fri']);
    req.flush({ preview: true, meals_per_cycle: 16, amount_due: 160, currency: 'aed' });

    expect(page.proration()).toBe(160);
    expect(page.subscription()?.delivery_days).toEqual(['mon', 'wed', 'fri']);  // unchanged
  });

  it('applies a delivery-day change and reloads the schedule', () => {
    const fixture = loadDashboard();
    const page = fixture.componentInstance;

    page.startEditingDays();
    page.toggleDraftDay('tue');
    page.saveDays();

    const req = http.expectOne('http://api.test/api/subscriptions/7/delivery-days/');
    expect(req.request.body.preview).toBeFalse();
    req.flush({
      preview: false,
      subscription: { ...SUB, delivery_days: ['mon', 'tue', 'wed', 'fri'], meals_per_week: 4, meals_per_cycle: 16, price_per_cycle: '640.00' },
    });
    http.expectOne('http://api.test/api/subscriptions/7/deliveries/').flush({
      delivery_days: ['mon', 'tue', 'wed', 'fri'], first_delivery_date: '2026-08-03',
      meals_per_cycle: 16, dates: [],
    });

    expect(page.editingDays()).toBeFalse();
    expect(page.subscription()?.meals_per_cycle).toBe(16);
  });

  it('surfaces a failed delivery-day change instead of pretending it applied', () => {
    const fixture = loadDashboard();
    const page = fixture.componentInstance;

    page.startEditingDays();
    page.toggleDraftDay('tue');
    page.saveDays();
    http.expectOne('http://api.test/api/subscriptions/7/delivery-days/').flush(
      { detail: 'Stripe is unavailable.' }, { status: 503, statusText: 'Service Unavailable' },
    );

    expect(page.daysError()).toBe('Stripe is unavailable.');
    expect(page.editingDays()).toBeTrue();
    expect(page.subscription()?.delivery_days).toEqual(['mon', 'wed', 'fri']);
  });

  it('marks the subscription cancel-at-period-end after confirming cancellation', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = loadDashboard();

    fixture.componentInstance.cancel();
    http.expectOne('http://api.test/api/subscriptions/7/cancel/').flush({});

    expect(fixture.componentInstance.subscription()?.cancel_at_period_end).toBeTrue();
  });

  it('does not cancel when the user declines the confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = loadDashboard();

    fixture.componentInstance.cancel();
    http.expectNone('http://api.test/api/subscriptions/7/cancel/');
    expect(fixture.componentInstance.subscription()?.cancel_at_period_end).toBeFalse();
  });

  it('does NOT mark canceled and surfaces an error when the cancel request fails', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = loadDashboard();

    fixture.componentInstance.cancel();
    http.expectOne('http://api.test/api/subscriptions/7/cancel/').flush(
      { detail: 'Server error' }, { status: 500, statusText: 'Server Error' },
    );

    expect(fixture.componentInstance.subscription()?.cancel_at_period_end).toBeFalse();
    expect(fixture.componentInstance.canceling()).toBeFalse();
    expect(fixture.componentInstance.cancelError()).toContain("couldn't cancel");
  });

  it('propagates a server error on load into an error state (never a fake subscription)', () => {
    const fixture = TestBed.createComponent(SubscriptionPage);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(
      { detail: 'boom' }, { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.loadError()).toBeTrue();
    expect(fixture.componentInstance.subscription()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("couldn't load");
  });

  it('degrades to an empty payment history (not fake invoices) when invoices error', () => {
    const fixture = TestBed.createComponent(SubscriptionPage);
    fixture.detectChanges();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(SUB);
    http.expectOne('http://api.test/api/subscriptions/7/invoices/').flush(
      { detail: 'boom' }, { status: 500, statusText: 'Server Error' },
    );
    http.expectOne('http://api.test/api/subscriptions/7/deliveries/').flush(
      { detail: 'boom' }, { status: 500, statusText: 'Server Error' },
    );

    expect(fixture.componentInstance.invoices()).toEqual([]);
  });
});
