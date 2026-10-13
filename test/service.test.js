// -----------------------------------------------------------------------------
// The whole integration against the SDK's fake Gladys: the holiday calendar it
// feeds, the scene events at the minute the period changes, the widget and the
// scene action, from the contracts Gladys serves.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { contractOf, createMemoryStore, createWorld } from './helpers/world.js';
import { WIDGET_KEY } from '../src/service.js';

const calendarPosts = (world) => world.gladys.fake.bodies('POST', '/energy/calendar');
const events = (world) => world.gladys.fake.sceneEvents;

test('the start publishes the holidays from last year up to six days ahead', async () => {
  // Monday 12 October 2026.
  const world = await createWorld();
  const posts = calendarPosts(world);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].calendar_key, 'holidays-fr');
  const dates = posts[0].entries.map((entry) => entry.date);
  assert.equal(dates[0], '2025-01-01');
  assert.equal(dates.at(-1), '2026-08-15');
  assert.equal(dates.length, 19);
  assert.ok(posts[0].entries.every((entry) => entry.value === 'holiday'));
  assert.equal(world.service.calendar.status, 'ok');
  assert.deepEqual(world.store.files.get('state.json').published_holidays, dates);
});

test('each holiday goes out once, about a week ahead', async () => {
  const world = await createWorld();
  await world.service.sync();
  assert.equal(calendarPosts(world).length, 1, 'nothing new, nothing sent');

  world.clock.set('2026-10-26T08:00:00Z');
  await world.service.sync();
  const posts = calendarPosts(world);
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[1].entries, [{ date: '2026-11-01', value: 'holiday' }]);

  world.clock.set('2026-11-05T08:00:00Z');
  await world.service.sync();
  assert.deepEqual(calendarPosts(world)[2].entries, [{ date: '2026-11-11', value: 'holiday' }]);
});

test('a restart sends nothing again; a restored database gets the near holidays back', async () => {
  const first = await createWorld({ at: '2026-11-09T08:00:00Z' });
  const store = first.store;
  assert.equal(calendarPosts(first)[0].entries.at(-1).date, '2026-11-11');

  // Same /data, same Gladys: nothing to send.
  const again = await createWorld({
    at: '2026-11-09T09:00:00Z',
    store,
    calendar: first.gladys.fake.energyCalendars['holidays-fr'],
  });
  assert.equal(calendarPosts(again).length, 0);

  // Same /data, an empty calendar in Gladys (database restored): only the
  // holidays of the coming and past week are sent, not years of history that
  // would make the core recalculate every cost.
  const restored = await createWorld({ at: '2026-11-09T09:00:00Z', store, calendar: [] });
  assert.deepEqual(calendarPosts(restored)[0].entries, [{ date: '2026-11-11', value: 'holiday' }]);
});

test('an older contract extends the publication back to its start, five years at most', async () => {
  const world = await createWorld({
    contracts: [contractOf('edf-zen-weekend', { valid_from: '2023-03-01', status: 'expired' })],
  });
  assert.equal(calendarPosts(world)[0].entries[0].date, '2023-04-10');

  const old = await createWorld({
    contracts: [contractOf('edf-zen-weekend', { valid_from: '2015-01-01' })],
  });
  // 5 years back from 12 October 2026, two days of margin: 14 October 2021.
  assert.equal(calendarPosts(old)[0].entries[0].date, '2021-11-01');
});

test('a calendar owned by another integration is left to it (403)', async () => {
  const world = await createWorld({ calendar: null });
  assert.equal(calendarPosts(world).length, 0);
  assert.equal(world.service.calendar.status, 'refused');
  const ack = await world.gladys.fake.widgetGet(WIDGET_KEY, { language: 'fr' });
  const status = ack.data.content.components.find((component) => component.type === 'status');
  assert.deepEqual(status.items.at(-1).value, 'Fourni par une autre intégration');
});

test('off-peak hours start at 12:30 and end at 16:30 to the minute', async () => {
  // Monday 12 October 2026, 10:00 in Paris.
  const world = await createWorld();
  await world.runUntil('2026-10-12T10:29:00Z');
  assert.deepEqual(events(world), [], 'no event at the start nor before the change');

  await world.runUntil('2026-10-12T10:30:01Z');
  assert.deepEqual(events(world), [
    {
      key: 'off_peak_started',
      data: {
        period: 'off_peak_hours',
        period_label: 'Heures creuses',
        price: 0.1762,
        minutes_until_change: 240,
        next_change: '16:30',
      },
    },
  ]);

  await world.runUntil('2026-10-12T14:31:00Z');
  assert.deepEqual(events(world)[1], {
    key: 'off_peak_ended',
    data: {
      price: 0.2359,
      minutes_until_change: 690,
      next_change: 'mar. 04:00',
      next_period: 'off_peak_hours',
      next_period_label: 'Heures creuses',
    },
  });
  assert.ok(world.gladys.fake.widgetRefreshes.includes(WIDGET_KEY));
});

