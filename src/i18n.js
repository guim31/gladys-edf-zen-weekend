// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface (German says "du", Spanish "usted"). The widget is localized from
// the language Gladys sends; the scene events and actions, which receive none,
// from the `language` field of the configuration.
// -----------------------------------------------------------------------------

import { localParts } from './time.js';

export const PERIOD_TEXT = {
  en: {
    holiday: 'Public holiday',
    weekend: 'Weekend',
    chosen_day: 'Chosen day',
    off_peak_hours: 'Off-peak hours',
    peak: 'Peak hours',
    weekday: 'Weekday price',
  },
  fr: {
    holiday: 'Jour férié',
    weekend: 'Week-end',
    chosen_day: 'Jour choisi',
    off_peak_hours: 'Heures creuses',
    peak: 'Heures pleines',
    weekday: 'Tarif semaine',
  },
  de: {
    holiday: 'Feiertag',
    weekend: 'Wochenende',
    chosen_day: 'Gewählter Tag',
    off_peak_hours: 'Nebenzeit',
    peak: 'Hauptzeit',
    weekday: 'Werktagspreis',
  },
  es: {
    holiday: 'Festivo',
    weekend: 'Fin de semana',
    chosen_day: 'Día elegido',
    off_peak_hours: 'Horas valle',
    peak: 'Horas punta',
    weekday: 'Precio entre semana',
  },
};

// The widget tile shows 12 characters at most.
export const PERIOD_SHORT = {
  en: {
    holiday: 'Holiday',
    weekend: 'Weekend',
    chosen_day: 'Chosen day',
    off_peak_hours: 'Off-peak',
    peak: 'Peak',
    weekday: 'Weekday',
  },
  fr: {
    holiday: 'Férié',
    weekend: 'Week-end',
    chosen_day: 'Jour choisi',
    off_peak_hours: 'Creuses',
    peak: 'Pleines',
    weekday: 'Semaine',
  },
  de: {
    holiday: 'Feiertag',
    weekend: 'Wochenende',
    chosen_day: 'Wahltag',
    off_peak_hours: 'Nebenzeit',
    peak: 'Hauptzeit',
    weekday: 'Werktag',
  },
  es: {
    holiday: 'Festivo',
    weekend: 'Fin semana',
    chosen_day: 'Día elegido',
    off_peak_hours: 'Valle',
    peak: 'Punta',
    weekday: 'Laborable',
  },
};

export const HOLIDAY_NAMES = {
  en: {
    new_year: "New Year's Day",
    easter_monday: 'Easter Monday',
    labour_day: 'Labour Day',
    victory_1945: 'Victory Day 1945',
    ascension: 'Ascension Day',
    whit_monday: 'Whit Monday',
    national_day: 'Bastille Day',
    assumption: 'Assumption Day',
    all_saints: "All Saints' Day",
    armistice: 'Armistice Day',
    christmas: 'Christmas Day',
  },
  fr: {
    new_year: "Jour de l'an",
    easter_monday: 'Lundi de Pâques',
    labour_day: 'Fête du Travail',
    victory_1945: 'Victoire 1945',
    ascension: 'Ascension',
    whit_monday: 'Lundi de Pentecôte',
    national_day: 'Fête nationale',
    assumption: 'Assomption',
    all_saints: 'Toussaint',
    armistice: 'Armistice 1918',
    christmas: 'Noël',
  },
  de: {
    new_year: 'Neujahr',
    easter_monday: 'Ostermontag',
    labour_day: 'Tag der Arbeit',
    victory_1945: 'Kriegsende 1945',
    ascension: 'Christi Himmelfahrt',
    whit_monday: 'Pfingstmontag',
    national_day: 'Nationalfeiertag',
    assumption: 'Mariä Himmelfahrt',
    all_saints: 'Allerheiligen',
    armistice: 'Waffenstillstand 1918',
    christmas: 'Weihnachten',
  },
  es: {
    new_year: 'Año Nuevo',
    easter_monday: 'Lunes de Pascua',
    labour_day: 'Día del Trabajo',
    victory_1945: 'Victoria de 1945',
    ascension: 'Ascensión',
    whit_monday: 'Lunes de Pentecostés',
    national_day: 'Fiesta nacional',
    assumption: 'Asunción',
    all_saints: 'Todos los Santos',
    armistice: 'Armisticio de 1918',
    christmas: 'Navidad',
  },
};

