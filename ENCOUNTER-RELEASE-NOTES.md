# Spell Interpolation 0.2.2

Fixes interpolated damage being reduced after a failed save. Midi's on-success damage rule is now applied only when the target actually saved, preserving per-damage save rules and Evasion-style behavior. Retains the global-defense and rounding fixes from 0.2.1.

Validation: six regression groups, including the existing 3,840-comparison matrix, all 18 blends, failed/successful saves and Evasion; native encounter spell casts in dnd5e 6.1.1 / Midi-QOL 14.7.0.
