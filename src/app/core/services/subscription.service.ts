import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { APP_CONFIG } from '../tokens/app-config.token';
import {
  ChangeResponse, CheckoutSessionRequest, CheckoutSessionResponse, DeliverySchedule,
  Invoice, Quote, QuoteRequest, Subscription, WeekdayCode,
} from '../models';
import { SEED_PLANS } from '../data/seed.data';
import { computeCycle, deliveryDates, formatMoney } from '../utils/pricing';

/**
 * True only when the backend could not be reached at all (network down, CORS,
 * DNS), meaning `status === 0`. Any real HTTP response is the server actively
 * answering and must NOT be masked by demo/offline data.
 */
function isUnreachable(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0;
}

/** Demo subscription used when the backend is unreachable (mirrors the Layla mockup). */
function demoSubscription(): Subscription {
  const plan = SEED_PLANS.find((p) => p.category.slug === 'protein-power')!;
  const delivery_days: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const start_date = '2026-01-05';
  const cycle = computeCycle(Number(plan.price_per_meal), delivery_days, start_date, plan.id);
  return {
    id: 1,
    plan,
    delivery_days,
    start_date,
    first_delivery_date: cycle.firstDeliveryDate ?? start_date,
    meals_per_week: cycle.mealsPerWeek,
    meals_per_cycle: cycle.mealsPerCycle,
    price_per_cycle: formatMoney(cycle.pricePerCycle),
    status: 'active',
    current_period_end: '2026-02-02T00:00:00Z',
    cancel_at_period_end: false,
    created_at: '2025-12-01T00:00:00Z',
  };
}

