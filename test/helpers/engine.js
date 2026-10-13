// -----------------------------------------------------------------------------
// The pricing engine of the Gladys core, release 5.2.0, vendored in
// test/vendor/ (Apache-2.0, see its README): the tests price the templates of
// this integration with the very code Gladys runs, not with a re-implementation.
// -----------------------------------------------------------------------------

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const engine = require('../vendor/gladys-5.2.0/lib/energy-contract/engine.js');
export const tariffSchema = require('../vendor/gladys-5.2.0/lib/energy-contract/tariff.schema.json');
