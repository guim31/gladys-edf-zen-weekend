// -----------------------------------------------------------------------------
// The configuration form of the manifest, made complete and valid. The prices
// and the off-peak hours are not here: they belong to the contract the user
// creates in Gladys (Energy Monitoring → Contracts), read through the host API.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Mirrors the manifest defaults (test/manifest.test.js).
export const DEFAULT_CONFIG = {
  language: 'fr',
};

export function normalizeConfig(raw = {}) {
  const language = LANGUAGES.includes(raw?.language) ? raw.language : DEFAULT_CONFIG.language;
  return { language };
}
