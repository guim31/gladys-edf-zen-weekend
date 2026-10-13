// -----------------------------------------------------------------------------
// The contract templates, priced by the pricing engine of Gladys 5.2.0 itself
// (test/vendor/): the cases of the EDF offer, daylight saving time, the
// holiday calendar, and the manifest kept in sync with src/templates.js.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { engine } from './helpers/engine.js';
import {
  CHOSEN_DAYS,
  DEFAULT_OFF_PEAK_SLOTS,
  HOLIDAY_CALENDAR,
  OPTIONS,
  TARIFF,
  buildEnergyContracts,
} from '../src/templates.js';
import { holidaysBetween } from '../src/holidays.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const { templates, calendars } = buildEnergyContracts();
const template = (key) => templates.find((entry) => entry.key === key);
const defaults = (entry) =>
  Object.fromEntries(entry.inputs.map((input) => [input.key, input.default]));

const HOLIDAYS = holidaysBetween('2025-01-01', '2030-12-31').map(({ date }) => ({
  calendar_key: HOLIDAY_CALENDAR.key,
  date,
  value: 'holiday',
}));
const holidayLookup = (entries = HOLIDAYS) =>
  engine.createCalendarLookup(
    { [HOLIDAY_CALENDAR.key]: { granularity: 'day', timezone: 'Europe/Paris' } },
    entries,
    'Europe/Paris',
  );
const CONTRACT = { timezone: 'Europe/Paris' };

/** Price of 1 kWh starting at each instant: [{ label, energy }]. */
function price(key, instants, { inputs = {}, lookup = holidayLookup() } = {}) {
  const entry = template(key);
  const compiled = engine.compileTariff(entry.tariff, { ...defaults(entry), ...inputs });
  const { costs } = engine.priceIntervals(
    compiled,
    CONTRACT,
    instants.map((starts_at) => ({ starts_at, kwh: 1 })),
    { calendars: lookup },
  );
  // The engine answers in chronological order: back to the order asked.
  const byStart = new Map(costs.map((cost) => [Date.parse(cost.starts_at), cost]));
  return instants.map((instant) => {
    const cost = byStart.get(Date.parse(instant));
    return { label: cost.label, energy: cost.components.energy };
  });
}

test('the manifest carries the templates generated from src/templates.js (npm run templates)', () => {
  assert.deepEqual(manifest.energy_contracts, buildEnergyContracts());
});

test('four templates, one per EDF option, under keys that never change', () => {
  assert.deepEqual(
    templates.map((entry) => entry.key),
    [
      'edf-zen-weekend',
      'edf-zen-weekend-off-peak',
      'edf-zen-weekend-plus',
      'edf-zen-weekend-plus-off-peak',
    ],
  );
  for (const entry of templates) {
    assert.equal(entry.country, 'FR');
    assert.equal(entry.currency, 'EUR');
    assert.equal(entry.timezone, 'Europe/Paris');
    assert.equal(entry.pricing_mode, 'rules');
    assert.equal(entry.version, TARIFF.applicable_from);
    assert.deepEqual(entry.calendars, ['holidays-fr']);
    assert.deepEqual(entry.tariff.calendars, ['holidays-fr']);
  }
  assert.deepEqual(calendars, [
    { key: 'holidays-fr', granularity: 'day', timezone: 'Europe/Paris', values: ['holiday'] },
  ]);
});

test('every template passes the validator of the core once its inputs are substituted', () => {
  for (const entry of templates) {
    const tariff = engine.substituteInputs(entry.tariff, defaults(entry));
    assert.doesNotThrow(() => engine.validateTariff(tariff), entry.key);
    // The manifest validation of the core uses the first option of a select.
    const sample = Object.fromEntries(
      entry.inputs.map((input) => [
        input.key,
        input.default ?? (input.type === 'select' ? input.options[0] : 1),
      ]),
    );
    assert.doesNotThrow(() => engine.compileTariff(entry.tariff, sample), entry.key);
  }
});

test('the inputs follow the restricted grammar of the core', () => {
  for (const entry of templates) {
    assert.ok(entry.inputs.length <= 16);
    const keys = new Set();
    for (const input of entry.inputs) {
      assert.match(input.key, /^[a-z0-9_]{1,64}$/);
      assert.ok(!keys.has(input.key), `${entry.key}: duplicate input ${input.key}`);
      keys.add(input.key);
      assert.ok(['number', 'select', 'string', 'time_intervals'].includes(input.type));
      if (input.unit) {
        assert.ok(input.unit.length <= 16);
      }
      if (input.type === 'number') {
        assert.ok(Number.isFinite(input.default));
      }
      if (input.type === 'select') {
        assert.ok(input.options.includes(input.default));
      }
      for (const lang of Object.keys(input.label)) {
        assert.ok(input.label[lang].length <= 64, `${entry.key}.${input.key}.label.${lang}`);
        assert.ok(input.description[lang].length <= 256, `${entry.key}.${input.key}.description`);
      }
    }
    for (const lang of Object.keys(entry.name)) {
      assert.ok(entry.name[lang].length <= 64, `${entry.key}.name.${lang}`);
      assert.ok(entry.description[lang].length <= 512, `${entry.key}.description.${lang}`);
    }
  }
});

