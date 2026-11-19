# 0.2.1 — 19 November 2026

- Respect All Damage resistance, immunity and vulnerability when recalculating custom damage, including neutral interpolation components. Preserve specific custom-type overrides of inherited traits and avoid counting a defense twice.
- Correct floating-point rounding at integer percentage boundaries. Venom, Vitriol and Synaptic now deal 33 instead of 32 in the affected base-100 immunity cases; genuine fractional damage still rounds down.
- Add regression tests and update the verified versions to Foundry 14.370, dnd5e 6.1.1 and Midi-QOL 14.7.0.

Validation: five local regression groups passed, including 3,840 comparisons with an independent percentage calculation. Dev live tests passed 26 checks across 25 actual Midi workflows / 400 target applications, with settings and world time restored and fixtures removed. Conditional bypass, absorption and redirection interactions were not exhaustively tested.
