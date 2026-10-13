// -----------------------------------------------------------------------------
// The running part of the integration. Gladys prices the contracts by itself
// with the templates of the manifest; the container only:
// - feeds the `holidays-fr` calendar the templates read (src/calendar.js);
// - reads the users' contracts of these templates (prices, off-peak hours,
//   chosen day) and fires the "off-peak hours start / end" scene triggers at
//   the exact minute the period changes, which the core's own "price changed"
//   trigger cannot say (it runs every 30 minutes, on any price or label
//   change: the weekend turning into Monday's off-peak hours is one);
// - answers the widget and the scene action from the same schedule.
//
// A sync every 10 minutes reads the contracts again (a contract created or
// changed in Gladys sends no event to the integration). The clock sleeps until
// the next change of the off-peak state, 10 minutes at most.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { HolidayCalendar } from './calendar.js';
import { createFailureLog } from './failures.js';
import { formatInstant, periodLabel } from './i18n.js';
import { buildSchedule, isOffPeak, nextChange, periodAt, priceOf } from './schedule.js';
import { MINUTE_MS } from './time.js';

const logger = createLogger({ name: 'edf-zen-weekend' });

// Keys are forever: scenes store them.
export const TRIGGERS = {
  STARTED: 'off_peak_started',
  ENDED: 'off_peak_ended',
};
export const WIDGET_KEY = 'off_peak_hours';

const EVENTS_FILE = 'events.json';

export const SYNC_INTERVAL_MS = 10 * MINUTE_MS;
// A change noticed later than this (the host was asleep, Gladys unreachable)
// fires no event: a water heater started an hour late is worse than none.
export const LATE_EVENT_MS = 15 * MINUTE_MS;

export class TariffService {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK client
   * @param {object} options.store JSON files in /data (src/store.js)
   * @param {Function} [options.now] the clock (tests)
   * @param {boolean} [options.timers] false in the tests: they call tick()
   */
  constructor({ gladys, store, now = Date.now, timers = true }) {
    this.gladys = gladys;
    this.now = now;
    this.timers = timers;
    this.store = store;
    this.calendar = new HolidayCalendar({ gladys, store });
    // signature → instant of the last flip fired
    const fired = store.load(EVENTS_FILE);
    this.fired = fired && typeof fired === 'object' ? fired : {};
    this.config = null;
    this.contracts = [];
    this.schedules = [];
    // signature → { at, period, next } seen at the last tick
    this.states = new Map();
    this.syncTimer = null;
    this.tickTimer = null;
    this.queue = Promise.resolve();
    this.failures = createFailureLog(logger);
  }

  // One operation at a time: a tick never interleaves with a sync.
  serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async start(config) {
    this.config = config;
    await this.serial(() => this.syncNow());
    await this.serial(() => this.tickNow());
    if (this.timers && !this.syncTimer) {
      this.syncTimer = setInterval(() => this.sync().catch(() => {}), SYNC_INTERVAL_MS);
    }
  }

  /** After a reconnection: Gladys may have changed while the link was down. */
  resync() {
    return this.serial(async () => {
      await this.syncNow();
      await this.tickNow();
    });
  }

  reconfigure(config) {
    this.config = config;
    this.refreshWidget();
  }

  sync() {
    return this.serial(async () => {
      await this.syncNow();
      await this.tickNow();
    });
  }

  tick() {
    return this.serial(() => this.tickNow());
  }

  async syncNow() {
    let contracts;
    try {
      const all = await this.gladys.getEnergyContracts();
      contracts = (Array.isArray(all) ? all : []).filter((contract) => buildSchedule(contract));
      this.failures.succeeded('contracts', 'The energy contracts are read again');
    } catch (err) {
      this.failures.failed(
        'contracts',
        `Could not read the energy contracts: ${err?.message ?? err}`,
      );
      contracts = this.contracts;
    }
    const before = JSON.stringify(
      this.schedules.map((schedule) => [schedule.id, schedule.signature]),
    );
    this.contracts = contracts;
    this.schedules = activeSchedules(contracts);
    const after = JSON.stringify(
      this.schedules.map((schedule) => [schedule.id, schedule.signature]),
    );

    const status = this.calendar.status;
    await this.calendar.sync({ now: this.now(), contracts });
    if (before !== after || status !== this.calendar.status) {
      if (before !== after) {
        logger.info(`${this.schedules.length} active EDF Zen Week-End contract(s)`);
      }
      this.refreshWidget();
    }
  }

