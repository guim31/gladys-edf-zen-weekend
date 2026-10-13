// -----------------------------------------------------------------------------
// The device rules of the Gladys core (category/type pairs of
// test/fixtures/gladys-feature-table.json, polling, min/max, units…) apply to
// the devices an integration publishes. This one is a `provider`: it publishes
// none, its whole contract is the energy contract templates, the holiday
// calendar, the scene triggers and actions, and the widget. This test fails the
// day a device appears, so that the full rules test of gladys-wled is brought
// in with it.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

test('a provider integration: no device published, no device handler', async (t) => {
  assert.equal(manifest.type, 'provider');
  const world = await createWorld({ at: '2026-10-12T10:29:00Z' });
  t.after(() => world.app.stop());
  await world.runUntil('2026-10-12T10:31:00Z');
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
  assert.deepEqual(world.gladys.fake.states, []);
  const deviceHandlers = Object.keys(world.gladys.handlers).filter((key) =>
    /^(setValue|poll|scanRequest|deviceCreated|getImage)/.test(key),
  );
  assert.deepEqual(deviceHandlers, []);
});