test('the defaults are the EDF grid of 15 September 2026 (6 kVA)', () => {
  const expected = {
    'edf-zen-weekend': [0.2285, 0.171],
    'edf-zen-weekend-off-peak': [0.2359, 0.1762],
    'edf-zen-weekend-plus': [0.2259, 0.1691],
    'edf-zen-weekend-plus-off-peak': [0.2314, 0.1731],
  };
  for (const entry of templates) {
    const values = defaults(entry);
    assert.deepEqual([values.peak_price, values.off_peak_price], expected[entry.key]);
    assert.equal(values.subscription, 15.86);
  }
  assert.deepEqual(defaults(template('edf-zen-weekend-off-peak')).off_peak_slots, [
    ['04:00', '08:00'],
    ['12:30', '16:30'],
  ]);
  assert.deepEqual(DEFAULT_OFF_PEAK_SLOTS, [
    ['04:00', '08:00'],
    ['12:30', '16:30'],
  ]);
  assert.deepEqual(template('edf-zen-weekend-plus').inputs[0].options, CHOSEN_DAYS);
  // The subscription grid by power is written out in the input description.
  const subscription = template('edf-zen-weekend').inputs.find((i) => i.key === 'subscription');
  assert.match(subscription.description.fr, /3 kVA 12,13 · 6 kVA 15,86 · 9 kVA 19,88/);
  assert.match(subscription.description.en, /36 kVA 53\.88/);
  const offPeak = template('edf-zen-weekend-off-peak').inputs.find((i) => i.key === 'subscription');
  assert.doesNotMatch(offPeak.description.fr, /3 kVA/, 'the off-peak option starts at 6 kVA');
});

test('off-peak option: Monday 13:00 off-peak, Monday 09:00 peak, Saturday 10:00 weekend', () => {
  // October 2026: Paris is UTC+2.
  assert.deepEqual(
    price('edf-zen-weekend-off-peak', [
      '2026-10-12T11:00:00Z', // Monday 13:00
      '2026-10-12T07:00:00Z', // Monday 09:00
      '2026-10-17T08:00:00Z', // Saturday 10:00
      '2026-10-12T02:00:00Z', // Monday 04:00, first off-peak half-hour
      '2026-10-12T05:30:00Z', // Monday 07:30, last one
      '2026-10-12T06:00:00Z', // Monday 08:00, peak again
      '2026-10-12T10:00:00Z', // Monday 12:00
      '2026-10-12T14:30:00Z', // Monday 16:30
      '2026-10-18T21:30:00Z', // Sunday 23:30
      '2026-10-18T22:00:00Z', // Monday 00:00
    ]),
    [
      { label: 'Heures creuses', energy: 0.1762 },
      { label: 'Heures pleines', energy: 0.2359 },
      { label: 'Week-end', energy: 0.1762 },
      { label: 'Heures creuses', energy: 0.1762 },
      { label: 'Heures creuses', energy: 0.1762 },
      { label: 'Heures pleines', energy: 0.2359 },
      { label: 'Heures pleines', energy: 0.2359 },
      { label: 'Heures pleines', energy: 0.2359 },
      { label: 'Week-end', energy: 0.1762 },
      { label: 'Heures pleines', energy: 0.2359 },
    ],
  );
});

test('1 May on a Tuesday at 10:00 is a holiday, the day after is not', () => {
  // 1 May 2029 is a Tuesday.
  assert.deepEqual(
    price('edf-zen-weekend-off-peak', ['2029-05-01T08:00:00Z', '2029-05-02T08:00:00Z']),
    [
      { label: 'Jour férié', energy: 0.1762 },
      { label: 'Heures pleines', energy: 0.2359 },
    ],
  );
  assert.deepEqual(price('edf-zen-weekend', ['2029-05-01T08:00:00Z', '2029-05-02T08:00:00Z']), [
    { label: 'Jour férié', energy: 0.171 },
    { label: 'Semaine', energy: 0.2285 },
  ]);
  // The holiday runs from local midnight to midnight.
  assert.deepEqual(
    price('edf-zen-weekend', [
      '2029-04-30T21:30:00Z', // 30 April 23:30
      '2029-04-30T22:00:00Z', // 1 May 00:00
      '2029-05-01T21:30:00Z', // 1 May 23:30
      '2029-05-01T22:00:00Z', // 2 May 00:00
    ]).map((cost) => cost.label),
    ['Semaine', 'Jour férié', 'Jour férié', 'Semaine'],
  );
});