  async tickNow() {
    const now = this.now();
    const seen = new Set();
    let changed = false;
    for (const schedule of this.schedules) {
      if (seen.has(schedule.signature)) {
        continue;
      }
      seen.add(schedule.signature);
      const period = periodAt(schedule, now);
      const next = nextChange(schedule, now);
      const previous = this.states.get(schedule.signature);
      this.states.set(schedule.signature, { at: now, period, next });
      // The last flip since the previous tick; after a (re)start, within the
      // late window: a boundary that fell while the container restarted still
      // fires, at most once (the fired flips are kept in /data).
      const flip = lastFlip(schedule, previous ? previous.at : now - LATE_EVENT_MS, now);
      if (!flip) {
        continue;
      }
      changed = true;
      const late = now - flip.at;
      if (late > LATE_EVENT_MS) {
        logger.info(
          `Off-peak change noticed ${Math.round(late / MINUTE_MS)} min late: no scene event`,
        );
        continue;
      }
      if ((this.fired[schedule.signature] ?? 0) >= flip.at) {
        continue;
      }
      await this.fire(schedule, period, next, now);
      this.fired = { ...this.fired, [schedule.signature]: flip.at };
      this.store.save(EVENTS_FILE, this.fired);
    }
    // A schedule that left (contract closed) is forgotten.
    for (const signature of this.states.keys()) {
      if (!seen.has(signature)) {
        this.states.delete(signature);
      }
    }
    if (changed) {
      this.refreshWidget();
    }
    this.armTick(now);
  }

  async fire(schedule, period, next, now) {
    const language = this.config?.language ?? 'fr';
    const common = {
      price: priceOf(schedule, period),
      minutes_until_change: next ? Math.round((next.at - now) / MINUTE_MS) : null,
      next_change: next ? formatInstant(next.at, now, schedule.timeZone, language) : null,
    };
    const [key, data] = isOffPeak(period)
      ? [
          TRIGGERS.STARTED,
          { period, period_label: periodLabel(period, schedule, language), ...common },
        ]
      : [
          TRIGGERS.ENDED,
          {
            ...common,
            next_period: next ? next.period : null,
            next_period_label: next ? periodLabel(next.period, schedule, language) : null,
          },
        ];
    try {
      await this.gladys.publishSceneEvent(key, data);
      logger.info(`Scene event ${key} (${isOffPeak(period) ? period : 'peak'})`);
      this.failures.succeeded('event');
    } catch (err) {
      this.failures.failed(
        'event',
        `Could not fire the ${key} scene event: ${err?.message ?? err}`,
      );
    }
  }

  armTick(now) {
    if (!this.timers) {
      return;
    }
    clearTimeout(this.tickTimer);
    let delay = SYNC_INTERVAL_MS;
    for (const { next } of this.states.values()) {
      if (next) {
        // One second past the boundary: the new period has begun.
        delay = Math.min(delay, Math.max(1000, next.at - now + 1000));
      }
    }
    this.tickTimer = setTimeout(() => this.tick().catch(() => {}), delay);
  }

  refreshWidget() {
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** The contract the widget and the scene action describe: the latest active one. */
  primarySchedule() {
    return this.schedules[0] ?? null;
  }

  /** What is in force now, for the widget and the scene action. */
  snapshot(language) {
    const schedule = this.primarySchedule();
    if (!schedule) {
      return null;
    }
    const now = this.now();
    const period = periodAt(schedule, now);
    const next = nextChange(schedule, now);
    return {
      schedule,
      now,
      period,
      offPeak: isOffPeak(period),
      label: periodLabel(period, schedule, language),
      price: priceOf(schedule, period),
      next,
      minutesLeft: next ? Math.round((next.at - now) / MINUTE_MS) : null,
    };
  }

  stop() {
    clearInterval(this.syncTimer);
    clearTimeout(this.tickTimer);
    this.syncTimer = null;
    this.tickTimer = null;
  }
}

/** The last off-peak flip in (from, to], or null. */
export function lastFlip(schedule, from, to) {
  let last = null;
  for (let flip = nextChange(schedule, from); flip && flip.at <= to;) {
    last = flip;
    flip = nextChange(schedule, flip.at);
  }
  return last;
}

/** The schedules of the active contracts, the latest contract first. */
export function activeSchedules(contracts) {
  return contracts
    .filter((contract) => contract.status === 'active')
    .sort((a, b) => String(b.valid_from ?? '').localeCompare(String(a.valid_from ?? '')))
    .map(buildSchedule)
    .filter(Boolean);
}
