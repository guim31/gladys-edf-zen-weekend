// -----------------------------------------------------------------------------
// The schedule the container computes (scene triggers, widget, scene action)
// says exactly what the pricing engine of Gladys bills: compared half-hour by
// half-hour over three years for every option, and the next change compared
// with the `valid_until` of the engine's current price.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './helpers/engine.js';
import { HOLIDAY_CALENDAR, buildEnergyContracts } from '../src/templates.js';
import { holidaysBetween } from '../src/holidays.js';
import {
  buildSchedule,
  compileSlots,
  isOffPeak,
  nextChange,
  offPeakOfDay,
  periodAt,
} from '../src/schedule.js';
import { localParts, localToUtc } from '../src/time.js';

const { templates } = buildEnergyContracts();
const defaults = (entry) =>
  Object.fromEntries(entry.inputs.map((input) => [input.key, input.default]));
const lookup = engine.createCalendarLookup(
  { [HOLIDAY_CALENDAR.key]: { granularity: 'day', timezone: 'Europe/Paris' } },
  holidaysBetween('2025-01-01', '2029-12-31').map(({ date }) => ({
    calendar_key: HOLIDAY_CALENDAR.key,
    date,
    value: 'holiday',
  })),
  'Europe/Paris',
);

// Rule label of the engine → period of the schedule.
const PERIOD_OF_LABEL = {
  'Jour férié': 'holiday',
  'Week-end': 'weekend',
  'Jour choisi': 'chosen_day',
  'Heures creuses': 'off_peak_hours',
  'Heures pleines': 'peak',
  Semaine: 'peak',
};

const VARIANTS = [
  {},
  { off_peak_slots: [['22:00', '06:00']] },
  {
    off_peak_slots: [
      ['01:30', '07:30'],
      ['13:00', '15:00'],
    ],
  },
  { off_peak_slots: [['23:00', '07:00']], chosen_day: 'wed' },
  { chosen_day: 'fri' },
];

function contractOf(entry, inputs) {
  return {
    id: 'contract-1',
    template_key: entry.key,
    status: 'active',
    timezone: 'Europe/Paris',
    inputs: { ...defaults(entry), ...inputs },
  };
}

// The engine prices about 30 000 intervals a second: three years for the
// default inputs, the two daylight saving seasons and May (holidays) of 2026
// for the other inputs.
const WINDOWS = {
  full: [['2025-12-31T23:00:00Z', '2028-12-31T23:00:00Z']],
  seasons: [
    ['2026-03-01T00:00:00Z', '2026-06-01T00:00:00Z'],
    ['2026-10-01T00:00:00Z', '2027-01-01T00:00:00Z'],
  ],
};

test('the period of every half-hour is the one the engine bills', () => {
  for (const entry of templates) {
    VARIANTS.forEach((variant, index) => {
      const contract = contractOf(entry, variant);
      const schedule = buildSchedule(contract);
      const compiled = engine.compileTariff(entry.tariff, contract.inputs);
      const intervals = [];
      for (const [from, to] of index === 0 ? WINDOWS.full : WINDOWS.seasons) {
        for (let ms = Date.parse(from); ms < Date.parse(to); ms += 30 * 60_000) {
          intervals.push({ starts_at: new Date(ms).toISOString(), kwh: 1 });
        }
      }
      const { costs } = engine.priceIntervals(compiled, contract, intervals, { calendars: lookup });
      assert.equal(costs.length, intervals.length);
      const mismatches = costs
        .filter(
          (cost) => PERIOD_OF_LABEL[cost.label] !== periodAt(schedule, Date.parse(cost.starts_at)),
        )
        .slice(0, 3)
        .map(
          (cost) =>
            `${cost.starts_at}: engine ${cost.label}, schedule ${periodAt(schedule, Date.parse(cost.starts_at))}`,
        );
      assert.deepEqual(mismatches, [], `${entry.key} ${JSON.stringify(variant)}`);
    });
  }
});

test('the next change is the valid_until of the price the engine shows', () => {
  const start = Date.parse('2026-01-01T00:07:00Z');
  for (const entry of templates) {
    for (const variant of VARIANTS.slice(0, 2)) {
      const contract = contractOf(entry, variant);
      const schedule = buildSchedule(contract);
      const compiled = engine.compileTariff(entry.tariff, contract.inputs);
      // Every 33 h 47 min over a year: all hours, all weekdays, both DST changes.
      for (let ms = start; ms < start + 365 * 86_400_000; ms += 2027 * 60_000) {
        const current = engine.getCurrentPrice(compiled, contract, {
          at: ms,
          calendars: lookup,
          horizon_hours: 8 * 24,
        });
        const next = nextChange(schedule, ms);
        // The engine stops at a label change with the same price (weekend →
        // Monday's off-peak hours): walk on to the price change.
        let until = current.valid_until ? Date.parse(current.valid_until) : null;
        let guard = 0;
        while (until !== null && guard < 20) {
          const after = engine.getCurrentPrice(compiled, contract, {
            at: until,
            calendars: lookup,
            horizon_hours: 8 * 24,
          });
          if (after.price !== current.price) {
            break;
          }
          until = after.valid_until ? Date.parse(after.valid_until) : null;
          guard += 1;
        }
        assert.equal(
          next ? new Date(next.at).toISOString() : null,
          until === null ? null : new Date(until).toISOString(),
          `${entry.key} ${JSON.stringify(variant)} at ${new Date(ms).toISOString()}`,
        );
      }
    }
  }
});

