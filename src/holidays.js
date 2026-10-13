// -----------------------------------------------------------------------------
// French national public holidays, computed offline. EDF prices "les jours
// fériés nationaux et non les jours fériés correspondant à des particularités
// régionales" like the weekend (presentation sheets of Zen Week-End and Zen
// Week-End Plus): Good Friday and 26 December, holidays in Alsace-Moselle only,
// are not part of it. Eight fixed dates and three moving ones, tied to Easter
// (Gregorian computus). test/holidays.test.js checks them against the
// `date-holidays` library over a century.
// -----------------------------------------------------------------------------

import { addDays } from './time.js';

const FIXED = [
  ['01-01', 'new_year'],
  ['05-01', 'labour_day'],
  ['05-08', 'victory_1945'],
  ['07-14', 'national_day'],
  ['08-15', 'assumption'],
  ['11-01', 'all_saints'],
  ['11-11', 'armistice'],
  ['12-25', 'christmas'],
];

const FROM_EASTER = [
  [1, 'easter_monday'],
  [39, 'ascension'],
  [50, 'whit_monday'],
];

export const HOLIDAY_KEYS = [...FIXED, ...FROM_EASTER].map(([, key]) => key);

/** Easter Sunday of a year, 'YYYY-MM-DD' (anonymous Gregorian algorithm). */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const byYear = new Map();

/** The national public holidays of a year, sorted: `[{ date, key }]`. */
export function holidaysOf(year) {
  if (!byYear.has(year)) {
    const easter = easterSunday(year);
    const holidays = [
      ...FIXED.map(([monthDay, key]) => ({ date: `${year}-${monthDay}`, key })),
      ...FROM_EASTER.map(([days, key]) => ({ date: addDays(easter, days), key })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1));
    byYear.set(year, Object.freeze(holidays.map((holiday) => Object.freeze(holiday))));
  }
  return byYear.get(year);
}

/** The holidays between two local dates, both included. */
export function holidaysBetween(from, to) {
  const holidays = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    holidays.push(...holidaysOf(year).filter(({ date }) => date >= from && date <= to));
  }
  return holidays;
}

/** The holiday of a local date, or null. */
export function holidayOn(date) {
  return holidaysOf(Number(date.slice(0, 4))).find((holiday) => holiday.date === date) ?? null;
}

/** The first holiday on or after a local date. */
export function nextHoliday(date) {
  const year = Number(date.slice(0, 4));
  return [...holidaysOf(year), ...holidaysOf(year + 1)].find((holiday) => holiday.date >= date);
}
