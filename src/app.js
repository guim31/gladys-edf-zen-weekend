// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys
// in the tests) and returns the service, so index.js stays a few lines and the
// tests drive the very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { SCENE_ACTIONS } from './scenes.js';
import { TariffService } from './service.js';
import { createStore } from './store.js';
import { WIDGETS } from './widgets.js';

const logger = createLogger({ name: 'edf-zen-weekend-app' });

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: store, now, timers
 */
export function registerHandlers(gladys, options = {}) {
  const service = new TariffService({
    gladys,
    store: options.store ?? createStore(),
    now: options.now,
    timers: options.timers ?? true,
  });

  // Resolved once the service has started; every handler waits for it.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        service.reconfigure(config);
        await service.resync();
        return;
      }
      started = true;
      await service.start(config);
    } catch (err) {
      logger.error('Initialization failed', err);
    } finally {
      resolveReady();
    }
  });

  gladys.onConfigUpdated(whenReady((config) => service.reconfigure(normalizeConfig(config))));

  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(
      key,
      whenReady((fields) => handler(service, { fields })),
    );
  }

  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(
      key,
      whenReady((request) => widget.get(service, request)),
    );
  }

  return { service, ready, stop: () => service.stop() };
}
