// -----------------------------------------------------------------------------
// The schedule the container computes (scene triggers, widget, scene action)
// says exactly what the pricing engine of Gladys bills: compared half-hour by
// half-hour over three years for every option, and the next change compared
// with the `valid_until` of the engine's current price.
// -----------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
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
  seasonOf,
} from '../src/schedule.js';
import { localParts, localToUtc } from '../src/time.js';
import { SAMPLE_SLOTS, allYear, seasonal, wizardInputs } from './helpers/inputs.js';

const { templates } = buildEnergyContracts();
// The templates of 1.0.1: the tariffs the contracts created with them store.
const legacy = JSON.parse(
  await readFile(new URL('./fixtures/energy-contracts-1.0.1.json', import.meta.url), 'utf8'),
).templates;
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

// The reform example: hours in force from 12 January 2027 for one home.
const REFORM_WINTER = [
  ['01:22', '06:52'],
  ['12:52', '15:22'],
];
const REFORM_SUMMER = [
  ['00:22', '05:22'],
  ['13:22', '16:22'],
];
const REFORM = seasonal(REFORM_WINTER, REFORM_SUMMER);

const VARIANTS = [
  {},
  allYear([['22:00', '06:00']]),
  seasonal(
    [['22:00', '06:00']],
    [
      ['01:30', '07:30'],
      ['13:00', '15:00'],
    ],
  ),
  { ...allYear([['23:00', '07:00']]), chosen_day: 'wed' },
  { chosen_day: 'fri' },
];

function contractOf(entry, inputs) {
  return {
    id: 'contract-1',
    template_key: entry.key,
    status: 'active',
    timezone: 'Europe/Paris',
    inputs: wizardInputs(entry, inputs),
  };
}

// The engine prices about 30 000 intervals a second: three years for the
// default inputs, the two daylight saving seasons and May (holidays) of 2026
// for the other inputs. The season changes (31 March, 31 October) fall in the
// second set.
const WINDOWS = {
  full: [['2025-12-31T23:00:00Z', '2028-12-31T23:00:00Z']],
  seasons: [
    ['2026-03-01T00:00:00Z', '2026-06-01T00:00:00Z'],
    ['2026-10-01T00:00:00Z', '2027-01-01T00:00:00Z'],
  ],
};

/** The instants where the engine and the schedule disagree (3 at most). */
function mismatches(tariff, contract, windows, stepMinutes) {
  const schedule = buildSchedule(contract);
  const compiled = engine.compileTariff(tariff, contract.inputs);
  const intervals = [];
  for (const [from, to] of windows) {
    for (let ms = Date.parse(from); ms < Date.parse(to); ms += stepMinutes * 60_000) {
      intervals.push({ starts_at: new Date(ms).toISOString(), kwh: 1 });
    }
  }
  const { costs } = engine.priceIntervals(compiled, contract, intervals, { calendars: lookup });
  assert.equal(costs.length, intervals.length);
  return costs
    .filter(
      (cost) => PERIOD_OF_LABEL[cost.label] !== periodAt(schedule, Date.parse(cost.starts_at)),
    )
    .slice(0, 3)
    .map(
      (cost) =>
        `${cost.starts_at}: engine ${cost.label}, schedule ${periodAt(schedule, Date.parse(cost.starts_at))}`,
    );
}

test('the period of every half-hour is the one the engine bills', () => {
  for (const entry of templates) {
    VARIANTS.forEach((variant, index) => {
      const contract = contractOf(entry, variant);
      const windows = index === 0 ? WINDOWS.full : WINDOWS.seasons;
      assert.deepEqual(
        mismatches(entry.tariff, contract, windows, 30),
        [],
        `${entry.key} ${JSON.stringify(variant)}`,
      );
    });
  }
});

test('seasonal hours on the minute (01:22, 06:52): the period of every minute is billed alike', () => {
  // A weekday on each side of both season changes: Tuesday 30 March 2027 to
  // Friday 2 April, Thursday 28 October 2027 to Tuesday 2 November (1 November
  // is a holiday, the weekend in between).
  const windows = [
    ['2027-03-29T22:00:00Z', '2027-04-02T22:00:00Z'],
    ['2027-10-27T22:00:00Z', '2027-11-02T23:00:00Z'],
  ];
  for (const key of ['edf-zen-weekend-off-peak', 'edf-zen-weekend-plus-off-peak']) {
    const entry = templates.find((t) => t.key === key);
    const contract = contractOf(entry, { ...REFORM, chosen_day: 'mon' });
    assert.deepEqual(mismatches(entry.tariff, contract, windows, 1), [], key);
  }
});