test('the weekend starts on Saturday 00:00; Monday brings the peak, then the off-peak hours', async () => {
  // Friday 16 October 2026, 23:00 in Paris.
  const world = await createWorld({ at: '2026-10-16T21:00:00Z' });
  await world.runUntil('2026-10-16T22:01:00Z');
  assert.deepEqual(events(world)[0], {
    key: 'off_peak_started',
    data: {
      period: 'weekend',
      period_label: 'Week-end',
      price: 0.1762,
      minutes_until_change: 2880,
      next_change: 'lun. 00:00',
    },
  });
  await world.runUntil('2026-10-19T02:01:00Z');
  assert.deepEqual(
    events(world).map((event) => [event.key, event.data.period ?? event.data.next_period]),
    [
      ['off_peak_started', 'weekend'],
      ['off_peak_ended', 'off_peak_hours'],
      ['off_peak_started', 'off_peak_hours'],
    ],
  );
});

test('night off-peak hours run on into Monday morning: no event at midnight', async () => {
  const world = await createWorld({
    at: '2026-10-18T20:00:00Z',
    contracts: [
      contractOf('edf-zen-weekend-off-peak', { inputs: { off_peak_slots: [['22:00', '06:00']] } }),
    ],
  });
  await world.runUntil('2026-10-19T04:01:00Z');
  assert.deepEqual(
    events(world).map((event) => event.key),
    ['off_peak_ended'],
  );
  assert.equal(events(world)[0].data.next_change, '22:00');
});

test('a change noticed more than 15 minutes late fires nothing', async () => {
  const world = await createWorld({ at: '2026-10-12T10:20:00Z' });
  world.clock.set('2026-10-12T11:00:00Z');
  await world.service.tick();
  assert.deepEqual(events(world), []);
  // The next change is fired again normally.
  await world.runUntil('2026-10-12T14:31:00Z');
  assert.deepEqual(
    events(world).map((event) => event.key),
    ['off_peak_ended'],
  );
});

test('the texts sent to scenes follow the configured language', async () => {
  const world = await createWorld({ at: '2026-10-12T10:29:00Z', config: { language: 'de' } });
  await world.runUntil('2026-10-12T10:31:00Z');
  assert.equal(events(world)[0].data.period_label, 'Nebenzeit');
  await world.gladys.fake.configUpdated({ language: 'es' });
  await world.runUntil('2026-10-12T14:31:00Z');
  assert.equal(events(world)[1].data.next_period_label, 'Horas valle');
  assert.equal(events(world)[1].data.next_change, 'mar 04:00');
});

test('contracts: identical schedules fire once, other templates and closed contracts are ignored', async () => {
  const world = await createWorld({
    at: '2026-10-12T10:29:00Z',
    contracts: [
      contractOf('edf-zen-weekend-off-peak', { id: 'a' }),
      contractOf('edf-zen-weekend-off-peak', { id: 'b', inputs: { peak_price: 0.3 } }),
      contractOf('edf-zen-weekend-off-peak', {
        id: 'c',
        status: 'expired',
        inputs: { off_peak_slots: [['11:00', '13:00']] },
      }),
      { ...contractOf('edf-zen-weekend'), template_key: 'edf-tempo', id: 'd' },
    ],
  });
  await world.runUntil('2026-10-12T10:31:00Z');
  assert.equal(events(world).length, 1);

  world.gladys.fake.energyContracts.push(
    contractOf('edf-zen-weekend-off-peak', {
      id: 'e',
      valid_from: '2026-10-01',
      inputs: { off_peak_slots: [['12:00', '16:00']] },
    }),
  );
  await world.service.sync();
  // The latest contract is the one the widget and the scene action describe.
  assert.equal(world.service.primarySchedule().id, 'e');
  await world.runUntil('2026-10-12T14:01:00Z');
  assert.deepEqual(
    events(world).map((event) => event.key),
    ['off_peak_started', 'off_peak_ended'],
  );
});

