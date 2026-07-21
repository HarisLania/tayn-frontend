import { CycleQuote, Quote, WeekdayCode, WEEKDAYS } from '../models';

/**
 * Cycle arithmetic, mirroring `subscriptions.models.Subscription`.
 *
 * A cycle is 28 days == exactly 4 weeks, so any cycle contains exactly four of
 * every weekday whatever day the customer starts on:
 *
 *     meals_per_cycle = 4 x delivery_days.length
 *     charge          = price_per_meal x meals_per_cycle
 *
 * Every cycle therefore costs the same and there is nothing to prorate at
 * signup. Which days were chosen affects only the schedule, never the price.
 */
export const CYCLE_WEEKS = 4;
export const CYCLE_DAYS = CYCLE_WEEKS * 7;   // 28

/** Round half-up to 2 decimals, matching Django's Decimal quantize(ROUND_HALF_UP). */
export function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a number the way the API returns money, as a 2-decimal string. */
export function formatMoney(n: number): string {
  return money(n).toFixed(2);
}

/**
 * The local mirror of `subscriptions.views.quote_for`.
 *
 * `POST /checkout/quote/` is authoritative; this exists so the summary updates
 * on the same tick the customer toggles a day, and still shows a price when the
 * backend is unreachable.
 */
export function computeCycle(
  pricePerMeal: number,
  deliveryDays: WeekdayCode[],
  startDate: string | null = null,
  planId: number | null = null,
): CycleQuote {
  const mealsPerWeek = deliveryDays.length;
  const mealsPerCycle = mealsPerWeek * CYCLE_WEEKS;
  return {
    planId,
    pricePerMeal,
    mealsPerWeek,
    mealsPerCycle,
    pricePerCycle: money(pricePerMeal * mealsPerCycle),
    cycleDays: CYCLE_DAYS,
    firstDeliveryDate: startDate ? firstDeliveryOnOrAfter(startDate, deliveryDays) : null,
  };
}

/** Convert an API quote into its numeric form for the templates. */
export function toCycleQuote(q: Quote): CycleQuote {
  return {
    planId: q.plan_id,
    pricePerMeal: Number(q.price_per_meal),
    mealsPerWeek: q.meals_per_week,
    mealsPerCycle: q.meals_per_cycle,
    pricePerCycle: Number(q.price_per_cycle),
    cycleDays: q.cycle_days,
    firstDeliveryDate: q.first_delivery_date ?? null,
  };
}

/**
 * First chosen weekday falling on or after `startDate`. Mirrors
 * `subscriptions.models.first_delivery_on_or_after`.
 *
 * This is where the delivery cycle starts, not `start_date`: a customer who
 * starts Wednesday but only picked Thursdays gets a cycle running Thursday to
 * Thursday. Billing is separate: Stripe anchors to checkout time, and the
 * first cycle is charged in full there.
 */
export function firstDeliveryOnOrAfter(startDate: string, deliveryDays: WeekdayCode[]): string | null {
  if (!deliveryDays.length) return null;
  const wanted = new Set(deliveryDays.map((d) => WEEKDAYS.indexOf(d)));
  const start = parseIsoDate(startDate);
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    if (wanted.has(mondayFirstWeekday(day))) return toIsoDate(day);
  }
  return startDate;
}

/**
 * Every delivery date in the 28 days from the first delivery. Mirrors
 * `Subscription.delivery_dates()`. Always returns `meals_per_cycle` dates.
 */
export function deliveryDates(startDate: string, deliveryDays: WeekdayCode[]): string[] {
  const first = firstDeliveryOnOrAfter(startDate, deliveryDays);
  if (!first) return [];
  const wanted = new Set(deliveryDays.map((d) => WEEKDAYS.indexOf(d)));
  const start = parseIsoDate(first);
  const dates: string[] = [];
  for (let i = 0; i < CYCLE_DAYS; i++) {
    const day = addDays(start, i);
    if (wanted.has(mondayFirstWeekday(day))) dates.push(toIsoDate(day));
  }
  return dates;
}

/** Sort delivery days into backend week order (Mon..Sun), as the API stores them. */
export function sortDeliveryDays(days: WeekdayCode[]): WeekdayCode[] {
  return days.slice().sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

// ---- date helpers ----------------------------------------------------------
// Dates are handled as local calendar days, never UTC instants: `new Date(iso)`
// parses "2026-07-27" as midnight UTC, which is the previous day west of
// Greenwich and would shift every delivery date by one.

/** Parse "YYYY-MM-DD" as a local calendar date. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as "YYYY-MM-DD" in local time. */
export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** JS getDay() is Sunday-0; the backend indexes Monday-0. */
export function mondayFirstWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The weekday code for a date, in backend vocabulary. */
export function weekdayCode(d: Date): WeekdayCode {
  return WEEKDAYS[mondayFirstWeekday(d)];
}

/** Whole days from today (local midnight) to an ISO date; negative if past. */
export function daysFromToday(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseIsoDate(iso).getTime() - today.getTime()) / 86_400_000);
}
