// -----------------------------------------------------------------------------
// The contract templates the integration offers in the energy contract wizard
// of Gladys, and the public holiday calendar they read. The manifest field
// `energy_contracts` is GENERATED from this file and the dated price grid of
// src/tariffs/ (`npm run templates`); test/templates.test.js fails when the two
// drift apart. A new EDF price grid is a new file in src/tariffs/ and a new
// TARIFF import below: the template `version` follows its date.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

/** The price grid in force, as published by EDF (dated file). */
export const TARIFF = JSON.parse(
  readFileSync(new URL('./tariffs/edf-2026-09-15.json', import.meta.url), 'utf8'),
);

export const TIMEZONE = 'Europe/Paris';

/**
 * The French national public holidays. `holidays-fr` is the key convention of
 * the Gladys energy contracts spec (`holidays-<country>`): another template
 * can read it, and another integration declaring it first would own it.
 */
export const HOLIDAY_CALENDAR = {
  key: 'holidays-fr',
  granularity: 'day',
  timezone: TIMEZONE,
  values: ['holiday'],
};
export const HOLIDAY_VALUE = 'holiday';

/**
 * Revision of the template structure, appended to the price grid date in the
 * template `version`. 2: off-peak hours by season (1.1.0).
 */
export const TEMPLATE_REVISION = 2;

/**
 * The two seasons of the Enedis off-peak hours reform (2025-2027): each home
 * gets one set of slots from 1 November to 31 March and another from 1 April
 * to 31 October. Inclusive bounds, like the `season` condition of the core;
 * winter crosses 1 January. Input keys are stored in the users' contracts:
 * never rename one.
 */
export const SEASONS = [
  { key: 'winter', input: 'off_peak_slots_winter', from: '11-01', to: '03-31' },
  { key: 'summer', input: 'off_peak_slots_summer', from: '04-01', to: '10-31' },
];

/**
 * The single input of the templates before 1.1.0, same hours all year round.
 * The contracts created with it keep their stored tariff in the core; the
 * container still reads it (src/schedule.js).
 */
export const LEGACY_OFF_PEAK_INPUT = 'off_peak_slots';

export const CHOSEN_DAYS = ['mon', 'wed', 'fri'];

// Rule labels: the core shows them as they are (current price widget, price
// changed trigger), in one language only. The contract is French, so are its
// period names on the bill.
export const RULE_LABELS = {
  holiday: 'Jour férié',
  weekend: 'Week-end',
  chosen_day: 'Jour choisi',
  off_peak_hours: 'Heures creuses',
  peak: 'Heures pleines',
  weekday: 'Semaine',
};

/**
 * The four options of the two offers. Template keys are stored in the users'
 * contracts: never rename one. `off_peak_hours`: the option adds the Enedis
 * off-peak hours on the other days; `chosen_day`: the Plus offer adds one
 * weekday (Monday, Wednesday or Friday) priced like the weekend.
 */
