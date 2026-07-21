# Tayn Frontend (Angular 20)

Premium meal-plan subscription app for the UAE. Built with **Angular 20** (standalone
components + signals), **SCSS** with CSS variables, and wired to the Django/DRF backend
documented at `http://127.0.0.1:8000/api/docs/`.

Brand colors: **`#E79E00`** (amber) and **`#D0FCFF`** (mint).

---

## Quick start

```bash
npm install
npm start          # ng serve, development config -> http://127.0.0.1:8000/api
```

Open http://localhost:4200. Have the backend running (`python manage.py runserver`
and `python manage.py seed_demo`) for live data. Otherwise the app falls back to bundled
demo data so every screen still renders.

### Common scripts

| Command | What it does |
| --- | --- |
| `npm start` | Dev server, **testing** config (local backend) |
| `npm run start:prod` | Dev server, **production** config |
| `npm run build` | Production build → `dist/tayn-frontend` |
| `npm run build:prod` | Explicit production build |
| `npm test` | Unit tests (Karma + Jasmine, Chrome) |
| `npm run test:ci` | Headless single-run tests |

---

## Environments & configs

Two configs and matching environment files, as requested:

```
src/app/config/
  app-config.model.ts     # shared AppConfig shape
  config.testing.ts       # apiBaseUrl: http://127.0.0.1:8000/api
  config.production.ts    # apiBaseUrl: https://api.tayn.ae/api  <-- change before deploy
src/environments/
  environment.ts              # PRODUCTION default (uses config.production)
  environment.development.ts  # DEVELOPMENT/testing (uses config.testing)
```

`angular.json` swaps `environment.ts` → `environment.development.ts` under the
**development** configuration, so:

- `ng serve` / `ng build --configuration development` → local backend
- `ng build` (production, default) → deployed backend

The active config is provided through the `APP_CONFIG` injection token
(`src/app/core/tokens/app-config.token.ts`) and injected into every service.

---

## Header behaves on auth state

`src/app/shared/header` reads `AuthService.isLoggedIn` (a signal):

- **Logged out** → `Home · Menu · Log In`
- **Logged in** → `Home · Menu · My Subscription`, plus the user chip and **Logout**

`/subscription` is protected by `authGuard`, which redirects to `/login`.

---

## Pages

| Route | Component | Screenshot |
| --- | --- | --- |
| `/` | `features/home` | Landing: hero, delivery banner, how-it-works, plans, reviews, CTA |
| `/menu` | `features/menu` | Weekly menu, filter by category + meal type |
| `/login` | `features/login` | Welcome-back sign-in |
| `/create-plan` | `features/create-plan` | 6-step wizard with live order summary |
| `/subscription` | `features/subscription` | Dashboard (guarded) |

The **Create My Plan** wizard: Choose Plan → What's Included → Start Date →
Delivery Days → Your Details → Review & Pay. There is no billing-cycle step, because every
subscription bills the same 28-day cycle, so there is nothing to choose.

---

## Billing model

Pricing is **per meal**. The customer picks a category, a start date, and which
weekdays they want meals; the meal count follows from the days chosen:

```
cycle           = 28 days == exactly 4 weeks
meals_per_cycle = 4 x deliveryDays.length
charge          = price_per_meal x meals_per_cycle
```

Any 28-day window holds exactly four of every weekday, so every cycle costs the same
whatever day the customer starts on and there is no partial period to prorate at signup.
Which days were chosen never changes the price, only the schedule.

| Category | AED/meal | 2 days/wk | 3 days/wk | 5 days/wk | 7 days/wk |
|---|---|---|---|---|---|
| Standard | 40 | 320 | 480 | 800 | 1,120 |
| Low Cal | 35 | 280 | 420 | 700 | 980 |
| Weight Gain | 50 | 400 | 600 | 1,000 | 1,400 |
| Protein Power | 75 | 600 | 900 | 1,500 | 2,100 |

The **first cycle is charged in full at checkout**, before any deliveries, so a bad card
fails at signup rather than on the morning of the first delivery. Cancelling stops future
billing but does not refund; the customer still receives the cycle they paid for.