test('off-peak hours covering the whole day never change', () => {
  const entry = templates.find((t) => t.key === 'edf-zen-weekend-off-peak');
  const schedule = buildSchedule(contractOf(entry, { off_peak_slots: [['00:00', '00:00']] }));
  const ms = Date.parse('2026-10-13T10:00:00Z');
  assert.equal(periodAt(schedule, ms), 'off_peak_hours');
  assert.equal(nextChange(schedule, ms), null);
});

test('the Week-End option changes twice a week: Saturday 00:00 and Monday 00:00', () => {
  const entry = templates.find((t) => t.key === 'edf-zen-weekend');
  const schedule = buildSchedule(contractOf(entry, {}));
  const wednesday = Date.parse('2026-10-14T10:00:00Z');
  assert.equal(periodAt(schedule, wednesday), 'peak');
  assert.deepEqual(nextChange(schedule, wednesday), {
    at: Date.parse('2026-10-16T22:00:00Z'),
    period: 'weekend',
  });
  assert.deepEqual(nextChange(schedule, Date.parse('2026-10-17T10:00:00Z')), {
    at: Date.parse('2026-10-18T22:00:00Z'),
    period: 'peak',
  });
  // Christmas on a Friday 2026: the reduced price starts on Friday 00:00.
  assert.deepEqual(nextChange(schedule, Date.parse('2026-12-23T10:00:00Z')), {
    at: Date.parse('2026-12-24T23:00:00Z'),
    period: 'holiday',
  });
  assert.deepEqual(nextChange(schedule, Date.parse('2026-12-25T10:00:00Z')), {
    at: Date.parse('2026-12-27T23:00:00Z'),
    period: 'peak',
  });
});

test('a contract of another template has no schedule; broken inputs are ignored', () => {
  assert.equal(buildSchedule({ template_key: 'edf-tempo', inputs: {} }), null);
  assert.equal(buildSchedule(null), null);
  const entry = templates.find((t) => t.key === 'edf-zen-weekend-plus-off-peak');
  const schedule = buildSchedule({
    id: 'x',
    template_key: entry.key,
    inputs: {
      off_peak_slots: [['25:00', '06:00'], 'nope', ['12:00', '14:00']],
      chosen_day: 'sun',
      peak_price: 'cheap',
    },
  });
  assert.deepEqual(schedule.slots, [{ start: 720, end: 840 }]);
  assert.equal(schedule.chosenDay, null);
  assert.equal(schedule.peakPrice, null);
  assert.equal(schedule.timeZone, 'Europe/Paris');
});

test('the slots split at midnight like the engine', () => {
  assert.deepEqual(compileSlots([['22:00', '06:00']]), [
    { start: 1320, end: 1440 },
    { start: 0, end: 360 },
  ]);
  assert.deepEqual(compileSlots([['20:00', '24:00']]), [{ start: 1200, end: 1440 }]);
  assert.deepEqual(compileSlots([['22:00', '00:00']]), [{ start: 1320, end: 1440 }]);
});

test("a day's off-peak hours: whole reduced days and the slots of the others", () => {
  const entry = templates.find((t) => t.key === 'edf-zen-weekend-plus-off-peak');
  const schedule = buildSchedule(contractOf(entry, { chosen_day: 'wed' }));
  assert.deepEqual(offPeakOfDay(schedule, '2026-10-17'), { whole: 'weekend', slots: [] });
  assert.deepEqual(offPeakOfDay(schedule, '2026-11-11'), { whole: 'holiday', slots: [] });
  assert.deepEqual(offPeakOfDay(schedule, '2026-10-14'), { whole: 'chosen_day', slots: [] });
  assert.deepEqual(offPeakOfDay(schedule, '2026-10-13'), {
    whole: null,
    slots: [
      ['04:00', '08:00'],
      ['12:30', '16:30'],
    ],
  });
  assert.equal(isOffPeak('peak'), false);
  assert.equal(isOffPeak('weekend'), true);
});

test('local time arithmetic around the daylight saving changes', () => {
  assert.equal(localToUtc('2026-03-29', 120, 'Europe/Paris'), Date.parse('2026-03-29T01:00:00Z'));
  assert.equal(localToUtc('2026-03-29', 150, 'Europe/Paris'), Date.parse('2026-03-29T01:00:00Z'));
  assert.equal(localToUtc('2026-03-29', 180, 'Europe/Paris'), Date.parse('2026-03-29T01:00:00Z'));
  assert.equal(localToUtc('2026-10-25', 150, 'Europe/Paris'), Date.parse('2026-10-25T00:30:00Z'));
  assert.equal(localToUtc('2026-10-25', 180, 'Europe/Paris'), Date.parse('2026-10-25T02:00:00Z'));
  assert.equal(localToUtc('2026-07-01', 0, 'Europe/Paris'), Date.parse('2026-06-30T22:00:00Z'));
  assert.deepEqual(localParts(Date.parse('2026-10-25T01:30:00Z'), 'Europe/Paris'), {
    date: '2026-10-25',
    minutes: 150,
    weekday: 'sun',
  });
  assert.equal(localToUtc('2026-01-12', 0, 'America/New_York'), Date.parse('2026-01-12T05:00:00Z'));
  // Offsets of 12 hours and more: Auckland, 5 April 2026 (03:00 → 02:00) and
  // 27 September 2026 (02:00 → 03:00).
  assert.equal(
    localToUtc('2026-04-05', 150, 'Pacific/Auckland'),
    Date.parse('2026-04-04T13:30:00Z'),
  );
  assert.equal(
    localToUtc('2026-09-27', 150, 'Pacific/Auckland'),
    Date.parse('2026-09-26T14:00:00Z'),
  );
});