export const OPTIONS = [
  {
    key: 'edf-zen-weekend',
    tariff: 'zen-weekend',
    off_peak_hours: false,
    chosen_day: false,
    name: {
      en: 'EDF Zen Week-End (Week-End option)',
      fr: 'EDF Zen Week-End (option Week-End)',
      de: 'EDF Zen Week-End (Option Week-End)',
      es: 'EDF Zen Week-End (opción Week-End)',
    },
    description: {
      en: 'Reduced price all weekend and on national public holidays, one price on the other days.',
      fr: 'Prix réduit tout le week-end et les jours fériés nationaux, un seul prix les autres jours.',
      de: 'Günstigerer Preis am ganzen Wochenende und an landesweiten Feiertagen, ein Preis an den übrigen Tagen.',
      es: 'Precio reducido todo el fin de semana y los festivos nacionales, un único precio los demás días.',
    },
  },
  {
    key: 'edf-zen-weekend-off-peak',
    tariff: 'zen-weekend-off-peak',
    off_peak_hours: true,
    chosen_day: false,
    name: {
      en: 'EDF Zen Week-End (Off-peak hours + weekend)',
      fr: 'EDF Zen Week-End (option Heures Creuses + WE)',
      de: 'EDF Zen Week-End (Nebenzeiten + Wochenende)',
      es: 'EDF Zen Week-End (horas valle + fin de semana)',
    },
    description: {
      en: 'Off-peak price all weekend, on national public holidays and during your Enedis off-peak hours on the other days.',
      fr: 'Prix heures creuses tout le week-end, les jours fériés nationaux et pendant vos heures creuses Enedis les autres jours.',
      de: 'Nebenzeitpreis am ganzen Wochenende, an landesweiten Feiertagen und an den übrigen Tagen während deiner Enedis-Nebenzeiten.',
      es: 'Precio de horas valle todo el fin de semana, los festivos nacionales y durante sus horas valle Enedis los demás días.',
    },
  },
  {
    key: 'edf-zen-weekend-plus',
    tariff: 'zen-weekend-plus',
    off_peak_hours: false,
    chosen_day: true,
    name: {
      en: 'EDF Zen Week-End Plus (weekend + chosen day)',
      fr: 'EDF Zen Week-End Plus (option WE + jour choisi)',
      de: 'EDF Zen Week-End Plus (Wochenende + gewählter Tag)',
      es: 'EDF Zen Week-End Plus (fin de semana + día elegido)',
    },
    description: {
      en: 'Reduced price all weekend, on national public holidays and on the weekday you chose (Monday, Wednesday or Friday).',
      fr: 'Prix réduit tout le week-end, les jours fériés nationaux et le jour de semaine choisi (lundi, mercredi ou vendredi).',
      de: 'Günstigerer Preis am ganzen Wochenende, an landesweiten Feiertagen und an deinem gewählten Wochentag (Montag, Mittwoch oder Freitag).',
      es: 'Precio reducido todo el fin de semana, los festivos nacionales y el día laborable elegido (lunes, miércoles o viernes).',
    },
  },
  {
    key: 'edf-zen-weekend-plus-off-peak',
    tariff: 'zen-weekend-plus-off-peak',
    off_peak_hours: true,
    chosen_day: true,
    name: {
      en: 'EDF Zen Week-End Plus (off-peak + weekend + day)',
      fr: 'EDF Zen Week-End Plus (option HC + WE + jour choisi)',
      de: 'EDF Zen Week-End Plus (Nebenzeiten + WE + Tag)',
      es: 'EDF Zen Week-End Plus (horas valle + FDS + día)',
    },
    description: {
      en: 'Off-peak price all weekend, on national public holidays, on the weekday you chose and during your Enedis off-peak hours.',
      fr: 'Prix heures creuses tout le week-end, les jours fériés nationaux, le jour choisi et pendant vos heures creuses Enedis.',
      de: 'Nebenzeitpreis am ganzen Wochenende, an landesweiten Feiertagen, an deinem gewählten Tag und während deiner Enedis-Nebenzeiten.',
      es: 'Precio de horas valle todo el fin de semana, los festivos nacionales, el día elegido y durante sus horas valle Enedis.',
    },
  },
];

export const TEMPLATE_KEYS = OPTIONS.map((option) => option.key);

export function findOption(templateKey) {
  return OPTIONS.find((option) => option.key === templateKey);
}

/** "3 kVA 12.13 · 6 kVA 15.86 · …", the subscription grid of an option. */
function subscriptionGrid(option, decimal) {
  const { powers } = TARIFF.options[option.tariff];
  return powers
    .map((power) => {
      const amount = TARIFF.subscription_per_month[String(power)].toFixed(2);
      return `${power} kVA ${decimal === ',' ? amount.replace('.', ',') : amount}`;
    })
    .join(' · ');
}

