// -----------------------------------------------------------------------------
// The inputs of a contract as the wizard saves them. The off-peak hours have no
// default since 1.1.0: the tests fill both seasons with SAMPLE_SLOTS. Inputs
// carrying the pre-1.1.0 `off_peak_slots` describe a contract created with the
// 1.0 templates, which has no seasonal input at all.
// -----------------------------------------------------------------------------

import { LEGACY_OFF_PEAK_INPUT, SEASONS } from '../../src/templates.js';

export const SAMPLE_SLOTS = [
  ['04:00', '08:00'],
  ['12:30', '16:30'],
];

/** The text inputs of one season's slots; a single slot is repeated, as the docs say. */
function seasonInputs(season, slots) {
  const filled = slots.length === 1 ? [slots[0], slots[0]] : slots;
  return Object.fromEntries(
    season.inputs.flatMap((pair, index) => pair.map((key, bound) => [key, filled[index][bound]])),
  );
}

/** Winter and summer slots ([["01:22", "06:52"], …], one or two each) as inputs. */
export const seasonal = (winter, summer) => ({
  ...seasonInputs(SEASONS[0], winter),
  ...seasonInputs(SEASONS[1], summer),
});

/** Both seasons with the same slots, a home not switched to seasonal hours. */
export const allYear = (slots) => seasonal(slots, slots);

export function wizardInputs(template, inputs = {}) {
  const slotKeys = new Set(SEASONS.flatMap((season) => season.inputs.flat()));
  const legacy = LEGACY_OFF_PEAK_INPUT in inputs;
  const values = {};
  for (const input of template.inputs) {
    if (input.default !== undefined && !slotKeys.has(input.key)) {
      values[input.key] = input.default;
    }
  }
  const offPeak = template.inputs.some((input) => slotKeys.has(input.key));
  return { ...values, ...(offPeak && !legacy ? allYear(SAMPLE_SLOTS) : {}), ...inputs };
}
