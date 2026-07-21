import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SubscriptionService } from './subscription.service';
import { APP_CONFIG } from '../tokens/app-config.token';
import { AppConfig } from '../../config/app-config.model';
import { CheckoutSessionRequest, Subscription } from '../models';

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

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: CFG }],
    });
    service = TestBed.inject(SubscriptionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('quotes a selection without creating anything', () => {
    service.quote({ plan_id: 1, delivery_days: ['mon', 'wed', 'fri'], start_date: '2026-07-27' })
      .subscribe((q) => {
        expect(q.meals_per_cycle).toBe(12);
        expect(q.price_per_cycle).toBe('480.00');
      });
    const req = http.expectOne('http://api.test/api/checkout/quote/');
    expect(req.request.body.delivery_days).toEqual(['mon', 'wed', 'fri']);
    req.flush({
      plan_id: 1, price_per_meal: '40.00', meals_per_week: 3, meals_per_cycle: 12,
      price_per_cycle: '480.00', cycle_days: 28, first_delivery_date: '2026-07-27',
    });
  });

  it('GETs /subscriptions/me/ and caches it', () => {
    service.getMySubscription().subscribe((s) => expect(s?.id).toBe(7));
    http.expectOne('http://api.test/api/subscriptions/me/').flush(SUB);
    expect(service.subscription()?.price_per_cycle).toBe('480.00');
  });

  it('returns null on 404 (no active subscription)', () => {
    service.getMySubscription().subscribe((s) => expect(s).toBeNull());
    http.expectOne('http://api.test/api/subscriptions/me/').flush({ detail: 'No active subscription.' }, { status: 404, statusText: 'Not Found' });
  });

  it('GETs the current cycle delivery schedule', () => {
    service.getDeliveries(7).subscribe((s) => expect(s?.dates.length).toBe(12));
    http.expectOne('http://api.test/api/subscriptions/7/deliveries/').flush({
      delivery_days: ['mon', 'wed', 'fri'], first_delivery_date: '2026-08-03',
      meals_per_cycle: 12,
      dates: Array.from({ length: 12 }, (_, i) => `2026-08-${String(i + 3).padStart(2, '0')}`),
    });
  });

  it('derives the schedule locally when the backend is unreachable', () => {
    service.getMySubscription().subscribe();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(SUB);

    service.getDeliveries(7).subscribe((s) => {
      expect(s?.dates.length).toBe(12);
      expect(s?.dates[0]).toBe('2026-08-03');
    });
    http.expectOne('http://api.test/api/subscriptions/7/deliveries/').error(new ProgressEvent('offline'));
  });

  it('POSTs the checkout session request', () => {
    const body: CheckoutSessionRequest = {
      plan_id: 11, start_date: '2026-07-30', delivery_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    };
    service.createCheckoutSession(body).subscribe((res) => expect(res.checkout_url).toBe('https://stripe/x'));
    const req = http.expectOne('http://api.test/api/checkout/create-session/');
    expect(req.request.body.plan_id).toBe(11);
    expect(req.request.body.billing_interval).toBeUndefined();
    req.flush({
      checkout_url: 'https://stripe/x', plan_id: 11, price_per_meal: '40.00',
      meals_per_week: 5, meals_per_cycle: 20, price_per_cycle: '800.00', cycle_days: 28,
    });
  });

  it('previews a delivery-day change without applying it', () => {
    service.getMySubscription().subscribe();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(SUB);

    service.changeDeliveryDays(7, ['mon', 'tue', 'wed', 'thu', 'fri'], true).subscribe((res) => {
      expect(res.preview).toBeTrue();
    });
    const req = http.expectOne('http://api.test/api/subscriptions/7/delivery-days/');
    expect(req.request.body.preview).toBeTrue();
    req.flush({ preview: true, meals_per_cycle: 20, amount_due: 320, currency: 'aed' });

    // A preview changes nothing locally.
    expect(service.subscription()?.delivery_days).toEqual(['mon', 'wed', 'fri']);
  });

  it('caches the updated subscription an applied delivery-day change returns', () => {
    service.getMySubscription().subscribe();
    http.expectOne('http://api.test/api/subscriptions/me/').flush(SUB);

    const updated = { ...SUB, delivery_days: ['mon', 'tue'], meals_per_cycle: 8, price_per_cycle: '320.00' };
    service.changeDeliveryDays(7, ['mon', 'tue']).subscribe();
    http.expectOne('http://api.test/api/subscriptions/7/delivery-days/')
      .flush({ preview: false, subscription: updated });

    expect(service.subscription()?.meals_per_cycle).toBe(8);
    expect(service.subscription()?.price_per_cycle).toBe('320.00');
  });

  it('cancels via POST /subscriptions/{id}/cancel/', () => {
    service.cancel(7).subscribe((ok) => expect(ok).toBeTrue());
    http.expectOne('http://api.test/api/subscriptions/7/cancel/').flush({ detail: 'ok', active_until: null });
  });

  it('falls back to the demo subscription ONLY when the backend is unreachable', () => {
    service.getMySubscription().subscribe((s) => expect(s?.id).toBe(1)); // demoSubscription id
    http.expectOne('http://api.test/api/subscriptions/me/').error(new ProgressEvent('offline')); // status 0
  });

  it('propagates a real server error (500) instead of fabricating a subscription', () => {
    let errored = false;
    service.getMySubscription().subscribe({ next: () => fail('should not emit'), error: () => { errored = true; } });
    http.expectOne('http://api.test/api/subscriptions/me/').flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });
    expect(errored).toBeTrue();
    expect(service.subscription()).toBeNull();
  });

  it('returns an empty invoice list on a real error (never fake invoices)', () => {
    service.getInvoices(7).subscribe((list) => expect(list).toEqual([]));
    http.expectOne('http://api.test/api/subscriptions/7/invoices/').flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });
  });

  it('propagates a failed cancel instead of reporting success', () => {
    let errored = false;
    service.cancel(7).subscribe({ next: () => fail('should not report success'), error: () => { errored = true; } });
    http.expectOne('http://api.test/api/subscriptions/7/cancel/').flush({ detail: 'boom' }, { status: 500, statusText: 'Server Error' });
    expect(errored).toBeTrue();
  });
});
