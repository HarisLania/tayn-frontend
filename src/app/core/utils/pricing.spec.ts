import {
  CYCLE_DAYS, computeCycle, deliveryDates, firstDeliveryOnOrAfter, money,
  sortDeliveryDays, toCycleQuote,
} from './pricing';

describe('computeCycle (mirrors subscriptions.views.quote_for)', () => {
  it('prices 4 weeks x one meal per chosen day', () => {
    const q = computeCycle(40, ['mon', 'wed', 'fri']);
    expect(q.mealsPerWeek).toBe(3);
    expect(q.mealsPerCycle).toBe(12);
    expect(q.pricePerCycle).toBe(480);
    expect(q.cycleDays).toBe(28);
  });

  it('matches the published rate card', () => {
    expect(computeCycle(35, ['mon', 'tue']).pricePerCycle).toBe(280);        // Low Cal, 2 days
    expect(computeCycle(50, ['mon', 'tue', 'wed', 'thu', 'fri']).pricePerCycle).toBe(1000);
    expect(computeCycle(75, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']).pricePerCycle).toBe(2100);
  });

  it('charges the same whichever days are picked, only how many', () => {
    const thuFri = computeCycle(40, ['thu', 'fri']);
    const monTue = computeCycle(40, ['mon', 'tue']);
    expect(thuFri.pricePerCycle).toBe(monTue.pricePerCycle);
    expect(thuFri.mealsPerCycle).toBe(monTue.mealsPerCycle);
  });

  it('resolves the first delivery when a start date is given', () => {
    // 2026-07-27 is a Monday; the customer only eats on Thursdays.
    const q = computeCycle(40, ['thu'], '2026-07-27');
    expect(q.firstDeliveryDate).toBe('2026-07-30');
  });

  it('money() rounds half-up to 2 decimals', () => {
    expect(money(1.005)).toBe(1.01);
    expect(CYCLE_DAYS).toBe(28);
  });
});

describe('firstDeliveryOnOrAfter (mirrors the backend delivery-cycle start)', () => {
  it('returns the start date itself when it is already a delivery day', () => {
    expect(firstDeliveryOnOrAfter('2026-07-27', ['mon', 'thu'])).toBe('2026-07-27');
  });

  it('wraps into the following week when needed', () => {
    // Saturday start, Monday-only deliveries -> the next Monday.
    expect(firstDeliveryOnOrAfter('2026-08-01', ['mon'])).toBe('2026-08-03');
  });

  it('is null without any delivery days', () => {
    expect(firstDeliveryOnOrAfter('2026-07-27', [])).toBeNull();
  });
});

describe('deliveryDates', () => {
  it('returns exactly meals_per_cycle dates across the 28-day cycle', () => {
    const dates = deliveryDates('2026-07-27', ['mon', 'wed', 'fri']);
    expect(dates.length).toBe(12);
    expect(dates[0]).toBe('2026-07-27');
    expect(dates[dates.length - 1]).toBe('2026-08-21');
  });

  it('holds four of every weekday whatever day the cycle starts on', () => {
    for (const start of ['2026-07-27', '2026-07-30', '2026-08-02']) {
      expect(deliveryDates(start, ['tue', 'sat']).length).toBe(8);
    }
  });
});

describe('helpers', () => {
  it('sorts delivery days into backend week order', () => {
    expect(sortDeliveryDays(['sun', 'fri', 'mon'])).toEqual(['mon', 'fri', 'sun']);
  });

  it('converts an API quote into its numeric form', () => {
    const q = toCycleQuote({
      plan_id: 1, price_per_meal: '40.00', meals_per_week: 3, meals_per_cycle: 12,
      price_per_cycle: '480.00', cycle_days: 28, first_delivery_date: '2026-07-27',
    });
    expect(q.pricePerMeal).toBe(40);
    expect(q.pricePerCycle).toBe(480);
    expect(q.firstDeliveryDate).toBe('2026-07-27');
  });
});
