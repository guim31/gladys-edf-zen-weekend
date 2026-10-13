# EDF Zen Week-End for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) 5.2.0 or later that prices the
French **EDF Zen Week-End** and **Zen Week-End Plus** electricity contracts right:

- **four contract templates** in the energy contract wizard of Gladys (Energy Monitoring → Contracts): the
  Week-End and Off-peak hours + weekend options of Zen Week-End, and the two options of Zen Week-End Plus
  (weekend + a chosen weekday), pre-filled with the official EDF price grid of 15 September 2026 and
  priced by the rule engine of Gladys itself;
- the **French national public holidays**, reduced like the weekend, computed offline and published to the
  `holidays-fr` tariff calendar of Gladys;
- your **Enedis off-peak hours**, editable in the contract (default 04:00-08:00 and 12:30-16:30);
- **scene triggers** "Off-peak hours start" and "Off-peak hours end" at the exact minute, a **scene
  action** "Read the EDF tariff period", and an **"Off-peak hours" dashboard widget**.

No account, no API key, no network access, no device: a `provider` integration.

> Developed and tested with its automated test suite and the pricing engine of Gladys 5.2.0, without a real
> Gladys instance nor an EDF bill to compare: feedback welcome.

## Why an integration

Gladys 5.2 can already express weekends and off-peak hours in a custom contract, but it ships no public
holiday calendar on purpose (the holiday calendars are left to integrations and to the community catalogue,
whose v2 is not published yet), and the community catalogue has no Zen Week-End contract. This integration
provides both, plus the scene triggers at the minute (the core "Electricity price changed" trigger runs
every 30 minutes and also fires on a mere change of period name).

## Requirements

- Gladys Assistant 5.2.0 or later.
- An electric meter in Gladys with its 30-minute consumption (Energy Monitoring integration).

## Installation

1. In Gladys: **Integrations → Install from GitHub**, address
   `https://github.com/guim31/gladys-edf-zen-weekend`.
2. **Integrations → Energy Monitoring → Contracts**: create a contract from an **EDF Zen Week-End**
   template, check its off-peak hours, prices and subscription against your bill.

The full documentation is in [`docs/en.md`](docs/en.md) (also in [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md)).

## Updating the prices

The price grid lives in a dated file, [`src/tariffs/edf-2026-09-15.json`](src/tariffs/edf-2026-09-15.json),
copied from the EDF PDF grids (linked in the file). For a new grid: add a file named after its date, point
`TARIFF` in `src/templates.js` to it, run `npm run templates` (it rewrites the `energy_contracts` field of
the manifest), then `npm test`. The template `version` follows the date of the grid; Gladys offers the
users to update their contract from it, never silently.

## Limits

- The Flex option of Zen Week-End (EDF "sobriety days") is not supported.
- The prices are those for new subscriptions on 15 September 2026; the self-producer surcharge is not
  included.
- The names of the periods shown by the core price widget stay in French (one language per tariff in the
  Gladys grammar).

## Development

```bash
npm install
npm test               # node --test, against the SDK's fake Gladys and the vendored Gladys pricing engine
npm run lint
npm run format:check
npm run templates      # regenerate the manifest energy_contracts field
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

`test/vendor/gladys-5.2.0/` holds an unmodified copy of the pricing engine of Gladys 5.2.0
(`server/lib/energy-contract/`, Apache 2.0), used by the tests only.

## Credits

- [Gladys Assistant](https://github.com/GladysAssistant/Gladys) (Apache 2.0): the energy contract engine,
  the integration SDK and template.
- [date-holidays](https://github.com/commenthol/date-holidays) (ISC, data CC-BY-3.0), used by the tests to check the
  holiday computation.
- Prices: EDF price grids "Zen Week-End" and "Zen Week-End Plus" (particulier.edf.fr).
- Cover: drawn for this integration, no EDF logo (the integration is not an EDF product).

Not affiliated with EDF nor Enedis. "EDF" and "Zen Week-End" are trademarks of their respective owners.

## License

[Apache 2.0](LICENSE).
