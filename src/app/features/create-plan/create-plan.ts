import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { OrderService, WIZARD_STEPS } from '../../core/services/order.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AuthService } from '../../core/services/auth.service';
import { WeekdayCode, WEEKDAYS, WEEKDAY_LABELS } from '../../core/models';
import { DELIVERY_EMIRATES } from '../../core/data/seed.data';
import { APP_CONFIG } from '../../core/tokens/app-config.token';
import { addDays, CYCLE_DAYS, CYCLE_WEEKS, toIsoDate } from '../../core/utils/pricing';

interface DayOption { code: WeekdayCode; label: string; }
interface Feature { icon: string; title: string; text: string; }
interface CalendarDay { iso: string; weekday: string; day: number; month: string; earliest: boolean; }

@Component({
  selector: 'app-create-plan',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './create-plan.html',
  styleUrl: './create-plan.scss',
})
export class CreatePlan {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly config = inject(APP_CONFIG);
  readonly order = inject(OrderService);
  private readonly subService = inject(SubscriptionService);
  /** Public: the template skips the sign-up fields for an already-signed-in customer. */
  readonly auth = inject(AuthService);

  readonly steps = WIZARD_STEPS;
  readonly emirates = DELIVERY_EMIRATES;
  readonly cycleWeeks = CYCLE_WEEKS;
  readonly cycleDays = CYCLE_DAYS;
  readonly leadDays = this.config.minStartLeadDays;
  readonly submitting = signal(false);
  readonly checkoutError = signal<string | null>(null);

  readonly cards = this.order.cards;
  readonly step = this.order.step;
  readonly draft = this.order.draft;
  readonly price = this.order.price;
  readonly selectedCard = this.order.selectedCard;

  /** Stripe sends the customer back here with ?status=cancelled if they bail. */
  readonly checkoutCancelled = this.route.snapshot.queryParamMap.get('status') === 'cancelled';

  readonly weekdays: DayOption[] = WEEKDAYS.map((code) => ({ code, label: WEEKDAY_LABELS[code] }));

  readonly features: Feature[] = [
    { icon: '✓', title: 'Chef-Prepared Meals', text: 'One freshly cooked meal for every delivery day you choose, with no repeats within a week.' },
    { icon: '✓', title: 'Macro Targets', text: 'Daily calories and protein targets designed by our in-house nutritionists.' },
    { icon: '✓', title: 'Fresh Ingredients', text: 'UAE-sourced produce, halal-certified meats, zero preservatives.' },
    { icon: '✓', title: 'Free Morning Delivery', text: 'Arrives at your door by 7am, on every day you picked, across all seven emirates.' },
    { icon: '✓', title: 'Change Days Anytime', text: 'Add or drop delivery days whenever you like, and we prorate the difference automatically.' },
    { icon: '✓', title: 'WhatsApp Support', text: 'Dedicated support team available 8am–10pm daily for anything you need.' },
  ];

  readonly calendar = signal<CalendarDay[]>(this.buildCalendar());

  readonly detailsForm = this.fb.nonNullable.group(
    {
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(7)]],
      emirate: ['Dubai', Validators.required],
      building: ['', Validators.required],
      street: ['', Validators.required],
      dietaryNotes: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: (g) => g.get('password')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true } },
  );

  // detailsForm.valid is a plain property, not a signal, so reading it directly
  // inside `canContinue` would only re-check it when `step` itself changes,
  // leaving the Continue button stuck disabled once the user finishes typing.
  private readonly detailsValid = toSignal(
    this.detailsForm.statusChanges.pipe(map(() => this.detailsForm.valid)),
    { initialValue: this.detailsForm.valid },
  );

  readonly canContinue = computed(() => {
    switch (this.step()) {
      case 0: return !!this.draft().categorySlug;
      case 2: return !!this.draft().startDate;
      case 3: return this.draft().deliveryDays.length >= 1;
      case 4: return this.auth.isLoggedIn() || this.detailsValid();
      default: return true;
    }
  });

  constructor() {
    this.order.reset();
    this.order.loadCatalog();
  }

  selectCategory(slug: string): void { this.order.selectCategory(slug); }
  selectDate(iso: string): void { this.order.patch({ startDate: iso }); }
  toggleDay(code: WeekdayCode): void { this.order.toggleDay(code); }
  isDay(code: WeekdayCode): boolean { return this.draft().deliveryDays.includes(code); }

  /** Chosen days in week order (Mon to Sun), the order the backend stores them in. */
  get selectedDayLabels(): string {
    return this.draft().deliveryDays.map((c) => WEEKDAY_LABELS[c]).join(', ');
  }

  continue(): void {
    if (!this.canContinue()) {
      if (this.step() === 4) this.detailsForm.markAllAsTouched();
      return;
    }
    if (this.step() === 4) {
      const v = this.detailsForm.getRawValue();
      this.order.patch({
        fullName: v.fullName, email: v.email, phone: v.phone, emirate: v.emirate,
        building: v.building, street: v.street, dietaryNotes: v.dietaryNotes,
        password: v.password, confirmPassword: v.confirmPassword,
      });
    }
    this.order.next();
  }

  back(): void { this.order.back(); }
  goHome(): void { this.router.navigate(['/']); }

  confirm(): void {
    const body = this.order.toCheckoutRequest(this.auth.isLoggedIn());
    if (!body) return;
    this.submitting.set(true);
    this.checkoutError.set(null);
    this.subService.createCheckoutSession(body).subscribe({
      next: (res) => {
        // New account? persist the returned tokens.
        if (res.tokens && !this.auth.isLoggedIn()) {
          const d = this.draft();
          this.auth.applyTokens(res.tokens, {
            id: 0, email: d.email,
            first_name: d.fullName.split(' ')[0], last_name: d.fullName.split(' ').slice(1).join(' '),
            profile: { phone: `+971${d.phone}`, delivery_address: `${d.building}, ${d.street}, ${d.emirate}`, dietary_notes: d.dietaryNotes, stripe_customer_id: '' },
          });
        }
        this.submitting.set(false);
        // Stripe returns a checkout_url to redirect to; it sends the customer
        // back to /subscription?status=success once the card is collected.
        if (res.checkout_url) { window.location.href = res.checkout_url; return; }
        this.router.navigate(['/subscription']);
      },
      // A rejected checkout (duplicate email, password mismatch, unsynced plan,
      // start date inside the kitchen lead time) propagates, so re-enable the
      // button and show what went wrong.
      error: (err) => {
        this.submitting.set(false);
        this.checkoutError.set(this.checkoutErrorMessage(err));
      },
    });
  }

  /** Extract a human-readable message from a DRF error body (string detail, or first field error). */
  private checkoutErrorMessage(err: unknown): string {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      const firstField = Object.values(body as Record<string, unknown>)[0];
      if (Array.isArray(firstField) && typeof firstField[0] === 'string') return firstField[0];
      if (typeof firstField === 'string') return firstField;
    }
    return "We couldn't start your checkout. Please check your details and try again.";
  }

  /**
   * Selectable start dates, beginning at today + MIN_START_LEAD_DAYS. The
   * kitchen's lead time. Anything earlier is rejected by the backend's
   * `validate_start_date`, so it is never offered.
   */
  private buildCalendar(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const earliest = addDays(new Date(), this.config.minStartLeadDays);
    for (let i = 0; i < 14; i++) {
      const d = addDays(earliest, i);
      days.push({
        iso: toIsoDate(d),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        day: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        earliest: i === 0,
      });
    }
    return days;
  }
}
