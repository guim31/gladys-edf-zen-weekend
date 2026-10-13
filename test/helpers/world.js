// -----------------------------------------------------------------------------
// A running integration against the SDK's fake Gladys, with a clock the test
// moves, contracts as the core serves them (GET /energy/contract) and /data
// kept in memory. No network.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { buildEnergyContracts } from '../../src/templates.js';

const { templates } = buildEnergyContracts();

/** A contract of one of our templates, its inputs the wizard defaults plus `inputs`. */
export function contractOf(templateKey, { inputs = {}, ...fields } = {}) {
  const template = templates.find((entry) => entry.key === templateKey);
  return {
    id: `contract-${templateKey}`,
    template_key: templateKey,
    template_version: template.version,
    pricing_mode: 'rules',
    inputs: {
      ...Object.fromEntries(template.inputs.map((input) => [input.key, input.default])),
      ...inputs,
    },
    valid_from: '2026-09-15',
    valid_to: null,
    timezone: 'Europe/Paris',
    currency: 'EUR',
    billing_period_start_day: 1,
    status: 'active',
    ...fields,
  };
}

export function createMemoryStore(files = {}) {
  const content = new Map(Object.entries(files));
  return {
    files: content,
    load: (name) => (content.has(name) ? structuredClone(content.get(name)) : null),
    save: (name, value) => content.set(name, structuredClone(value)),
  };
}

/** A clock the test sets and moves. */
export function createClock(iso) {
  const clock = {
    ms: Date.parse(iso),
    now: () => clock.ms,
    set: (value) => {
      clock.ms = Date.parse(value);
    },
    advance: (ms) => {
      clock.ms += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {Array} [options.contracts] what GET /energy/contract answers
 * @param {object|null} [options.calendar] entries already in `holidays-fr`;
 *   null: the key is not ours (another integration owns it, 403)
 * @param {string} [options.at] the instant of the start (ISO)
 */
export async function createWorld({
  config = { language: 'fr' },
  contracts = [contractOf('edf-zen-weekend-off-peak')],
  calendar = [],
  at = '2026-10-12T08:00:00Z',
  store = createMemoryStore(),
  connect = true,
} = {}) {
  const clock = createClock(at);
  const gladys = createFakeGladys({
    config,
    energyContracts: contracts,
    energyCalendars: calendar === null ? {} : { 'holidays-fr': calendar },
  });
  const app = registerHandlers(gladys, { store, now: clock.now, timers: false });
  if (connect) {
    await gladys.connect();
  }
  const { service } = app;
  return {
    gladys,
    app,
    service,
    clock,
    store,
    /** The holiday dates Gladys holds, local dates (the fake stores UTC midnights). */
    holidays: () =>
      (gladys.fake.energyCalendars['holidays-fr'] ?? []).map((entry) =>
        entry.starts_at.slice(0, 10),
      ),
    /** Moves the clock to an instant, ticking at each minute like the timer would. */
    async runUntil(iso) {
      const target = Date.parse(iso);
      while (clock.ms < target) {
        clock.advance(Math.min(60_000, target - clock.ms));
        await service.tick();
      }
    },
  };
}
