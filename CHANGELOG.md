# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

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
