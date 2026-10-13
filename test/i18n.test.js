// -----------------------------------------------------------------------------
// Every text Gladys shows exists in the four languages of its interface
// (English, French, German, Spanish): the manifest, the message tables of the
// code and the four documentation files. German says "du", never the polite
// "Sie"; Spanish says "usted".
// -----------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import {
  ACTION_TEXT,
  HOLIDAY_NAMES,
  PERIOD_SHORT,
  PERIOD_TEXT,
  WIDGET_TEXT,
  formatDate,
  formatDuration,
  formatInstant,
} from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const LANGS = ['en', 'fr', 'de', 'es'];
const POLITE_GERMAN = /(?<!\p{L})(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?!\p{L})/u;

// Upper bounds, in characters: what the Gladys interface shows without cutting.
const MAX = {
  catalog: 100,
  widgetLabel: 30,
  label: 60,
  placeholder: 60,
  description: 300,
  message: 200,
  featureName: 40,
  tileValue: 12,
  tileLabel: 24,
  badge: 16,
  caption: 80,
  body: 300,
  detail: 2000,
  status: 40,
  templateName: 64,
  inputLabel: 64,
  inputDescription: 256,
  templateDescription: 512,
};

const sorted = (keys) => [...keys].sort();

/** Checks one multi-language object; returns its problems. */
function problems(value, path, max) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be a multi-language object`];
  }
  const found = [];
  if (JSON.stringify(sorted(Object.keys(value))) !== JSON.stringify(sorted(LANGS))) {
    found.push(`${path} has [${Object.keys(value)}], expected exactly [${LANGS}]`);
  }
  for (const [lang, text] of Object.entries(value)) {
    found.push(...textProblems(text, `${path}.${lang}`, lang, max));
  }
  return found;
}

function textProblems(text, path, lang, max) {
  if (typeof text !== 'string' || text.trim() === '') {
    return [`${path} is empty`];
  }
  const found = [];
  if (text.length > max) {
    found.push(`${path} has ${text.length} characters (${max} at most)`);
  }
  if (lang === 'de' && POLITE_GERMAN.test(text)) {
    found.push(`${path} uses the polite form: "${text}"`);
  }
  return found;
}

/** Every multi-language object of the manifest, with its length limit. */
function manifestTexts(root) {
  const texts = [];
  const walk = (value, path, key) => {
    // The rule labels of a tariff are plain strings by the grammar of the
    // core (one language: the French names of the bill, src/templates.js).
    if (key === 'tariff') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, key));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    const isText =
      ['label', 'description', 'placeholder'].includes(key) ||
      Object.keys(value).some((child) => LANGS.includes(child));
    if (isText) {
      const max =
        path === 'manifest.description' || /^manifest\.widgets\[\d+\]\.description$/.test(path)
          ? MAX.catalog
          : /^manifest\.widgets\[\d+\]\.label$/.test(path)
            ? MAX.widgetLabel
            : /\.inputs\[\d+\]\.label$/.test(path)
              ? MAX.inputLabel
              : /\.inputs\[\d+\]\.description$/.test(path)
                ? MAX.inputDescription
                : /^manifest\.energy_contracts\.templates\[\d+\]\.name$/.test(path)
                  ? MAX.templateName
                  : /^manifest\.energy_contracts\.templates\[\d+\]\.description$/.test(path)
                    ? MAX.templateDescription
                    : (MAX[key] ?? MAX.label);
      texts.push({ path, value, max });
      return;
    }
    for (const [child, item] of Object.entries(value)) {
      walk(item, `${path}.${child}`, child);
    }
  };
  walk(root, 'manifest', null);
  return texts;
}

// Tables written one language at a time: same keys everywhere, no empty text.
function tableProblems(table, name, maxOf, render = (value) => value) {
  const found = [];
  if (JSON.stringify(sorted(Object.keys(table))) !== JSON.stringify(sorted(LANGS))) {
    found.push(`${name} has [${Object.keys(table)}], expected exactly [${LANGS}]`);
  }
  for (const lang of LANGS) {
    const entries = table[lang] ?? {};
    if (
      JSON.stringify(sorted(Object.keys(entries))) !== JSON.stringify(sorted(Object.keys(table.en)))
    ) {
      found.push(`${name}.${lang} does not have the keys of ${name}.en`);
    }
    for (const [key, value] of Object.entries(entries)) {
      found.push(...textProblems(render(value, key), `${name}.${lang}.${key}`, lang, maxOf(key)));
    }
  }
  return found;
}

test('the configuration offers the four languages', () => {
  assert.deepEqual(LANGUAGES, LANGS);
});

test('every text of the manifest is in English, French, German and Spanish', () => {
  const texts = manifestTexts(manifest);
  assert.ok(texts.length >= 80, `only ${texts.length} texts found in the manifest`);
  const found = texts.flatMap(({ path, value, max }) => problems(value, path, max));
  assert.deepEqual(found, []);
});

test('the catalog description holds 10 characters at least in every language', () => {
  for (const lang of LANGS) {
    assert.ok(manifest.description[lang].length >= 10, `description.${lang} is too short`);
  }
});

test('the period names, holiday names and widget texts exist in every language', () => {
  assert.deepEqual(
    tableProblems(PERIOD_TEXT, 'PERIOD_TEXT', () => MAX.tileLabel),
    [],
  );
  assert.deepEqual(
    tableProblems(PERIOD_SHORT, 'PERIOD_SHORT', () => MAX.tileValue),
    [],
  );
  assert.deepEqual(
    tableProblems(HOLIDAY_NAMES, 'HOLIDAY_NAMES', () => MAX.tileLabel),
    [],
  );
  assert.deepEqual(
    tableProblems(ACTION_TEXT, 'ACTION_TEXT', () => MAX.message),
    [],
  );
  const widgetMax = (key) => (key === 'noContract' ? MAX.body : MAX.status);
  const render = (value) => (typeof value === 'function' ? value('Heures creuses') : value);
  assert.deepEqual(tableProblems(WIDGET_TEXT, 'WIDGET_TEXT', widgetMax, render), []);
});

test('the longest status values hold in a widget row (40 characters)', () => {
  const now = Date.parse('2026-10-12T10:00:00Z');
  const far = Date.parse('2026-10-25T10:00:00Z');
  for (const lang of LANGS) {
    for (const period of Object.values(PERIOD_TEXT[lang])) {
      const next = `${formatInstant(far, now, 'Europe/Paris', lang)} · ${period}`;
      assert.ok(next.length <= MAX.status, `${lang}: "${next}"`);
      const allDay = WIDGET_TEXT[lang].allDay(period);
      assert.ok(allDay.length <= MAX.status, `${lang}: "${allDay}"`);
    }
    for (const name of Object.values(HOLIDAY_NAMES[lang])) {
      const holiday = `${formatDate('2026-09-30', lang)} · ${name}`;
      assert.ok(holiday.length <= MAX.status, `${lang}: "${holiday}"`);
    }
    assert.ok(formatDuration(6 * 1440 + 23 * 60 + 59, lang).length <= MAX.tileValue);
    assert.ok(formatDuration(23 * 60 + 59, lang).length <= MAX.tileValue);
  }
});

test('the four documentation files exist, with the same sections', async () => {
  const docs = {};
  for (const lang of LANGS) {
    docs[lang] = await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8');
    assert.ok(docs[lang].length >= 300, `docs/${lang}.md is too short`);
  }
  const outline = (text) =>
    text
      .split('\n')
      .filter((line) => /^#{1,4} /.test(line))
      .map((line) => line.match(/^#+/)[0]);
  for (const lang of LANGS) {
    assert.deepEqual(outline(docs[lang]), outline(docs.en), `docs/${lang}.md sections`);
  }
  assert.ok(outline(docs.en).length >= 8);
  assert.doesNotMatch(docs.de, POLITE_GERMAN, 'docs/de.md uses the polite form');
  for (const lang of LANGS) {
    assert.match(
      docs[lang],
      /feedback|retours|Rückmeldungen|comentarios/i,
      `${lang}: hardware note`,
    );
  }
});

test('the guard catches a missing language, an empty text and the polite German form', () => {
  assert.equal(problems({ en: 'Light', fr: 'Éclairage', de: 'Licht' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'Light', fr: 'Éclairage', de: '', es: 'Luz' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a', es: 'a', it: 'a' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a'.repeat(61), es: 'a' }, 'x', 60).length, 1);
  for (const polite of [
    'Wählen Sie',
    'Ihr Gerät',
    'Ihre Zone',
    'mit Ihrem',
    'Ihren',
    'Ihrer',
    'Ihres',
  ]) {
    assert.equal(problems({ en: 'a', fr: 'a', de: polite, es: 'a' }, 'x', 60).length, 1, polite);
  }
  assert.deepEqual(
    problems({ en: 'a', fr: 'a', de: 'Siebenschläfer, ihre', es: 'a' }, 'x', 60),
    [],
  );
  const forgotten = structuredClone(manifest);
  delete forgotten.energy_contracts.templates[0].inputs[0].label.de;
  const found = manifestTexts(forgotten).flatMap(({ path, value, max }) =>
    problems(value, path, max),
  );
  assert.deepEqual(found, [
    'manifest.energy_contracts.templates[0].inputs[0].label has [en,fr,es], expected exactly [en,fr,de,es]',
  ]);
});
