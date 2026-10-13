// Writes the manifest `energy_contracts` field from src/templates.js and the
// dated price grid of src/tariffs/. Run it after changing either:
//   npm run templates
// test/templates.test.js fails while the manifest is not up to date.

import { readFile, writeFile } from 'node:fs/promises';
import * as prettier from 'prettier';
import { buildEnergyContracts } from '../src/templates.js';

const path = new URL('../gladys-assistant-integration.json', import.meta.url);
const manifest = JSON.parse(await readFile(path, 'utf8'));
manifest.energy_contracts = buildEnergyContracts();
const options = { ...(await prettier.resolveConfig(path.pathname)), filepath: path.pathname };
await writeFile(path, await prettier.format(JSON.stringify(manifest, null, 2), options));
console.log(`energy_contracts: ${manifest.energy_contracts.templates.length} templates written`);
