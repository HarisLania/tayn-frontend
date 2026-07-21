import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CheckoutSessionRequest, CycleQuote, OrderDraft, PlanCard, QuoteRequest, WeekdayCode,
} from '../models';
import { computeCycle, sortDeliveryDays, toCycleQuote } from '../utils/pricing';
import { CatalogService } from './catalog.service';
import { SubscriptionService } from './subscription.service';

/**
 * Billing cycle is no longer a step: every subscription bills the same 28-day
 * cycle, so there is nothing to choose. Price follows from the plan and the
 * number of delivery days.
 */
export const WIZARD_STEPS = [
  'Choose Plan', "What's Included", 'Start Date', 'Delivery Days',
  'Your Details', 'Review & Pay',
] as const;

const EMPTY_DRAFT: OrderDraft = {
  categorySlug: null,
  deliveryDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startDate: null,
  fullName: '', email: '', phone: '', emirate: 'Dubai',
  building: '', street: '', dietaryNotes: '', password: '', confirmPassword: '',
};

/** Wizard state (draft + step) with a live, server-quoted cycle price. */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly catalog = inject(CatalogService);
  private readonly subscriptions = inject(SubscriptionService);

  readonly totalSteps = WIZARD_STEPS.length;

  private readonly _step = signal(0);
  private readonly _draft = signal<OrderDraft>({ ...EMPTY_DRAFT });
  private readonly _cards = signal<PlanCard[]>([]);
  private readonly _serverQuote = signal<CycleQuote | null>(null);

  readonly step = this._step.asReadonly();
  readonly draft = this._draft.asReadonly();
  readonly cards = this._cards.asReadonly();

  readonly selectedCard = computed(() =>
    this._cards().find((c) => c.slug === this._draft().categorySlug),
  );

  /**
   * The cycle price computed locally: 4 weeks x one meal per chosen day.
   * Updates on the same tick the customer toggles a day, so the summary never
   * lags behind the selection, and keeps working with the backend down.
   */
  readonly localQuote = computed<CycleQuote | null>(() => {
    const card = this.selectedCard();
    if (!card) return null;
    const d = this._draft();
    return computeCycle(card.pricePerMeal, d.deliveryDays, d.startDate, card.planId);
  });

  /**
   * What the summary shows: the server's quote when it describes the current
   * selection, otherwise the local mirror while that quote is in flight. The
   * two agree. Preferring the server's means the figure on screen is the one
   * that will be charged, even if the rate card changed since page load.
   */
  readonly price = computed<CycleQuote | null>(() => {
    const local = this.localQuote();
    if (!local) return null;
    const server = this._serverQuote();
    const describesSelection =
      server !== null &&
      server.planId === local.planId &&
      server.mealsPerWeek === local.mealsPerWeek &&
      (local.firstDeliveryDate === null || server.firstDeliveryDate === local.firstDeliveryDate);
    return describesSelection ? server : local;
  });

  private readonly quoteRequests = new Subject<QuoteRequest>();

  constructor() {
    // Re-quote whenever the priced part of the draft moves. Debounced because
    // picking days fires one change per tap, and switchMap so a slow earlier
    // quote can never overwrite the answer for a newer selection.
    this.quoteRequests.pipe(
      debounceTime(150),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((req) => this.subscriptions.quote(req).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe((quote) => this._serverQuote.set(quote ? toCycleQuote(quote) : null));

    effect(() => {
      const card = this.selectedCard();
      const d = this._draft();
      if (!card?.planId || !d.deliveryDays.length) return;
      this.quoteRequests.next({
        plan_id: card.planId,
        delivery_days: sortDeliveryDays(d.deliveryDays),
        ...(d.startDate ? { start_date: d.startDate } : {}),
      });
    });
  }

  loadCatalog(): void {
    this.catalog.getPlanCards().subscribe((cards) => this._cards.set(cards));
  }

  // ---- steps ----
  goTo(s: number): void { this._step.set(Math.min(Math.max(s, 0), this.totalSteps - 1)); }
  next(): void { this._step.update((s) => Math.min(s + 1, this.totalSteps - 1)); }
  back(): void { this._step.update((s) => Math.max(s - 1, 0)); }

  // ---- draft ----
  patch(patch: Partial<OrderDraft>): void { this._draft.update((d) => ({ ...d, ...patch })); }
  selectCategory(slug: string): void { this.patch({ categorySlug: slug }); }
  toggleDay(day: WeekdayCode): void {
    this._draft.update((d) => {
      const deliveryDays = d.deliveryDays.includes(day)
        ? d.deliveryDays.filter((x) => x !== day)
        : sortDeliveryDays([...d.deliveryDays, day]);
      return { ...d, deliveryDays };
    });
  }

  /** The backend plan id for the chosen category, one plan per category now. */
  resolvePlanId(): number | null {
    return this.selectedCard()?.planId ?? null;
  }

  /** Build the POST /checkout/create-session/ payload. */
  toCheckoutRequest(isAuthenticated: boolean): CheckoutSessionRequest | null {
    const planId = this.resolvePlanId();
    const d = this._draft();
    if (!planId || !d.startDate || !d.deliveryDays.length) return null;
    const base: CheckoutSessionRequest = {
      plan_id: planId,
      start_date: d.startDate,
      delivery_days: sortDeliveryDays(d.deliveryDays),
    };
    if (isAuthenticated) return base;
    return {
      ...base,
      name: d.fullName,
      email: d.email,
      phone: `+971${d.phone}`,
      delivery_address: `${d.building}, ${d.street}, ${d.emirate}`,
      dietary_notes: d.dietaryNotes,
      password: d.password,
      confirm_password: d.confirmPassword,
    };
  }

  reset(): void {
    this._step.set(0);
    this._draft.set({ ...EMPTY_DRAFT });
    this._serverQuote.set(null);
  }
}