function inputsOf(option) {
  const prices = TARIFF.options[option.tariff];
  const inputs = [];
  if (option.chosen_day) {
    inputs.push({
      key: 'chosen_day',
      type: 'select',
      label: {
        en: 'Chosen day (mon, wed or fri)',
        fr: 'Jour choisi (mon = lundi, wed = mercredi, fri = vendredi)',
        de: 'Gewählter Tag (mon = Montag, wed = Mittwoch, fri = Freitag)',
        es: 'Día elegido (mon = lunes, wed = miércoles, fri = viernes)',
      },
      description: {
        en: 'The weekday of your contract priced like the weekend, from midnight to midnight.',
        fr: 'Le jour de semaine de votre contrat facturé comme le week-end, de minuit à minuit.',
        de: 'Der Wochentag deines Vertrags, der wie das Wochenende abgerechnet wird, von Mitternacht bis Mitternacht.',
        es: 'El día laborable de su contrato facturado como el fin de semana, de medianoche a medianoche.',
      },
      options: CHOSEN_DAYS,
      default: CHOSEN_DAYS[0],
      required: true,
    });
  }
  if (option.off_peak_hours) {
    // No default on purpose: the 1.0 default (04:00-08:00, 12:30-16:30) left
    // users with off-peak hours that were not theirs. The wizard starts with
    // an empty grid, and the core refuses a contract with an empty one.
    inputs.push(
      {
        key: SEASONS[0].input,
        type: 'time_intervals',
        label: {
          en: 'Enedis off-peak hours, November to March',
          fr: 'Heures creuses Enedis, novembre à mars',
          de: 'Enedis-Nebenzeiten, November bis März',
          es: 'Horas valle Enedis, de noviembre a marzo',
        },
        description: {
          en: 'Weekdays, 1 Nov to 31 Mar. On your bill, your Enedis account or the letter of the off-peak hours reform. No seasonal hours yet: same hours in both fields. Half-hour grid: round up (01:22 → 01:30), Gladys bills by half-hour.',
          fr: 'En semaine, du 1/11 au 31/03. Voir votre facture, votre compte Enedis ou le courrier de la réforme. Sans heures saisonnières, mêmes heures dans les deux champs. Grille par demi-heure : arrondir à la suivante (01:22 → 01:30), Gladys facture par demi-heure.',
          de: 'Werktags, 1.11. bis 31.3. Siehe Rechnung, Enedis-Konto oder Schreiben zur Nebenzeitreform. Noch keine saisonalen Zeiten: gleiche Zeiten in beiden Feldern. Halbstundenraster: aufrunden (01:22 → 01:30), Gladys rechnet halbstündlich ab.',
          es: 'Entre semana, del 1/11 al 31/3. En su factura, su cuenta Enedis o la carta de la reforma. Sin horas estacionales: mismas horas en ambos campos. Medias horas: redondee hacia arriba (01:22 → 01:30), Gladys factura por media hora.',
        },
        required: true,
      },
      {
        key: SEASONS[1].input,
        type: 'time_intervals',
        label: {
          en: 'Enedis off-peak hours, April to October',
          fr: 'Heures creuses Enedis, avril à octobre',
          de: 'Enedis-Nebenzeiten, April bis Oktober',
          es: 'Horas valle Enedis, de abril a octubre',
        },
        description: {
          en: 'Weekdays, 1 Apr to 31 Oct. Same sources and same rounding as the November to March hours; the same hours if your home has not switched to seasonal off-peak hours yet.',
          fr: 'En semaine, du 1/04 au 31/10. Mêmes sources et même arrondi que pour novembre à mars ; les mêmes heures si votre logement n’est pas encore passé aux heures creuses saisonnières.',
          de: 'Werktags, 1.4. bis 31.10. Gleiche Quellen und gleiche Rundung wie für November bis März; dieselben Zeiten, wenn deine Wohnung noch keine saisonalen Nebenzeiten hat.',
          es: 'Entre semana, del 1/4 al 31/10. Mismas fuentes y mismo redondeo que de noviembre a marzo; las mismas horas si su vivienda aún no tiene horas valle estacionales.',
        },
        required: true,
      },
    );
  }
  inputs.push(
    {
      key: 'peak_price',
      type: 'number',
      unit: 'EUR/kWh',
      label: option.off_peak_hours
        ? {
            en: 'Peak hours price',
            fr: 'Prix heures pleines',
            de: 'Preis Hauptzeit',
            es: 'Precio horas punta',
          }
        : {
            en: 'Weekday price',
            fr: 'Prix en semaine',
            de: 'Preis werktags',
            es: 'Precio entre semana',
          },
      description: {
        en: `EDF price including taxes from ${TARIFF.applicable_from}. Correct it if your bill shows another one.`,
        fr: `Prix EDF TTC au ${TARIFF.applicable_from}. Corrigez-le si votre facture en indique un autre.`,
        de: `EDF-Bruttopreis ab ${TARIFF.applicable_from}. Korrigiere ihn, wenn deine Rechnung einen anderen zeigt.`,
        es: `Precio EDF con impuestos desde el ${TARIFF.applicable_from}. Corríjalo si su factura indica otro.`,
      },
      default: prices.peak_price,
      required: true,
    },
    {
      key: 'off_peak_price',
      type: 'number',
      unit: 'EUR/kWh',
      label: option.off_peak_hours
        ? {
            en: 'Off-peak, weekend and holiday price',
            fr: 'Prix heures creuses, week-end et fériés',
            de: 'Preis Nebenzeit, Wochenende und Feiertage',
            es: 'Precio horas valle, fin de semana y festivos',
          }
        : {
            en: 'Weekend and holiday price',
            fr: 'Prix week-end et jours fériés',
            de: 'Preis Wochenende und Feiertage',
            es: 'Precio fin de semana y festivos',
          },
      description: {
        en: `EDF price including taxes from ${TARIFF.applicable_from}, the same in every reduced period of the option.`,
        fr: `Prix EDF TTC au ${TARIFF.applicable_from}, le même pour toutes les périodes réduites de l'option.`,
        de: `EDF-Bruttopreis ab ${TARIFF.applicable_from}, gleich in allen günstigeren Zeiten der Option.`,
        es: `Precio EDF con impuestos desde el ${TARIFF.applicable_from}, el mismo en todos los periodos reducidos de la opción.`,
      },
      default: prices.off_peak_price,
      required: true,
    },
    {
      key: 'subscription',
      type: 'number',
      unit: 'EUR/month',
      label: {
        en: 'Monthly subscription (by subscribed power)',
        fr: 'Abonnement mensuel (selon la puissance)',
        de: 'Monatliche Grundgebühr (nach Anschlussleistung)',
        es: 'Abono mensual (según la potencia contratada)',
      },
      description: {
        en: `Pre-filled for 6 kVA. EDF grid in EUR/month including taxes: ${subscriptionGrid(option, '.')}.`,
        fr: `Pré-rempli pour 6 kVA. Grille EDF en €/mois TTC : ${subscriptionGrid(option, ',')}.`,
        de: `Vorbelegt für 6 kVA. EDF-Tabelle in €/Monat brutto: ${subscriptionGrid(option, ',')}.`,
        es: `Prerrellenado para 6 kVA. Tabla EDF en €/mes con impuestos: ${subscriptionGrid(option, ',')}.`,
      },
      default: TARIFF.subscription_per_month['6'],
      required: true,
    },
  );
  return inputs;
}

