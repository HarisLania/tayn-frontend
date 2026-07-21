import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DeliverySchedule, SubscriptionStatus, WeekdayCode, WEEKDAYS, WEEKDAY_LABELS,
} from '../../core/models';
import { CYCLE_WEEKS, daysFromToday, sortDeliveryDays } from '../../core/utils/pricing';

const STATUS_COPY: Record<SubscriptionStatus, { label: string; note: string }> = {
  scheduled: { label: 'Scheduled', note: 'Your first cycle is paid. Deliveries start on your first delivery date.' },
  active: { label: 'Active', note: 'Deliveries are running.' },
  past_due: { label: 'Payment failed', note: 'We could not take the last payment. Update your card to keep deliveries running.' },
  canceled: { label: 'Canceled', note: 'This subscription has ended.' },
};

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './subscription.html',
  styleUrl: './subscription.scss',
})
export class SubscriptionPage {
  private readonly subService = inject(SubscriptionService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly displayName = this.auth.displayName;
  readonly user = this.auth.user;
  readonly subscription = this.subService.subscription;
  readonly invoices = this.subService.invoices;
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly cancelError = signal<string | null>(null);
  readonly canceling = signal(false);
  readonly cycleWeeks = CYCLE_WEEKS;

  /** Stripe redirects back here with ?status=success after checkout. */
  readonly justSubscribed = this.route.snapshot.queryParamMap.get('status') === 'success';

  readonly schedule = signal<DeliverySchedule | null>(null);

  readonly weekdays: { code: WeekdayCode; label: string }[] =
    WEEKDAYS.map((code) => ({ code, label: WEEKDAY_LABELS[code] }));

  readonly statusCopy = computed(() => {
    const sub = this.subscription();
    return sub ? STATUS_COPY[sub.status] ?? STATUS_COPY.active : null;
  });

  /**
   * The next delivery still to come, from the cycle's schedule. Falls back to
   * `first_delivery_date`, where the delivery cycle starts, before the
   * schedule arrives.
   */
  readonly nextDelivery = computed(() => {
    const dates = this.schedule()?.dates ?? [];
    return dates.find((d) => daysFromToday(d) >= 0) ?? this.subscription()?.first_delivery_date ?? null;
  });

  readonly daysUntil = computed(() => {
    const next = this.nextDelivery();
    return next ? Math.max(daysFromToday(next), 0) : 0;
  });

  /** The rest of this cycle's deliveries, for the schedule list. */
  readonly upcoming = computed(() =>
    (this.schedule()?.dates ?? []).filter((d) => daysFromToday(d) >= 0),
  );

  // ---- editing delivery days ----
  readonly editingDays = signal(false);
  readonly draftDays = signal<WeekdayCode[]>([]);
  readonly savingDays = signal(false);
  readonly daysError = signal<string | null>(null);
  /** Stripe's prorated amount for the pending change, once previewed. */
  readonly proration = signal<number | null>(null);

  readonly draftChanged = computed(() => {
    const sub = this.subscription();
    return !!sub && this.draftDays().join(',') !== sub.delivery_days.join(',');
  });

  constructor() {
    this.subService.getMySubscription().subscribe({
      next: (sub) => {
        this.loading.set(false);
        if (!sub) return;
        this.subService.getInvoices(sub.id).subscribe();
        this.subService.getDeliveries(sub.id).subscribe((s) => this.schedule.set(s));
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  isDeliveryDay(code: WeekdayCode): boolean {
    return this.subscription()?.delivery_days.includes(code) ?? false;
  }

  startEditingDays(): void {
    this.draftDays.set([...(this.subscription()?.delivery_days ?? [])]);
    this.proration.set(null);
    this.daysError.set(null);
    this.editingDays.set(true);
  }

  cancelEditingDays(): void {
    this.editingDays.set(false);
    this.proration.set(null);
  }

  toggleDraftDay(code: WeekdayCode): void {
    this.draftDays.update((days) =>
      days.includes(code) ? days.filter((d) => d !== code) : sortDeliveryDays([...days, code]),
    );
    // The previewed amount belongs to the previous selection, so drop it.
    this.proration.set(null);
  }

  /** Ask Stripe what the change costs without applying it. */
  previewDays(): void {
    const sub = this.subscription();
    if (!sub || !this.draftDays().length) return;
    this.savingDays.set(true);
    this.daysError.set(null);
    this.subService.changeDeliveryDays(sub.id, this.draftDays(), true).subscribe({
      next: (res) => {
        this.savingDays.set(false);
        if (res.preview) this.proration.set(Number(res.amount_due ?? 0));
      },
      error: (err) => {
        this.savingDays.set(false);
        this.daysError.set(this.errorMessage(err, "We couldn't price that change."));
      },
    });
  }

  saveDays(): void {
    const sub = this.subscription();
    if (!sub || !this.draftDays().length) return;
    this.savingDays.set(true);
    this.daysError.set(null);
    this.subService.changeDeliveryDays(sub.id, this.draftDays()).subscribe({
      next: () => {
        this.savingDays.set(false);
        this.editingDays.set(false);
        this.proration.set(null);
        // The schedule the kitchen works from has moved, so reload it.
        this.subService.getDeliveries(sub.id).subscribe((s) => this.schedule.set(s));
      },
      error: (err) => {
        this.savingDays.set(false);
        this.daysError.set(this.errorMessage(err, "We couldn't update your delivery days."));
      },
    });
  }

  cancel(): void {
    const sub = this.subscription();
    if (!sub || this.canceling()) return;
    if (!confirm('Cancel your subscription? Your plan stays active until the end of the billing period.')) return;
    this.canceling.set(true);
    this.cancelError.set(null);
    this.subService.cancel(sub.id).subscribe({
      next: () => this.canceling.set(false),
      // The cancel did NOT go through, so say so rather than falsely showing "canceled".
      error: () => {
        this.canceling.set(false);
        this.cancelError.set("We couldn't cancel your subscription. Please try again or contact support.");
      },
    });
  }

  /** First readable message out of a DRF error body, else the given fallback. */
  private errorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      const first = Object.values(body as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
      if (typeof first === 'string') return first;
    }
    return fallback;
  }
}
