# Gladys Assistant 5.2.0 pricing engine (test only)

Unmodified copy of `server/lib/energy-contract/` (the pure pricing engine: `engine.js` and the
`tariff.*.js`, `calendar.lookup.js` files it requires, plus `tariff.schema.json`) and of
`server/utils/coreErrors.js`, from the `v5.2.0` tag of
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys), Apache License 2.0, copyright the
Gladys Assistant authors.

The tests of this integration price its contract templates with it. It is not shipped in the Docker image
(`src/` only). To refresh it from a Gladys clone:

    git -C <gladys> show v5.2.0:server/lib/energy-contract/<file> > lib/energy-contract/<file>
