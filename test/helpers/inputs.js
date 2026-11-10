// -----------------------------------------------------------------------------
// The inputs of a contract as the wizard saves them. The off-peak hours have no
// default since 1.1.0: the tests fill both seasons with SAMPLE_SLOTS. Inputs
// carrying the pre-1.1.0 `off_peak_slots` describe a contract created with the
// 1.0 templates, which has no seasonal input at all.
// -----------------------------------------------------------------------------

import { LEGACY_OFF_PEAK_INPUT } from '../../src/templates.js';

export const SAMPLE_SLOTS = [
  ['04:00', '08:00'],
  ['12:30', '16:30'],
];

/** Both seasons with the same slots, a home not switched to seasonal hours. */
export const allYear = (slots) => ({ off_peak_slots_winter: slots, off_peak_slots_summer: slots });

export function wizardInputs(template, inputs = {}) {
  const legacy = LEGACY_OFF_PEAK_INPUT in inputs;
  const values = {};
  for (const input of template.inputs) {
    if (input.default !== undefined) {
      values[input.key] = input.default;
    } else if (input.type === 'time_intervals' && !legacy) {
      values[input.key] = SAMPLE_SLOTS;
    }
  }
  return { ...values, ...inputs };
}
