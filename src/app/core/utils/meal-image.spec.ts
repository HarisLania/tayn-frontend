import { resolveMealImage } from './meal-image';

describe('resolveMealImage', () => {
  it('passes through a real backend image untouched', () => {
    const url = resolveMealImage({
      id: 1, name: 'Grilled Chicken with Rice', meal_type: 'main',
      image: 'https://cdn.tayn.ae/meals/1.jpg',
    });
    expect(url).toBe('https://cdn.tayn.ae/meals/1.jpg');
  });

  it('derives a stable, keyword-matched photo when image is null', () => {
    const meal = { id: 3, name: 'Salmon with Quinoa', meal_type: 'main' as const, image: null };
    const url = resolveMealImage(meal);
    expect(url).toContain('loremflickr.com');
    expect(url).toContain('salmon');
    expect(url).toContain('quinoa');
    expect(url).toContain('lock=3');
  });

  it('is deterministic: the same meal always resolves to the same url', () => {
    const meal = { id: 42, name: 'Beef Lasagna', meal_type: 'main' as const, image: null };
    expect(resolveMealImage(meal)).toBe(resolveMealImage(meal));
  });

  it('gives different meals different lock values', () => {
    const a = resolveMealImage({ id: 1, name: 'Beef Lasagna', meal_type: 'main', image: null });
    const b = resolveMealImage({ id: 2, name: 'Beef Lasagna', meal_type: 'main', image: null });
    expect(a).not.toBe(b);
  });

  it('strips cooking-method descriptors instead of treating them as keywords', () => {
    const url = resolveMealImage({ id: 5, name: 'Grilled Chicken Salad', meal_type: 'main', image: null });
    expect(url).not.toContain('grilled');
    expect(url).toContain('chicken');
    expect(url).toContain('salad');
  });

  it('keeps hyphenated compound descriptors intact instead of splitting them into noise words', () => {
    const url = resolveMealImage({ id: 36, name: 'Sugar-Free Jello', meal_type: 'dessert', image: null });
    expect(url).not.toContain('sugar');
    expect(url).not.toContain('free');
    expect(url).toContain('jello');
  });

  it('merges known two-word food terms into one search-friendly token', () => {
    const url = resolveMealImage({ id: 18, name: 'Vanilla Ice Cream', meal_type: 'dessert', image: null });
    expect(url).toContain('icecream');
  });

  it('drops generic collective-noun suffixes so the real dish keyword survives', () => {
    const url = resolveMealImage({ id: 79, name: 'Protein Cookie Dough Bites', meal_type: 'dessert', image: null });
    expect(url).toContain('cookiedough');
    expect(url).not.toContain('bites');
  });

  it('never leaks digits or parentheses from names like "Boiled Eggs (x3)"', () => {
    const url = resolveMealImage({ id: 73, name: 'Boiled Eggs (x3)', meal_type: 'snack', image: null });
    const tagSegment = url.split('/').pop()!.split('?')[0];
    expect(tagSegment).not.toMatch(/\d/);
    expect(url).not.toContain('(');
  });

  it('falls back to meal type when the name has no extractable keywords', () => {
    const url = resolveMealImage({ id: 99, name: 'With & The', meal_type: 'snack', image: null });
    expect(url).toContain('snack');
    expect(url).toContain('food');
  });

  it('treats an empty string image as missing, not a real url', () => {
    const url = resolveMealImage({ id: 7, name: 'Turkey Meatloaf', meal_type: 'main', image: '' });
    expect(url).toContain('loremflickr.com');
  });
});