export const WIDGET_TEXT = {
  en: {
    now: 'Now',
    price: 'Current price',
    left: 'Until the change',
    nextChange: 'Next change',
    today: 'Off-peak today',
    tomorrow: 'Off-peak tomorrow',
    nextHoliday: 'Next public holiday',
    calendar: 'Holiday calendar',
    allDay: (period) => `All day (${period.toLowerCase()})`,
    none: 'None',
    unknown: 'Unknown',
    neverChanges: 'No change ahead',
    refused: 'Fed by another integration',
    failed: 'Not sent: see the logs',
    noContract:
      'No EDF Zen Week-End contract yet. In Gladys, open Integrations → Energy Monitoring → Contracts, and create a contract from an EDF Zen Week-End template.',
  },
  fr: {
    now: 'Maintenant',
    price: 'Prix actuel',
    left: 'Avant le changement',
    nextChange: 'Prochain changement',
    today: "Heures creuses aujourd'hui",
    tomorrow: 'Heures creuses demain',
    nextHoliday: 'Prochain jour férié',
    calendar: 'Calendrier des fériés',
    allDay: (period) => `Toute la journée (${period.toLowerCase()})`,
    none: 'Aucune',
    unknown: 'Inconnu',
    neverChanges: 'Aucun changement prévu',
    refused: 'Fourni par une autre intégration',
    failed: 'Non transmis : voir les journaux',
    noContract:
      "Pas encore de contrat EDF Zen Week-End. Dans Gladys, ouvrez Intégrations → Suivi de l'énergie → Contrats, et créez un contrat à partir d'un modèle EDF Zen Week-End.",
  },
  de: {
    now: 'Jetzt',
    price: 'Aktueller Preis',
    left: 'Bis zum Wechsel',
    nextChange: 'Nächster Wechsel',
    today: 'Nebenzeit heute',
    tomorrow: 'Nebenzeit morgen',
    nextHoliday: 'Nächster Feiertag',
    calendar: 'Feiertagskalender',
    allDay: (period) => `Ganztägig (${period})`,
    none: 'Keine',
    unknown: 'Unbekannt',
    neverChanges: 'Kein Wechsel in Sicht',
    refused: 'Von einer anderen Integration',
    failed: 'Nicht gesendet: siehe Logs',
    noContract:
      'Noch kein EDF-Zen-Week-End-Vertrag. Öffne in Gladys Integrationen → Energieüberwachung → Verträge und lege einen Vertrag aus einer EDF-Zen-Week-End-Vorlage an.',
  },
  es: {
    now: 'Ahora',
    price: 'Precio actual',
    left: 'Hasta el cambio',
    nextChange: 'Próximo cambio',
    today: 'Horas valle hoy',
    tomorrow: 'Horas valle mañana',
    nextHoliday: 'Próximo festivo',
    calendar: 'Calendario de festivos',
    allDay: (period) => `Todo el día (${period.toLowerCase()})`,
    none: 'Ninguna',
    unknown: 'Desconocido',
    neverChanges: 'Ningún cambio previsto',
    refused: 'Lo provee otra integración',
    failed: 'No enviado: vea los registros',
    noContract:
      'Todavía no hay contrato EDF Zen Week-End. En Gladys, abra Integraciones → Supervisión de energía → Contratos y cree un contrato a partir de una plantilla EDF Zen Week-End.',
  },
};

export const ACTION_TEXT = {
  en: { noContract: 'No active EDF Zen Week-End contract in Gladys' },
  fr: { noContract: 'Aucun contrat EDF Zen Week-End actif dans Gladys' },
  de: { noContract: 'Kein aktiver EDF-Zen-Week-End-Vertrag in Gladys' },
  es: { noContract: 'Ningún contrato EDF Zen Week-End activo en Gladys' },
};

/** The label of a period, "Weekday price" for the peak of an option without off-peak hours. */
export function periodLabel(period, schedule, language, table = PERIOD_TEXT) {
  const key = period === 'peak' && !schedule.option.off_peak_hours ? 'weekday' : period;
  return table[language][key];
}

/** "2 h 15 min", "3 d 4 h", "45 min". */
export function formatDuration(minutes, language) {
  const units = {
    en: ['d', 'h', 'min'],
    fr: ['j', 'h', 'min'],
    de: ['T', 'h', 'min'],
    es: ['d', 'h', 'min'],
  }[language];
  const total = Math.max(0, Math.round(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const rest = total % 60;
  if (days > 0) {
    return hours > 0 ? `${days} ${units[0]} ${hours} ${units[1]}` : `${days} ${units[0]}`;
  }
  if (hours > 0) {
    return rest > 0 ? `${hours} ${units[1]} ${rest} ${units[2]}` : `${hours} ${units[1]}`;
  }
  return `${rest} ${units[2]}`;
}

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "16:30" today, "Mon 04:00" within the week, "Mon 12 Oct 04:00" beyond. */
export function formatInstant(ms, now, timeZone, language) {
  const locale = LOCALES[language];
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms));
  const sameDay = localParts(ms, timeZone).date === localParts(now, timeZone).date;
  if (sameDay) {
    return time;
  }
  const withinWeek = ms - now < 6 * 86_400_000;
  const day = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    ...(withinWeek ? {} : { day: 'numeric', month: 'short' }),
  }).format(new Date(ms));
  return `${day} ${time}`;
}

/** "Tue 11 Nov" of a local date. */
export function formatDate(date, language) {
  return new Intl.DateTimeFormat(LOCALES[language], {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00Z`));
}