function demoInvoices(): Invoice[] {
  return [
    { id: 3, stripe_invoice_id: 'in_jan', amount: '1500.00', status: 'paid', paid_at: '2026-01-05T00:00:00Z', created_at: '2026-01-05T00:00:00Z' },
    { id: 2, stripe_invoice_id: 'in_dec', amount: '1500.00', status: 'paid', paid_at: '2025-12-08T00:00:00Z', created_at: '2025-12-08T00:00:00Z' },
    { id: 1, stripe_invoice_id: 'in_nov', amount: '1200.00', status: 'paid', paid_at: '2025-11-10T00:00:00Z', created_at: '2025-11-10T00:00:00Z' },
  ];
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private get api(): string { return this.config.apiBaseUrl; }

  private readonly _subscription = signal<Subscription | null>(null);
  private readonly _invoices = signal<Invoice[]>([]);
  readonly subscription = this._subscription.asReadonly();
  readonly invoices = this._invoices.asReadonly();

  /**
   * POST /checkout/quote/: the server's price for a selection, creating
   * nothing. Money is quoted by the backend rather than computed here so the
   * total on screen is always the total that will be charged.
   */
  quote(body: QuoteRequest): Observable<Quote> {
    return this.http.post<Quote>(`${this.api}/checkout/quote/`, body);
  }

  /**
   * GET /subscriptions/me/.
   * 404 -> null (customer has no active subscription, a normal state).
   * Unreachable backend → the offline demo subscription (portfolio mode).
   * Any other real error (500, 403, …) propagates, so we never show a real
   * logged-in user a fabricated "active" plan that isn't theirs.
   */
  getMySubscription(): Observable<Subscription | null> {
    return this.http.get<Subscription>(`${this.api}/subscriptions/me/`).pipe(
      catchError((err) => {
        if (err instanceof HttpErrorResponse && err.status === 404) return of(null);
        if (isUnreachable(err)) return of(demoSubscription());
        return throwError(() => err);
      }),
      tap((sub) => this._subscription.set(sub)),
    );
  }

  /**
   * GET /subscriptions/{id}/invoices/.
   * Unreachable backend → offline demo invoices. Any real error degrades to an
   * empty list (the dashboard shows its "No payments yet" state) rather than
   * fabricating paid invoices the customer never actually had.
   */
  getInvoices(subscriptionId: number): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.api}/subscriptions/${subscriptionId}/invoices/`).pipe(
      catchError((err) => of(isUnreachable(err) ? demoInvoices() : [])),
      tap((list) => this._invoices.set(list)),
    );
  }

  /**
   * GET /subscriptions/{id}/deliveries/: every delivery date in the current
   * 28-day cycle. Offline, the same dates are derived locally from the cached
   * subscription (the arithmetic is deterministic; see utils/pricing).
   */
  getDeliveries(subscriptionId: number): Observable<DeliverySchedule | null> {
    return this.http.get<DeliverySchedule>(`${this.api}/subscriptions/${subscriptionId}/deliveries/`).pipe(
      catchError((err) => {
        const sub = this._subscription();
        if (!isUnreachable(err) || !sub) return of(null);
        return of({
          delivery_days: sub.delivery_days,
          first_delivery_date: sub.first_delivery_date,
          meals_per_cycle: sub.meals_per_cycle,
          dates: deliveryDates(sub.start_date, sub.delivery_days),
        });
      }),
    );
  }

  /**
   * POST /checkout/create-session/: creates the account (if new) + Stripe session.
   * This doubles as sign-up, so a real backend rejection (duplicate email,
   * password mismatch, invalid plan) must propagate rather than fake a session.
   * Only a genuinely unreachable backend degrades to the offline demo response.
   */
  createCheckoutSession(body: CheckoutSessionRequest): Observable<CheckoutSessionResponse> {
    return this.http.post<CheckoutSessionResponse>(`${this.api}/checkout/create-session/`, body).pipe(
      catchError((err) => {
        if (!isUnreachable(err)) return throwError(() => err);
        const cycle = computeCycle(0, body.delivery_days, body.start_date, body.plan_id);
        return of({
          checkout_url: '',
          plan_id: body.plan_id,
          price_per_meal: '0.00',
          meals_per_week: cycle.mealsPerWeek,
          meals_per_cycle: cycle.mealsPerCycle,
          price_per_cycle: '0.00',
          cycle_days: cycle.cycleDays,
          first_delivery_date: cycle.firstDeliveryDate ?? undefined,
          tokens: { access: 'demo-access', refresh: 'demo-refresh' },
        } satisfies CheckoutSessionResponse);
      }),
    );
  }

  /**
   * POST /subscriptions/{id}/cancel/: cancel at period end.
   * Only marks the local subscription canceled AFTER the backend confirms.
   * A failed request must propagate. Telling a customer they've canceled
   * while Stripe keeps billing them would be a real (money) bug.
   */
  cancel(subscriptionId: number): Observable<boolean> {
    return this.http.post(`${this.api}/subscriptions/${subscriptionId}/cancel/`, {}).pipe(
      tap(() => {
        const cur = this._subscription();
        if (cur) this._subscription.set({ ...cur, cancel_at_period_end: true });
      }),
      map(() => true),
    );
  }

  /**
   * POST /subscriptions/{id}/change-plan/: switch the per-meal rate.
   * The meal count is unchanged by a plan switch, so only the rate moves;
   * with `preview` the response is Stripe's prorated amount and nothing is
   * charged. Errors propagate so a failed proration/upgrade surfaces.
   */
  changePlan(subscriptionId: number, newPlanId: number, preview = false): Observable<ChangeResponse> {
    return this.http.post<ChangeResponse>(`${this.api}/subscriptions/${subscriptionId}/change-plan/`, {
      new_plan_id: newPlanId, preview,
    }).pipe(tap((res) => this.absorb(res)));
  }

  /**
   * POST /subscriptions/{id}/delivery-days/: change which days meals arrive.
   * A different number of days is a quantity change Stripe prorates; the same
   * number of days costs the same and the backend skips the round trip.
   */
  changeDeliveryDays(
    subscriptionId: number, deliveryDays: WeekdayCode[], preview = false,
  ): Observable<ChangeResponse> {
    return this.http.post<ChangeResponse>(`${this.api}/subscriptions/${subscriptionId}/delivery-days/`, {
      delivery_days: deliveryDays, preview,
    }).pipe(tap((res) => this.absorb(res)));
  }

  /** Cache the updated subscription a confirmed (non-preview) change returns. */
  private absorb(res: ChangeResponse): void {
    if (res.preview) return;
    const updated = res.subscription ?? res.plan;
    if (updated) this._subscription.set(updated);
  }
}
