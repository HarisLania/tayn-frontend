import { Plan } from './plan.model';
import { JwtTokens } from './user.model';

/**
 * `scheduled` = the first cycle is paid but the first delivery is still to come.
 * Stripe reports the subscription as `active` from the moment checkout is paid,
 * so the backend promotes it to `active` on `first_delivery_date` instead.
 */
export type SubscriptionStatus = 'scheduled' | 'active' | 'past_due' | 'canceled';
export type InvoiceStatus = 'paid' | 'failed' | 'pending';

export type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * Week order used by the backend (`subscriptions.models.WEEKDAYS`), indexed to
 * match `date.weekday()`, so Monday is 0. Delivery days are stored sorted by
 * this order, so the UI lists them the same way.
 */
export const WEEKDAYS: readonly WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS: Record<WeekdayCode, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

/**
 * subscriptions.Subscription serializer.
 *
 * A cycle is 28 days = exactly 4 weeks, so it always holds four of every
 * weekday: `meals_per_cycle = 4 × delivery_days.length` and the charge is the
 * same every cycle. All money is a 2-decimal string.
 */
export interface Subscription {
  id: number;
  plan: Plan;
  delivery_days: WeekdayCode[];    // e.g. ["mon","wed","fri"], sorted week order
  start_date: string;              // ISO date the customer asked to begin
  first_delivery_date: string;     // first chosen weekday on/after start_date; starts the delivery cycle
  meals_per_week: number;
  meals_per_cycle: number;
  price_per_cycle: string;         // "480.00"
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

/** subscriptions.Invoice serializer. */
export interface Invoice {
  id: number;
  stripe_invoice_id: string;
  amount: string;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
}

/** POST /checkout/quote/ body: prices a selection, creates nothing. */
export interface QuoteRequest {
  plan_id: number;
  delivery_days: WeekdayCode[];
  start_date?: string;
}

/**
 * POST /checkout/quote/ response: the cycle arithmetic, straight from the
 * server, so the UI never has to be the source of truth for money.
 * `first_delivery_date` is only present when `start_date` was sent.
 */
export interface Quote {
  plan_id: number;
  price_per_meal: string;
  meals_per_week: number;
  meals_per_cycle: number;
  price_per_cycle: string;
  cycle_days: number;              // always 28
  first_delivery_date?: string;
}

/** POST /checkout/create-session/ body (CheckoutSessionSerializer). */
export interface CheckoutSessionRequest {
  plan_id: number;
  start_date: string;              // ISO date (YYYY-MM-DD), >= today + MIN_START_LEAD_DAYS
  delivery_days: WeekdayCode[];
  // Required only for anonymous (new-account) checkout:
  name?: string;
  email?: string;
  phone?: string;
  delivery_address?: string;
  dietary_notes?: string;
  password?: string;
  confirm_password?: string;
}

/** The checkout response echoes the quote back alongside the Stripe URL. */
export interface CheckoutSessionResponse extends Quote {
  checkout_url: string;
  tokens?: JwtTokens;              // only when the call also created the account
}

/** GET /subscriptions/{id}/deliveries/: the current 28-day cycle's schedule. */
export interface DeliverySchedule {
  delivery_days: WeekdayCode[];
  first_delivery_date: string;
  meals_per_cycle: number;
  dates: string[];                 // ISO dates, always meals_per_cycle of them
}

/** `{preview: true}` response from change-plan / delivery-days. */
export interface ProrationPreview {
  preview: true;
  amount_due: number;              // AED, already converted from Stripe's minor units
  currency?: string;
  new_plan_id?: number;            // change-plan only
  meals_per_cycle?: number;        // delivery-days only
}

/** `{preview: false}` response: the change was applied. */
export interface ChangeApplied {
  preview: false;
  plan?: Subscription;             // change-plan returns the updated subscription here
  subscription?: Subscription;     // delivery-days returns it here
}

export type ChangeResponse = ProrationPreview | ChangeApplied;

/** Everything the Create-My-Plan wizard collects (frontend-only draft). */
export interface OrderDraft {
  categorySlug: string | null;
  deliveryDays: WeekdayCode[];
  startDate: string | null;
  fullName: string;
  email: string;
  phone: string;
  emirate: string;
  building: string;
  street: string;
  dietaryNotes: string;
  password: string;
  confirmPassword: string;
}

/**
 * The cycle breakdown shown in the order summary, the numeric mirror of
 * `Quote`, so templates do not have to parse decimal strings.
 */
export interface CycleQuote {
  planId: number | null;
  pricePerMeal: number;
  mealsPerWeek: number;
  mealsPerCycle: number;
  pricePerCycle: number;
  cycleDays: number;
  firstDeliveryDate: string | null;
}