test('without the holiday calendar a holiday is priced like any weekday, never left out', () => {
  assert.deepEqual(
    price('edf-zen-weekend-off-peak', ['2029-05-01T08:00:00Z'], { lookup: holidayLookup([]) }),
    [{ label: 'Heures pleines', energy: 0.2359 }],
  );
});

test('the regional holidays of Alsace-Moselle are not reduced (Good Friday, 26 December)', () => {
  // Good Friday 2027: 26 March; 26 December 2028 is a Tuesday.
  assert.deepEqual(
    price('edf-zen-weekend', ['2027-03-26T09:00:00Z', '2028-12-26T09:00:00Z']).map((c) => c.label),
    ['Semaine', 'Semaine'],
  );
});

test('daylight saving time: the off-peak hours follow the local clock', () => {
  // Spring: Sunday 29 March 2026, 02:00 → 03:00. Monday 30 March is UTC+2.
  assert.deepEqual(
    price('edf-zen-weekend-off-peak', [
      '2026-03-27T02:30:00Z', // Friday 03:30 (UTC+1): peak
      '2026-03-27T03:00:00Z', // Friday 04:00: off-peak
      '2026-03-29T00:30:00Z', // Sunday 01:30: weekend
      '2026-03-29T01:00:00Z', // Sunday 03:00 (just after the jump): weekend
      '2026-03-30T01:30:00Z', // Monday 03:30 (UTC+2): peak
      '2026-03-30T02:00:00Z', // Monday 04:00: off-peak
      '2026-03-30T10:30:00Z', // Monday 12:30: off-peak
    ]).map((cost) => cost.label),
    [
      'Heures pleines',
      'Heures creuses',
      'Week-end',
      'Week-end',
      'Heures pleines',
      'Heures creuses',
      'Heures creuses',
    ],
  );
  // Autumn: Sunday 25 October 2026, 03:00 → 02:00. Monday 26 October is UTC+1.
  assert.deepEqual(
    price('edf-zen-weekend-off-peak', [
      '2026-10-25T00:30:00Z', // Sunday 02:30, first time
      '2026-10-25T01:30:00Z', // Sunday 02:30, second time
      '2026-10-26T02:30:00Z', // Monday 03:30 (UTC+1): peak
      '2026-10-26T03:00:00Z', // Monday 04:00: off-peak
      '2026-10-26T07:00:00Z', // Monday 08:00: peak
    ]).map((cost) => cost.label),
    ['Week-end', 'Week-end', 'Heures pleines', 'Heures creuses', 'Heures pleines'],
  );
});

test('Plus option: the chosen weekday is reduced from midnight to midnight', () => {
  const instants = [
    '2026-10-12T08:00:00Z', // Monday 10:00
    '2026-10-13T08:00:00Z', // Tuesday 10:00
    '2026-10-14T08:00:00Z', // Wednesday 10:00
    '2026-10-16T08:00:00Z', // Friday 10:00
  ];
  assert.deepEqual(
    price('edf-zen-weekend-plus', instants).map((c) => c.label),
    ['Jour choisi', 'Semaine', 'Semaine', 'Semaine'],
  );
  assert.deepEqual(
    price('edf-zen-weekend-plus', instants, { inputs: { chosen_day: 'wed' } }).map((c) => [
      c.label,
      c.energy,
    ]),
    [
      ['Semaine', 0.2259],
      ['Semaine', 0.2259],
      ['Jour choisi', 0.1691],
      ['Semaine', 0.2259],
    ],
  );
  assert.deepEqual(
    price('edf-zen-weekend-plus-off-peak', [...instants, '2026-10-13T11:00:00Z'], {
      inputs: { chosen_day: 'fri' },
    }).map((c) => c.label),
    ['Heures pleines', 'Heures pleines', 'Heures pleines', 'Jour choisi', 'Heures creuses'],
  );
});

test('the off-peak hours the user enters replace the defaults, night slots included', () => {
  const night = { off_peak_slots: [['22:00', '06:00']] };
  assert.deepEqual(
    price(
      'edf-zen-weekend-off-peak',
      [
        '2026-10-12T19:30:00Z', // Monday 21:30
        '2026-10-12T20:00:00Z', // Monday 22:00
        '2026-10-13T03:30:00Z', // Tuesday 05:30
        '2026-10-13T04:00:00Z', // Tuesday 06:00
        '2026-10-13T11:00:00Z', // Tuesday 13:00
      ],
      { inputs: night },
    ).map((c) => c.label),
    ['Heures pleines', 'Heures creuses', 'Heures creuses', 'Heures pleines', 'Heures pleines'],
  );
});

test('the monthly subscription is a fixed component of the core', () => {
  for (const option of OPTIONS) {
    const entry = template(option.key);
    const compiled = engine.compileTariff(entry.tariff, {
      ...defaults(entry),
      subscription: 23.76,
    });
    const fixed = compiled.components.find((component) => component.kind === 'fixed');
    assert.deepEqual({ amount: fixed.amount, per: fixed.per }, { amount: 23.76, per: 'month' });
  }
});
