// -----------------------------------------------------------------------------
// The French national public holidays computed by src/holidays.js, checked
// against the `date-holidays` library (a test-only dependency) from 1990 to
// 2100: its public holidays of France without a region.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Holidays from 'date-holidays';
import {
  HOLIDAY_KEYS,
  easterSunday,
  holidayOn,
  holidaysBetween,
  holidaysOf,
  nextHoliday,
} from '../src/holidays.js';
import { HOLIDAY_NAMES } from '../src/i18n.js';

test('the same national holidays as date-holidays, 1990 to 2100', () => {
  const library = new Holidays('FR');
  for (let year = 1990; year <= 2100; year += 1) {
    const expected = library
      .getHolidays(year)
      .filter((holiday) => holiday.type === 'public')
      .map((holiday) => holiday.date.slice(0, 10))
      .sort();
    assert.deepEqual(
      holidaysOf(year).map((holiday) => holiday.date),
      expected,
      String(year),
    );
  }
});

test('2026 and 2027, written out', () => {
  assert.deepEqual(
    holidaysOf(2026).map(({ date, key }) => `${date} ${key}`),
    [
      '2026-01-01 new_year',
      '2026-04-06 easter_monday',
      '2026-05-01 labour_day',
      '2026-05-08 victory_1945',
      '2026-05-14 ascension',
      '2026-05-25 whit_monday',
      '2026-07-14 national_day',
      '2026-08-15 assumption',
      '2026-11-01 all_saints',
      '2026-11-11 armistice',
      '2026-12-25 christmas',
    ],
  );
  assert.equal(easterSunday(2027), '2027-03-28');
  assert.equal(holidayOn('2027-05-06').key, 'ascension');
  assert.equal(holidayOn('2027-05-07'), null);
  // Good Friday and 26 December are holidays of Alsace-Moselle only.
  assert.equal(holidayOn('2027-03-26'), null);
  assert.equal(holidayOn('2027-12-26'), null);
});

test('ranges and the next holiday cross the new year', () => {
  assert.deepEqual(
    holidaysBetween('2026-12-20', '2027-01-05').map((holiday) => holiday.date),
    ['2026-12-25', '2027-01-01'],
  );
  assert.equal(nextHoliday('2026-12-26').date, '2027-01-01');
  assert.equal(nextHoliday('2026-11-11').date, '2026-11-11');
});

test('every holiday has a name in the four languages', () => {
  for (const names of Object.values(HOLIDAY_NAMES)) {
    assert.deepEqual(Object.keys(names).sort(), [...HOLIDAY_KEYS].sort());
  }
});
