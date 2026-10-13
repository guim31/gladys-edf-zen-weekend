// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`). "Read the tariff period" gives the
// following actions of a scene what is in force now: a washing machine
// started only when at least two hours of off-peak are left, a notification
// telling until when the price is low. Keys are forever.
// -----------------------------------------------------------------------------

import { ACTION_TEXT, formatInstant } from './i18n.js';

export const SCENE_ACTIONS = {
  get_tariff_period(service) {
    const language = service.config?.language ?? 'fr';
    const snapshot = service.snapshot(language);
    if (!snapshot) {
      // Throwing fails this action only; the scene goes on.
      throw new Error(ACTION_TEXT[language].noContract);
    }
    const { schedule, now, period, offPeak, label, price, next, minutesLeft } = snapshot;
    return {
      off_peak: offPeak,
      period,
      period_label: label,
      price,
      minutes_until_change: minutesLeft,
      next_change: next ? formatInstant(next.at, now, schedule.timeZone, language) : null,
    };
  },
};
