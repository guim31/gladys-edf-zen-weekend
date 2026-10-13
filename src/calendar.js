// -----------------------------------------------------------------------------
// Feeds the `holidays-fr` tariff calendar of Gladys. The core accepts entries
// from 5 years back to 7 days ahead only, so the publication runs again every
// sync and pushes each new holiday about a week ahead.
//
// Each holiday is published once: the dates already sent are kept in /data.
// The core purges the calendar entries older than the oldest consumption it
// stores, and a purged holiday published again would be "changed" and trigger
// a cost recalculation at every sync. The near holidays (± 7 days, what the
// current prices read) are checked against the calendar read back from Gladys,
// so a restored database gets them again.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { HOLIDAY_CALENDAR, HOLIDAY_VALUE } from './templates.js';
import { holidaysBetween } from './holidays.js';
import { addDays, localParts } from './time.js';
import { createFailureLog } from './failures.js';

const logger = createLogger({ name: 'holidays-calendar' });

const STATE_FILE = 'state.json';
// The core refuses an entry starting more than 7 days ahead: a margin of one
// day keeps a daylight saving change inside the window.
export const AHEAD_DAYS = 6;
const NEAR_DAYS = 7;
const MAX_PAST_DAYS = 5 * 365 - 2;

export class HolidayCalendar {
  constructor({ gladys, store }) {
    this.gladys = gladys;
    this.store = store;
    const saved = store.load(STATE_FILE);
    this.published = new Set(
      Array.isArray(saved?.published_holidays) ? saved.published_holidays : [],
    );
    // null until the first sync; 'ok', 'refused' (another integration owns
    // the key) or 'failed'.
    this.status = null;
    this.failures = createFailureLog(logger);
  }

  /**
   * The local dates to keep published: from the oldest of our contracts (or
   * the 1st of January of last year, for the templates of other providers
   * reading the same key) up to a week ahead.
   */
  window(today, contracts) {
    const starts = contracts
      .map((contract) => contract.valid_from)
      .filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date));
    let from = `${Number(today.slice(0, 4)) - 1}-01-01`;
    for (const start of starts) {
      if (start < from) {
        from = start;
      }
    }
    const oldest = addDays(today, -MAX_PAST_DAYS);
    return { from: from < oldest ? oldest : from, to: addDays(today, AHEAD_DAYS) };
  }

  async sync({ now, contracts }) {
    const today = localParts(now, HOLIDAY_CALENDAR.timezone).date;
    const { from, to } = this.window(today, contracts);
    const wanted = holidaysBetween(from, to).map((holiday) => holiday.date);
    const missing = new Set(wanted.filter((date) => !this.published.has(date)));

    try {
      for (const date of await this.nearDatesInGladys(today)) {
        this.published.add(date);
      }
      for (const date of wanted) {
        if (date >= addDays(today, -NEAR_DAYS) && !this.nearDates.has(date)) {
          missing.add(date);
        }
      }
      if (missing.size > 0) {
        const entries = [...missing].sort().map((date) => ({ date, value: HOLIDAY_VALUE }));
        const result = await this.gladys.publishEnergyCalendar(HOLIDAY_CALENDAR.key, entries);
        for (const { date } of entries) {
          this.published.add(date);
        }
        this.save();
        logger.info(
          `Published ${entries.length} public holiday(s) to the ${HOLIDAY_CALENDAR.key} calendar` +
            (result?.changed_from ? `, costs recalculated from ${result.changed_from}` : ''),
        );
      }
      this.status = 'ok';
      this.failures.succeeded('sync', `The ${HOLIDAY_CALENDAR.key} calendar is fed again`);
    } catch (err) {
      if (err?.status === 403) {
        this.status = 'refused';
        this.failures.failed(
          'sync',
          `Gladys refused the ${HOLIDAY_CALENDAR.key} calendar: another integration provides it. ` +
            'The templates read its values.',
        );
      } else {
        this.status = 'failed';
        this.failures.failed(
          'sync',
          `Could not publish the public holidays: ${err?.message ?? err}`,
        );
      }
    }
    return this.status;
  }

  /** The holiday dates Gladys has around today, read back. */
  async nearDatesInGladys(today) {
    const entries = await this.gladys.getEnergyCalendar(HOLIDAY_CALENDAR.key, {
      from: new Date(Date.parse(`${addDays(today, -NEAR_DAYS - 1)}T00:00:00Z`)).toISOString(),
      to: new Date(Date.parse(`${addDays(today, NEAR_DAYS + 1)}T23:59:59Z`)).toISOString(),
    });
    this.nearDates = new Set(
      (Array.isArray(entries) ? entries : [])
        .filter((entry) => entry?.value === HOLIDAY_VALUE && entry.starts_at)
        .map((entry) => localParts(Date.parse(entry.starts_at), HOLIDAY_CALENDAR.timezone).date),
    );
    return this.nearDates;
  }

  save() {
    this.store.save(STATE_FILE, { published_holidays: [...this.published].sort() });
  }
}