test('a contract created before 1.1.0 (one off_peak_slots input) keeps its schedule', () => {
  for (const entry of legacy) {
    for (const inputs of [{}, { off_peak_slots: [['22:00', '06:00']], chosen_day: 'wed' }]) {
      const contract = {
        id: 'contract-1',
        template_key: entry.key,
        status: 'active',
        timezone: 'Europe/Paris',
        inputs: {
          ...Object.fromEntries(entry.inputs.map((input) => [input.key, input.default])),
          ...inputs,
        },
      };
      assert.deepEqual(
        mismatches(entry.tariff, contract, WINDOWS.seasons, 30),
        [],
        `${entry.key} ${JSON.stringify(inputs)}`,
      );
    }
  }
  // The same events as with 1.0: the key of the events already fired is kept.
  const entry = templates.find((t) => t.key === 'edf-zen-weekend-off-peak');
  assert.equal(
    buildSchedule(contractOf(entry, { off_peak_slots: SAMPLE_SLOTS })).signature,
    buildSchedule(contractOf(entry, allYear(SAMPLE_SLOTS))).signature,
  );
  assert.equal(
    buildSchedule(contractOf(entry, { off_peak_slots: SAMPLE_SLOTS })).signature,
    '["Europe/Paris",null,[{"start":240,"end":480},{"start":750,"end":990}],true]',
  );
  assert.notEqual(
    buildSchedule(contractOf(entry, REFORM)).signature,
    buildSchedule(contractOf(entry, allYear(REFORM_WINTER))).signature,
  );
});

test('the season of a date, bounds included, like the engine', () => {
  assert.equal(seasonOf('2027-03-31'), 'winter');
  assert.equal(seasonOf('2027-04-01'), 'summer');
  assert.equal(seasonOf('2027-10-31'), 'summer');
  assert.equal(seasonOf('2027-11-01'), 'winter');
  assert.equal(seasonOf('2028-01-01'), 'winter');
  assert.equal(seasonOf('2028-02-29'), 'winter');
});

test('reform hours: the next change and the day slots follow the season', () => {
  const entry = templates.find((t) => t.key === 'edf-zen-weekend-off-peak');
  const schedule = buildSchedule(contractOf(entry, REFORM));
  // Wednesday 31 March 2027 16:00: winter peak, next off-peak at 00:22 on
  // Thursday 1 April, the first summer slot (not 01:22).
  assert.deepEqual(nextChange(schedule, Date.parse('2027-03-31T14:00:00Z')), {
    at: Date.parse('2027-03-31T22:22:00Z'),
    period: 'off_peak_hours',
  });
  assert.deepEqual(offPeakOfDay(schedule, '2027-03-31').slots, REFORM_WINTER);
  assert.deepEqual(offPeakOfDay(schedule, '2027-04-01').slots, REFORM_SUMMER);
  // Tuesday 12 January 2027 06:51 is off-peak, 06:52 is not.
  assert.equal(periodAt(schedule, Date.parse('2027-01-12T05:51:00Z')), 'off_peak_hours');
  assert.equal(periodAt(schedule, Date.parse('2027-01-12T05:52:00Z')), 'peak');
});

test('a contract with the seasonal inputs ignores a stray off_peak_slots', () => {
  const entry = templates.find((t) => t.key === 'edf-zen-weekend-off-peak');
  const schedule = buildSchedule(
    contractOf(entry, { ...REFORM, off_peak_slots: [['22:00', '06:00']] }),
  );
  assert.deepEqual(offPeakOfDay(schedule, '2027-01-12').slots, REFORM_WINTER);
  // A season left at the default 00:01-00:02: no off-peak hours, and said so.
  const half = buildSchedule(
    contractOf(entry, {
      ...seasonal([['22:00', '06:00']], [['00:01', '00:02']]),
    }),
  );
  assert.deepEqual(offPeakOfDay(half, '2027-06-15'), { whole: null, unset: true, slots: [] });
  assert.equal(periodAt(half, Date.parse('2027-06-14T22:01:30Z')), 'peak');
  assert.deepEqual(offPeakOfDay(half, '2027-01-12').unset, false);
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
  const schedule = buildSchedule(contractOf(entry, allYear([['00:00', '00:00']])));
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
  assert.deepEqual(schedule.seasons.winter.slots, [{ start: 720, end: 840 }]);
  assert.deepEqual(schedule.seasons.summer.slots, [{ start: 720, end: 840 }]);
  assert.equal(schedule.chosenDay, null);
  assert.equal(schedule.peakPrice, null);
  assert.equal(schedule.timeZone, 'Europe/Paris');
  // A text input the core would refuse anyway (1:22, 25:00) is left out.
  const typed = buildSchedule({
    id: 'y',
    template_key: entry.key,
    inputs: { ...allYear([['12:00', '14:00']]), off_peak_winter_2_start: '1:22' },
  });
  assert.deepEqual(typed.seasons.winter.slots, [{ start: 720, end: 840 }]);
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
  assert.deepEqual(offPeakOfDay(schedule, '2026-10-17'), {
    whole: 'weekend',
    unset: false,
    slots: [],
  });
  assert.deepEqual(offPeakOfDay(schedule, '2026-11-11'), {
    whole: 'holiday',
    unset: false,
    slots: [],
  });
  assert.deepEqual(offPeakOfDay(schedule, '2026-10-14'), {
    whole: 'chosen_day',
    unset: false,
    slots: [],
  });
  assert.deepEqual(offPeakOfDay(schedule, '2026-10-13'), {
    whole: null,
    unset: false,
    slots: SAMPLE_SLOTS,
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
