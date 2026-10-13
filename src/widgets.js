// -----------------------------------------------------------------------------
// The "Off-peak hours" dashboard widget. The core's own "Electricity price" widget
// already shows the current price and the next one; this one tells the day:
// off-peak or peak now and for how long, today's and tomorrow's off-peak
// hours, the next public holiday. Budget of the core: 3 tiles, 1 caption,
// 1 status list (8 components at most, 2 texts).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import {
  HOLIDAY_NAMES,
  PERIOD_SHORT,
  WIDGET_TEXT,
  formatDate,
  formatDuration,
  formatInstant,
  periodLabel,
} from './i18n.js';
import { LANGUAGES } from './config.js';
import { nextHoliday } from './holidays.js';
import { offPeakOfDay } from './schedule.js';
import { WIDGET_KEY } from './service.js';
import { addDays, localParts } from './time.js';

// The "until the change" tile counts down: pulled again every 5 minutes.
const MAX_TTL_SECONDS = 300;

function dayText(schedule, date, language) {
  const text = WIDGET_TEXT[language];
  const day = offPeakOfDay(schedule, date);
  if (day.whole) {
    return text.allDay(periodLabel(day.whole, schedule, language));
  }
  if (day.slots.length === 0) {
    return text.none;
  }
  return [...day.slots]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([from, to]) => `${from}–${to}`)
    .join(', ');
}

export function buildContent(service, language) {
  const text = WIDGET_TEXT[language];
  const snapshot = service.snapshot(language);
  if (!snapshot) {
    const scheduled = service.contracts
      .filter(
        (contract) => contract.status === 'scheduled' && typeof contract.valid_from === 'string',
      )
      .map((contract) => contract.valid_from)
      .sort()[0];
    return {
      ttl_seconds: 600,
      components: [
        {
          type: 'text',
          variant: 'body',
          text: scheduled ? text.scheduled(formatDate(scheduled, language)) : text.noContract,
        },
      ],
    };
  }
  const { schedule, now, period, offPeak, price, next, minutesLeft } = snapshot;
  const today = localParts(now, schedule.timeZone).date;
  const holiday = nextHoliday(today);

  const items = [
    {
      label: text.nextChange,
      value: next
        ? `${formatInstant(next.at, now, schedule.timeZone, language)} · ${periodLabel(next.period, schedule, language)}`
        : text.neverChanges,
      icon: 'clock',
      color: next && !offPeak ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    },
  ];
  if (schedule.option.off_peak_hours) {
    items.push(
      { label: text.today, value: dayText(schedule, today, language), icon: 'sun' },
      {
        label: text.tomorrow,
        value: dayText(schedule, addDays(today, 1), language),
        icon: 'sunrise',
      },
    );
  }
  items.push({
    label: text.nextHoliday,
    value: `${formatDate(holiday.date, language)} · ${HOLIDAY_NAMES[language][holiday.key]}`,
    icon: 'calendar',
  });
  if (service.calendar.status === 'refused' || service.calendar.status === 'failed') {
    items.push({
      label: text.calendar,
      value: service.calendar.status === 'refused' ? text.refused : text.failed,
      icon: 'alert-triangle',
      color: service.calendar.status === 'refused' ? WIDGET_COLORS.INFO : WIDGET_COLORS.WARNING,
    });
  }

  const components = [
    { type: 'text', variant: 'caption', text: schedule.option.name[language] },
    {
      type: 'value',
      label: text.now,
      value: periodLabel(period, schedule, language, PERIOD_SHORT),
      icon: offPeak ? 'moon' : 'zap',
      color: offPeak ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
    },
  ];
  if (price !== null) {
    components.push({
      type: 'value',
      label: text.price,
      value: price,
      unit: '€/kWh',
      icon: 'dollar-sign',
    });
  }
  components.push(
    {
      type: 'value',
      label: text.left,
      value: minutesLeft === null ? '—' : formatDuration(minutesLeft, language),
      icon: 'clock',
    },
    { type: 'status', items },
  );

  // Pulled again when the period changes (the service nudges it too).
  const ttl = next ? Math.ceil((next.at - now) / 1000) + 5 : MAX_TTL_SECONDS;
  return { ttl_seconds: Math.min(MAX_TTL_SECONDS, Math.max(60, ttl)), components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get(service, { language } = {}) {
      return buildContent(
        service,
        LANGUAGES.includes(language) ? language : (service.config?.language ?? 'fr'),
      );
    },
  },
};
