import { describe, it, expect } from 'vitest';
import { money, signedPct, shortDate, lastPurchasedLabel, intervalLabel, plural, parseMoneyInput } from './format';

const NOW = new Date(2026, 8, 20, 12); // 20 Sep 2026
const ago = (n: number) => {
  const d = new Date(2026, 8, 20 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('money', () => {
  it('formats dollars with cents and thousands separators', () => {
    expect(money(4.29)).toBe('$4.29');
    expect(money(4)).toBe('$4.00');
    expect(money(1284.5)).toBe('$1,284.50');
    expect(money(0)).toBe('$0.00');
  });

  it('shows a dash rather than a fake zero when there is no amount', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
    expect(money(NaN)).toBe('—');
  });

  it('never prints a negative zero', () => {
    expect(money(-0.0000001)).toBe('$0.00');
  });
});

describe('signedPct', () => {
  it('signs the value, with a real minus sign', () => {
    expect(signedPct(5)).toBe('+5%');
    expect(signedPct(-10)).toBe('−10%');
    expect(signedPct(2.3)).toBe('+2.3%');
    expect(signedPct(-0.5)).toBe('−0.5%');
  });

  it('drops the decimal from whole numbers and shows zero unsigned', () => {
    expect(signedPct(10.0)).toBe('+10%');
    expect(signedPct(0)).toBe('0%');
    expect(signedPct(0.04)).toBe('0%');
  });
});

describe('shortDate', () => {
  it('omits the year in the current year', () => {
    expect(shortDate('2026-09-17', NOW)).toBe('Sep 17');
  });

  it('includes the year otherwise', () => {
    expect(shortDate('2025-12-31', NOW)).toBe('Dec 31, 2025');
  });
});

describe('lastPurchasedLabel', () => {
  it('speaks in days for a recent purchase', () => {
    expect(lastPurchasedLabel(ago(0), NOW)).toBe('Today');
    expect(lastPurchasedLabel(ago(1), NOW)).toBe('Yesterday');
    expect(lastPurchasedLabel(ago(4), NOW)).toBe('4 days ago');
    expect(lastPurchasedLabel(ago(13), NOW)).toBe('13 days ago');
  });

  it('switches to the date after two weeks, so nobody has to count', () => {
    expect(lastPurchasedLabel(ago(14), NOW)).toBe('Sep 6');
    expect(lastPurchasedLabel(ago(60), NOW)).toBe('Jul 22');
  });

  it('never says a negative number of days', () => {
    expect(lastPurchasedLabel(ago(-3), NOW)).toBe('Today');
  });
});

describe('intervalLabel', () => {
  it('uses natural phrases for the common rhythms', () => {
    expect(intervalLabel(1)).toBe('every day');
    expect(intervalLabel(7)).toBe('every week');
    expect(intervalLabel(14)).toBe('every 2 weeks');
  });

  it('otherwise states the days, rounded', () => {
    expect(intervalLabel(12)).toBe('every 12 days');
    expect(intervalLabel(11.6)).toBe('every 12 days');
  });
});

describe('plural', () => {
  it('agrees with the count', () => {
    expect(plural(1, 'item')).toBe('1 item');
    expect(plural(0, 'item')).toBe('0 items');
    expect(plural(3, 'store')).toBe('3 stores');
    expect(plural(2, 'box', 'boxes')).toBe('2 boxes');
  });
});

describe('parseMoneyInput', () => {
  it('reads ordinary amounts', () => {
    expect(parseMoneyInput('4.29')).toBe(4.29);
    expect(parseMoneyInput('4')).toBe(4);
    expect(parseMoneyInput('0')).toBe(0);
    expect(parseMoneyInput('.5')).toBe(0.5);
    expect(parseMoneyInput('5.')).toBe(5);
  });

  it('forgives a dollar sign, thousands commas and spaces', () => {
    expect(parseMoneyInput('$4.29')).toBe(4.29);
    expect(parseMoneyInput(' $1,284.50 ')).toBe(1284.5);
  });

  it('treats a blank field as "no price", not as an error', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('   ')).toBeNull();
  });

  it('rejects anything else, so a typo cannot become a price', () => {
    for (const bad of ['abc', '4.2.9', '-3', '1e3', '4,29x', '$', '.', 'NaN', 'Infinity']) {
      expect(parseMoneyInput(bad)).toBeNaN();
    }
  });
});
