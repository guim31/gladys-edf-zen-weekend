// -----------------------------------------------------------------------------
// The reduced periods of one contract, read from the inputs the user saved in
// the Gladys contract wizard (GET /energy/contract): which period an instant
// belongs to, and when the off-peak state changes next. Same rules, same order
// and same time semantics as the tariff the core prices with (src/templates.js):
// holiday, weekend, chosen day, Enedis off-peak hours of the season, otherwise
// peak.
// test/schedule.test.js compares both, half-hour by half-hour, over years.
// -----------------------------------------------------------------------------

import {
  findOption,
  HOLIDAY_CALENDAR,
  TIMEZONE,
  CHOSEN_DAYS,
  LEGACY_OFF_PEAK_INPUT,
  SEASONS,
  UNSET_SLOT,
} from './templates.js';
import { holidayOn } from './holidays.js';
import { addDays, localParts, localToUtc, parseTime, weekdayOf } from './time.js';

export const PERIODS = ['holiday', 'weekend', 'chosen_day', 'off_peak_hours', 'peak'];
export const OFF_PEAK_PERIODS = ['holiday', 'weekend', 'chosen_day', 'off_peak_hours'];

// Far enough for any option: the Week-End option changes twice a week.
const HORIZON_DAYS = 15;

/** [start, end) minute ranges of ["HH:MM", "HH:MM"] slots, split at midnight. */
export function compileSlots(slots) {
  const ranges = [];
  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!Array.isArray(slot) || slot.length !== 2) {
      continue;
    }
    const start = parseTime(slot[0]);
    const end = parseTime(slot[1]);
    if (start === null || end === null || start >= 1440) {
      continue;
    }
    if (end > start) {
      ranges.push({ start, end });
    } else {
      ranges.push({ start, end: 1440 });
      if (end > 0) {
        ranges.push({ start: 0, end });
      }
    }
  }
  return ranges;
}

const finiteOrNull = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** The season of a local date 'YYYY-MM-DD', inclusive bounds like the core. */
export function seasonOf(date) {
  const monthDay = date.slice(5);
  return SEASONS.find(({ from, to }) =>
    from <= to ? monthDay >= from && monthDay <= to : monthDay >= from || monthDay <= to,
  ).key;
}

/**
 * The raw ["HH:MM", "HH:MM"] slots of each season, from its start and end
 * inputs (a slot with a missing bound, or left at UNSET_SLOT, is left out). A contract created before
 * 1.1.0 has one `off_peak_slots` input, priced all year round by its stored
 * tariff: the same slots for both seasons.
 */
function seasonalSlots(inputs) {
  const seasonal = SEASONS.some((season) => season.inputs.flat().some((key) => key in inputs));
  return Object.fromEntries(
    SEASONS.map((season) => [
      season.key,
      seasonal
        ? season.inputs
            .map(([start, end]) => [inputs[start], inputs[end]])
            .filter((slot) => slot.every((bound) => typeof bound === 'string'))
            .filter((slot) => slot[0] !== UNSET_SLOT[0] || slot[1] !== UNSET_SLOT[1])
        : Array.isArray(inputs[LEGACY_OFF_PEAK_INPUT])
          ? inputs[LEGACY_OFF_PEAK_INPUT]
          : [],
    ]),
  );
}

/**
 * The schedule of a contract of one of our templates, or null for a contract
 * of another template.
 */
