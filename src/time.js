// -----------------------------------------------------------------------------
// Local calendar arithmetic in an IANA time zone, with nothing but Intl: the
// local date, weekday and minute of an instant, and the instant of a local
// date and time (daylight saving time included). The contract evaluates its
// periods on the clock of its time zone, like the Gladys pricing engine.
// -----------------------------------------------------------------------------

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;
export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const formatters = new Map();

function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
  return formatters.get(timeZone);
}

/** `{ date: 'YYYY-MM-DD', minutes, weekday: 'mon'… }` of an instant in a time zone. */
export function localParts(ms, timeZone) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdayOf(date),
  };
}

/** Offset of the time zone at an instant, in minutes (Paris: 60 or 120). */
function offsetMinutes(ms, timeZone) {
  const minute = ms - (((ms % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);
  const { date, minutes } = localParts(minute, timeZone);
  return Math.round((Date.parse(`${date}T00:00:00Z`) + minutes * MINUTE_MS - minute) / MINUTE_MS);
}

/**
 * Instant of a local date and minute of the day. A time that does not exist
 * (the hour skipped in spring) resolves to the instant after the jump, a time
 * that exists twice (autumn) to its first occurrence.
 */
export function localToUtc(date, minutes, timeZone) {
  const naive = Date.parse(`${date}T00:00:00Z`) + minutes * MINUTE_MS;
  // The offsets in force a day before and after cover any change of the day,
  // offsets of 12 hours and more (Auckland, Chatham) included.
  const offsets = new Set([
    offsetMinutes(naive - DAY_MS, timeZone),
    offsetMinutes(naive + DAY_MS, timeZone),
  ]);
  const guesses = [...offsets].map((offset) => naive - offset * MINUTE_MS);
  const candidates = guesses.filter((ms) => {
    const local = localParts(ms, timeZone);
    return local.date === date && local.minutes === minutes;
  });
  if (candidates.length > 0) {
    return Math.min(...candidates);
  }
  // Skipped by the spring change: the first instant after the gap, where the
  // offset switches (searched to the minute between the two guesses).
  let low = Math.min(...guesses);
  let high = Math.max(...guesses);
  const after = offsetMinutes(high, timeZone);
  while (high - low > MINUTE_MS) {
    const middle = low + Math.floor((high - low) / 2 / MINUTE_MS) * MINUTE_MS;
    if (offsetMinutes(middle, timeZone) === after) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
}

export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(date) {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Minutes of "HH:MM" ("24:00" is 1440). */
export function parseTime(text) {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && minutes <= 1440 ? minutes : null;
}

export function formatMinutes(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
}