Deliveries are scheduled from the **first delivery date** (the first chosen weekday on or
after `start_date`), which is a delivery-schedule anchor, not a billing one: Stripe anchors
its billing period to checkout time, so renewals clear shortly before each delivery cycle
ends. `start_date` must be at least `minStartLeadDays`
(default 2, mirroring the backend's `MIN_START_LEAD_DAYS`) ahead, for kitchen lead time,
so the wizard's calendar starts there and offers nothing earlier.

**The server prices the basket.** `core/utils/pricing.ts` mirrors the arithmetic exactly,
but it exists so the summary updates on the same tick a day is toggled and still shows a
figure offline. `POST /checkout/quote/` is authoritative, and its answer replaces the
local one as soon as it lands, so the total on screen is the total that gets charged.

---

## Backend alignment

Models and services mirror the actual DRF API (from `/api/schema/` / the backend source),
not just the mockups:

- **Auth (JWT).** `POST /auth/login/` and `/auth/register/` return `{ user, tokens }`;
  the access token is attached to every request by `authInterceptor`; logout blacklists
  the refresh token via `POST /auth/logout/`.
- **Menu.** `GET /categories/`, `GET /meals/?category=&meal_type=`.
- **Plans.** `GET /plans/`: one plan per category, carrying `category` and
  `price_per_meal`. The endpoint hides plans with no Stripe price, so every card the UI
  shows is one the customer can actually buy.
- **Checkout.** `POST /checkout/quote/` prices a selection and creates nothing;
  `POST /checkout/create-session/` returns the Stripe URL (and signs up anonymous users),
  then redirects back to `/subscription?status=success` or `/create-plan?status=cancelled`
  (both handled).
- **Subscriptions.** `GET /subscriptions/me/`, `GET /subscriptions/{id}/deliveries/`
  (the current cycle's dates), `GET /subscriptions/{id}/invoices/`,
  `POST /subscriptions/{id}/delivery-days/` and `/change-plan/` (both support
  `preview: true` for a proration quote before committing), `POST /{id}/cancel/`.

Money is a 2-decimal string on every endpoint; `CycleQuote` is the numeric form the
templates use so no template parses a decimal.

### Notes / assumptions

- **Categories are the "plans" in the UI.** The four cards (Standard, Low Cal, Weight
  Gain, Protein Power) each map to one backend category and its single `Plan`.
- **Marketing copy** the backend doesn't store (kcal ranges, taglines, badges, hero
  imagery) lives in `core/data/seed.data.ts` (`CATEGORY_META`) and is merged with live
  plan data into `PlanCard` view-models.
- **Delivery days** are stored and sent in backend week order (Mon…Sun), so
  `["fri","mon"]` and `["mon","fri"]` are the same selection.
- **Dates are local calendar days.** ISO dates are parsed/formatted by hand rather than
  through `new Date(iso)`, which reads `"2026-07-27"` as midnight *UTC* and shifts every
  delivery date by a day west of Greenwich.
- **Offline fallback.** Every service falls back to bundled demo data mirroring the
  seeded rate card if the backend is unreachable, so the UI is always demoable. Real
  rejections (401, 400, 500) always propagate; only `status === 0` degrades.

---

## Project structure

```
src/app/
  config/            # AppConfig + testing/production configs
  core/
    data/            # seed data + marketing metadata (offline fallback)
    guards/          # authGuard
    interceptors/    # JWT auth interceptor
    models/          # TS interfaces mirroring the DRF serializers
    services/        # auth, catalog, menu, subscription, order (wizard state)
    tokens/          # APP_CONFIG injection token
    utils/           # pricing (mirrors plans.Plan.price_for)
  shared/            # header, footer
  features/          # home, menu, login, subscription, create-plan
```

## Tests

Unit tests use `HttpTestingController` (no live backend needed) and cover pricing,
auth, catalog, menu, subscription and the wizard order service:

```bash
npm test
```