export function buildSchedule(contract) {
  const option = findOption(contract?.template_key);
  if (!option) {
    return null;
  }
  const inputs = contract.inputs ?? {};
  const chosenDay =
    option.chosen_day && CHOSEN_DAYS.includes(inputs.chosen_day) ? inputs.chosen_day : null;
  const raw = option.off_peak_hours
    ? seasonalSlots(inputs)
    : Object.fromEntries(SEASONS.map((season) => [season.key, []]));
  const seasons = Object.fromEntries(
    SEASONS.map((season) => [
      season.key,
      {
        slots: compileSlots(raw[season.key]),
        rawSlots: raw[season.key],
        // An off-peak option whose hours of the season were never entered.
        unset: option.off_peak_hours && raw[season.key].length === 0,
      },
    ]),
  );
  const schedule = {
    id: contract.id,
    templateKey: option.key,
    option,
    timeZone:
      typeof contract.timezone === 'string' && contract.timezone ? contract.timezone : TIMEZONE,
    chosenDay,
    seasons,
    peakPrice: finiteOrNull(inputs.peak_price),
    offPeakPrice: finiteOrNull(inputs.off_peak_price),
  };
  // Two contracts with the same periods fire the same events once. Slots that
  // do not change with the season keep the signature of 1.0, the key of the
  // events already fired (/data): an upgrade never fires one twice.
  const compiled = SEASONS.map((season) => seasons[season.key].slots);
  const slots = compiled.every((entry) => JSON.stringify(entry) === JSON.stringify(compiled[0]))
    ? compiled[0]
    : Object.fromEntries(SEASONS.map((season, index) => [season.key, compiled[index]]));
  schedule.signature = JSON.stringify([schedule.timeZone, chosenDay, slots, option.off_peak_hours]);
  return schedule;
}

/** The off-peak hours of a local date: its season's. */
const seasonOfDate = (schedule, date) => schedule.seasons[seasonOf(date)];

/** The period of a local day as a whole, or null when the hours decide. */
export function dayPeriod(schedule, date, { holidays = true } = {}) {
  if (holidays && holidayOn(date)) {
    return 'holiday';
  }
  const weekday = weekdayOf(date);
  if (weekday === 'sat' || weekday === 'sun') {
    return 'weekend';
  }
  if (schedule.chosenDay !== null && weekday === schedule.chosenDay) {
    return 'chosen_day';
  }
  return null;
}

export function periodAt(schedule, ms) {
  // The core reads the holiday calendar by the local date of its own time
  // zone (Europe/Paris), the weekdays and hours in the contract time zone.
  if (holidayOn(localParts(ms, HOLIDAY_CALENDAR.timezone).date)) {
    return 'holiday';
  }
  const local = localParts(ms, schedule.timeZone);
  const whole = dayPeriod(schedule, local.date, { holidays: false });
  if (whole) {
    return whole;
  }
  return seasonOfDate(schedule, local.date).slots.some(
    (range) => local.minutes >= range.start && local.minutes < range.end,
  )
    ? 'off_peak_hours'
    : 'peak';
}

export const isOffPeak = (period) => OFF_PEAK_PERIODS.includes(period);

export function priceOf(schedule, period) {
  return isOffPeak(period) ? schedule.offPeakPrice : schedule.peakPrice;
}

/** The instants after `ms` where a period may start, in order. */
function boundaries(schedule, ms) {
  const today = localParts(ms, schedule.timeZone).date;
  const minutes = new Set([0]);
  for (const { slots } of Object.values(schedule.seasons)) {
    for (const range of slots) {
      minutes.add(range.start);
      minutes.add(range.end % 1440);
    }
  }
  const instants = [];
  for (let day = 0; day <= HORIZON_DAYS; day += 1) {
    const date = addDays(today, day);
    for (const minute of minutes) {
      const instant = localToUtc(date, minute, schedule.timeZone);
      if (instant > ms) {
        instants.push(instant);
      }
    }
  }
  return [...new Set(instants)].sort((a, b) => a - b);
}

/**
 * The next instant the off-peak state flips, with the period starting then;
 * null when it never flips within the horizon (off-peak hours all day long).
 */
export function nextChange(schedule, ms) {
  const offPeak = isOffPeak(periodAt(schedule, ms));
  for (const instant of boundaries(schedule, ms)) {
    const period = periodAt(schedule, instant);
    if (isOffPeak(period) !== offPeak) {
      return { at: instant, period };
    }
  }
  return null;
}

/**
 * The off-peak hours of a local day: `{ whole: period }` for a reduced day,
 * or the slots of the contract (possibly none).
 */
export function offPeakOfDay(schedule, date) {
  const whole = dayPeriod(schedule, date);
  if (whole) {
    return { whole, unset: false, slots: [] };
  }
  return {
    whole: null,
    unset: seasonOfDate(schedule, date).unset,
    slots: seasonOfDate(schedule, date).rawSlots.filter((slot) => compileSlots([slot]).length > 0),
  };
}