function tariffOf(option) {
  const reduced = (label, when) => ({ label, when, price: '{{input:off_peak_price}}' });
  const rules = [
    reduced(RULE_LABELS.holiday, { calendar: { [HOLIDAY_CALENDAR.key]: HOLIDAY_VALUE } }),
    reduced(RULE_LABELS.weekend, { weekdays: ['sat', 'sun'] }),
  ];
  if (option.chosen_day) {
    rules.push(reduced(RULE_LABELS.chosen_day, { weekdays: ['{{input:chosen_day}}'] }));
  }
  if (option.off_peak_hours) {
    for (const season of SEASONS) {
      rules.push(
        reduced(RULE_LABELS.off_peak_hours, {
          season: { from: season.from, to: season.to },
          time: `{{input:${season.input}}}`,
        }),
      );
    }
  }
  return {
    tariff_version: 1,
    calendars: [HOLIDAY_CALENDAR.key],
    components: [
      {
        key: 'energy',
        kind: 'consumption',
        rules,
        fallback: {
          label: option.off_peak_hours ? RULE_LABELS.peak : RULE_LABELS.weekday,
          price: '{{input:peak_price}}',
        },
      },
      { key: 'subscription', kind: 'fixed', amount: '{{input:subscription}}', per: 'month' },
    ],
  };
}

/** The manifest `energy_contracts` field. */
export function buildEnergyContracts() {
  return {
    templates: OPTIONS.map((option) => ({
      key: option.key,
      name: option.name,
      description: option.description,
      country: 'FR',
      currency: TARIFF.currency,
      timezone: TIMEZONE,
      pricing_mode: 'rules',
      version: `${TARIFF.applicable_from}.${TEMPLATE_REVISION}`,
      calendars: [HOLIDAY_CALENDAR.key],
      inputs: inputsOf(option),
      tariff: tariffOf(option),
    })),
    calendars: [HOLIDAY_CALENDAR],
  };
}