test('the Week-End option: weekday price, reduced weekend, holiday and chosen day', async () => {
  const world = await createWorld({
    // Tuesday 10 November 2026, 23:59: 11 November is a holiday.
    at: '2026-11-10T22:58:00Z',
    contracts: [contractOf('edf-zen-weekend-plus', { inputs: { chosen_day: 'fri' } })],
  });
  await world.runUntil('2026-11-10T23:01:00Z');
  assert.deepEqual(events(world)[0].data, {
    period: 'holiday',
    period_label: 'Jour férié',
    price: 0.1691,
    minutes_until_change: 1440,
    next_change: 'jeu. 00:00',
  });
  await world.runUntil('2026-11-11T23:01:00Z');
  assert.equal(events(world)[1].key, 'off_peak_ended');
  assert.equal(events(world)[1].data.next_period_label, 'Jour choisi');
  assert.equal(events(world)[1].data.price, 0.2259);
});

test('the widget, in the four languages, within the content budget', async () => {
  const world = await createWorld({ at: '2026-10-12T11:00:00Z' });
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await world.gladys.fake.widgetGet(WIDGET_KEY, { language });
    assert.equal(ack.success, true);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], language);
  }
  const { content } = (await world.gladys.fake.widgetGet(WIDGET_KEY, { language: 'fr' })).data;
  const [caption, now, price, left, status] = content.components;
  assert.equal(caption.text, 'EDF Zen Week-End (option Heures Creuses + WE)');
  assert.equal(now.value, 'Creuses');
  assert.equal(price.value, 0.1762);
  assert.equal(left.value, '3 h 30 min');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value]),
    [
      ['Prochain changement', '16:30 · Heures pleines'],
      ["Heures creuses aujourd'hui", '04:00–08:00, 12:30–16:30'],
      ['Heures creuses demain', '04:00–08:00, 12:30–16:30'],
      ['Prochain jour férié', 'dim. 1 nov. · Toussaint'],
    ],
  );
  // Pulled again right after the change.
  assert.equal(content.ttl_seconds, 3600);

  world.clock.set('2026-10-16T12:00:00Z');
  const friday = (await world.gladys.fake.widgetGet(WIDGET_KEY, { language: 'en' })).data.content;
  assert.deepEqual(friday.components.at(-1).items[2], {
    label: 'Off-peak tomorrow',
    value: 'All day (weekend)',
    icon: 'sunrise',
  });
});

test('the widget without any contract tells how to create one', async () => {
  const world = await createWorld({ contracts: [] });
  const { content } = (await world.gladys.fake.widgetGet(WIDGET_KEY, { language: 'en' })).data;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.match(content.components[0].text, /Energy Monitoring → Contracts/);
  assert.equal(calendarPosts(world).length, 1, 'the holidays are fed anyway');
});

test('the scene action reads the period in force', async () => {
  const world = await createWorld({ at: '2026-10-12T11:00:00Z' });
  const ack = await world.gladys.fake.sceneAction('get_tariff_period', {});
  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.outputs, {
    off_peak: true,
    period: 'off_peak_hours',
    period_label: 'Heures creuses',
    price: 0.1762,
    minutes_until_change: 210,
    next_change: '16:30',
  });

  const none = await createWorld({ contracts: [] });
  const failed = await none.gladys.fake.sceneAction('get_tariff_period', {});
  assert.equal(failed.success, false);
  assert.equal(failed.error, 'Aucun contrat EDF Zen Week-End actif dans Gladys');
});

test('a failed read of the contracts keeps the known ones', async () => {
  const world = await createWorld({ at: '2026-10-12T10:29:00Z' });
  world.gladys.getEnergyContracts = async () => {
    throw new Error('Gladys unreachable');
  };
  await world.service.sync();
  assert.equal(world.service.schedules.length, 1);
  await world.runUntil('2026-10-12T10:31:00Z');
  assert.equal(events(world).length, 1);
});

test('the timers are armed on the next change and cleared on stop', async (t) => {
  t.mock.timers.enable({
    apis: ['setTimeout', 'setInterval', 'Date'],
    now: Date.parse('2026-10-12T10:29:00Z'),
  });
  const { createFakeGladys } = await import('@gladysassistant/integration-sdk/testing');
  const { registerHandlers } = await import('../src/app.js');
  const gladys = createFakeGladys({
    config: { language: 'fr' },
    energyContracts: [contractOf('edf-zen-weekend-off-peak')],
    energyCalendars: { 'holidays-fr': [] },
  });
  const app = registerHandlers(gladys, { store: createMemoryStore(), now: () => Date.now() });
  await gladys.connect();
  assert.deepEqual(gladys.fake.sceneEvents, []);
  t.mock.timers.tick(61_000);
  // Let the tick run its awaits.
  await app.service.queue;
  await new Promise((resolve) => setImmediate(resolve));
  await app.service.queue;
  assert.equal(gladys.fake.sceneEvents.length, 1);
  assert.equal(gladys.fake.sceneEvents[0].key, 'off_peak_started');
  app.stop();
  assert.equal(app.service.tickTimer, null);
});
