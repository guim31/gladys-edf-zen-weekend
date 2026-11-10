# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Changed

- Off-peak options: off-peak hours by season, winter (1 November to 31 March)
  and summer (1 April to 31 October), for the seasonal hours of the Enedis
  off-peak hours reform. A home not switched yet enters the same hours for
  both.
- Off-peak hours to the minute: each season has two slots typed as `HH:MM`
  (`01:22` to `06:52`) instead of the half-hour grid of the wizard.
- The off-peak hours are no longer pre-filled with 04:00-08:00 and
  12:30-16:30, but with `00:01`-`00:02`, which bills no off-peak hour; the
  widget shows "To set in the contract" until they are entered. The fields say
  where to read your hours (bill, Enedis account, letter of the reform).
- Contracts created before keep working unchanged, with the same hours all
  year round; the documentation explains how to move to seasonal hours.

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-13

### Added

- Four EDF contract templates in the energy contract wizard of Gladys (Gladys
  5.2.0 or later): Zen Week-End (Week-End option, and Off-peak hours + weekend
  option) and Zen Week-End Plus (weekend + chosen day, with or without the
  off-peak hours), pre-filled with the EDF price grid applicable from
  15 September 2026 and priced by Gladys itself.
- The French national public holidays, priced like the weekend, computed
  offline and published to the `holidays-fr` tariff calendar of Gladys about a
  week ahead.
- Your Enedis off-peak hours and the chosen day of the Plus offer, set in the
  contract (off-peak hours pre-filled with 04:00-08:00 and 12:30-16:30).
- Scene triggers "Off-peak hours start" and "Off-peak hours end", at the exact
  minute, with the period, the price and the time of the next change.
- Scene action "Read the EDF tariff period": reduced price or not, period,
  price, minutes until the next change.
- Dashboard widget "Off-peak hours": the period in force and until when, today's
  and tomorrow's off-peak hours, the next public holiday.
- Documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-edf-zen-weekend/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-edf-zen-weekend/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-edf-zen-weekend/releases/tag/v1.0.0
