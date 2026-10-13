// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// The `energy_contracts` field is checked in test/templates.test.js.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { OFF_PEAK_PERIODS, PERIODS } from '../src/schedule.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { TRIGGERS, WIDGET_KEY } from '../src/service.js';
import { WIDGETS } from '../src/widgets.js';
import { contractOf, createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const registered = await createWorld({ connect: false });
const handlerKeys = (prefix) =>
  Object.keys(registered.gladys.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (key) => manifest.config_schema.find((entry) => entry.key === key);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

test('identity: name, type, image, cover, transports, category', () => {
  assert.equal(manifest.name, 'EDF Zen Week-End');
  // No device: the contract templates, the holiday calendar, the scene
  // triggers and the widget are capabilities.
  assert.equal(manifest.type, 'provider');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-edf-zen-weekend:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-edf-zen-weekend/main/cover.png',
  );
  // Everything is computed in the container and in Gladys: no network call.
  assert.deepEqual(manifest.transports, ['local']);
  assert.deepEqual(manifest.categories, ['energy']);
});

test('energy_contracts is in Gladys 5.2.0 and later only', () => {
  assert.deepEqual(minGladysVersion(), [5, 2, 0]);
});

test('the manifest stays well under the 100 KB the store indexer reads', async () => {
  const bytes = (await readFile(new URL('../gladys-assistant-integration.json', import.meta.url)))
    .length;
  assert.ok(bytes < 80 * 1024, `${bytes} bytes`);
});

test('no configuration action, no device handler: nothing to discover', () => {
  assert.equal(manifest.actions, undefined);
  assert.deepEqual(handlerKeys('action:'), []);
});

test('every scene action has a handler, and returns the declared outputs', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_actions), Object.keys(SCENE_ACTIONS));
  assert.deepEqual(handlerKeys('sceneAction:'), Object.keys(SCENE_ACTIONS));
  const world = await createWorld({ at: '2026-10-12T11:00:00Z' });
  t.after(() => world.app.stop());
  for (const action of manifest.scene_actions) {
    const ack = await world.gladys.fake.sceneAction(action.key, {});
    assert.equal(ack.success, true);
    assert.deepEqual(Object.keys(ack.data.outputs).sort(), keysOf(action.outputs).sort());
    for (const output of action.outputs) {
      assert.equal(typeof ack.data.outputs[output.key], output.type, output.key);
    }
  }
});

test('the scene triggers fired are the declared ones, with their filters and variables', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(TRIGGERS).sort());
  const world = await createWorld({ at: '2026-10-12T10:29:00Z' });
  t.after(() => world.app.stop());
  await world.runUntil('2026-10-12T14:31:00Z');
  const fired = new Map(world.gladys.fake.sceneEvents.map((event) => [event.key, event.data]));
  assert.deepEqual([...fired.keys()].sort(), Object.values(TRIGGERS).sort());
  for (const trigger of manifest.scene_triggers) {
    const data = fired.get(trigger.key);
    for (const key of [...keysOf(trigger.fields), ...keysOf(trigger.variables)]) {
      assert.ok(key in data, `${trigger.key}: "${key}" is in the event data`);
    }
    for (const variable of trigger.variables) {
      assert.equal(typeof data[variable.key], variable.type, `${trigger.key}.${variable.key}`);
    }
    assert.deepEqual(
      Object.keys(data).sort(),
      keysOf(trigger.variables)
        .concat(keysOf(trigger.fields))
        .filter((k, i, a) => a.indexOf(k) === i)
        .sort(),
    );
  }
  // The period filter offers exactly the reduced periods the code fires.
  const [period] = manifest.scene_triggers.find((t) => t.key === TRIGGERS.STARTED).fields;
  assert.deepEqual(
    period.options.map((option) => option.value).sort(),
    [...OFF_PEAK_PERIODS].sort(),
  );
  assert.ok(OFF_PEAK_PERIODS.every((key) => PERIODS.includes(key)));
});

test('the outputs of the scene action are the same type when the period is peak', async (t) => {
  const world = await createWorld({
    at: '2026-10-13T08:00:00Z',
    contracts: [contractOf('edf-zen-weekend')],
  });
  t.after(() => world.app.stop());
  const ack = await world.gladys.fake.sceneAction('get_tariff_period', {});
  assert.equal(ack.data.outputs.off_peak, false);
  assert.equal(ack.data.outputs.period, 'peak');
  assert.equal(ack.data.outputs.period_label, 'Tarif semaine');
});

test('every widget has a handler', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
});

test('config_schema defaults and options stay consistent with the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[entry.key], entry.default, `DEFAULT_CONFIG.${entry.key}`);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  assert.deepEqual(
    field('language').options.map((option) => option.value),
    LANGUAGES,
  );
});

test('section fields are purely presentational', () => {
  const sections = manifest.config_schema.filter((entry) => entry.type === 'section');
  assert.ok(sections.length > 0);
  for (const section of sections) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('no secret field anywhere: nothing here is secret', () => {
  assert.ok(allFields.every((entry) => entry.type !== 'secret'));
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
