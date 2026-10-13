// -----------------------------------------------------------------------------
// The reduced periods of one contract, read from the inputs the user saved in
// the Gladys contract wizard (GET /energy/contract): which period an instant
// belongs to, and when the off-peak state changes next. Same rules, same order
// and same time semantics as the tariff the core prices with (src/templates.js):
// holiday, weekend, chosen day, Enedis off-peak hours, otherwise peak.
// test/schedule.test.js compares both, half-hour by half-hour, over years.
// -----------------------------------------------------------------------------

import { findOption, HOLIDAY_CALENDAR, TIMEZONE, CHOSEN_DAYS } from './templates.js';
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
  const slots = option.off_peak_hours ? compileSlots(inputs.off_peak_slots) : [];
  const schedule = {
    id: contract.id,
    templateKey: option.key,
    option,
    timeZone:
      typeof contract.timezone === 'string' && contract.timezone ? contract.timezone : TIMEZONE,
    chosenDay,
    slots,
    rawSlots:
      option.off_peak_hours && Array.isArray(inputs.off_peak_slots) ? inputs.off_peak_slots : [],
    peakPrice: finiteOrNull(inputs.peak_price),
    offPeakPrice: finiteOrNull(inputs.off_peak_price),
  };
  // Two contracts with the same periods fire the same events once.
  schedule.signature = JSON.stringify([schedule.timeZone, chosenDay, slots, option.off_peak_hours]);
  return schedule;
}

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
  return schedule.slots.some((range) => local.minutes >= range.start && local.minutes < range.end)
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
  for (const range of schedule.slots) {
    minutes.add(range.start);
    minutes.add(range.end % 1440);
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
    return { whole, slots: [] };
  }
  return {
    whole: null,
    slots: schedule.rawSlots.filter((slot) => compileSlots([slot]).length > 0),
  };
}
