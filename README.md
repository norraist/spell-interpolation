# Spell Interpolation

A Foundry VTT v14 module for the dnd5e system and midi-qol.

Spell Interpolation adds custom damage types and applies interpolated resistance, immunity, and vulnerability handling before midi-qol applies damage.

## Credits

This module implements a spell interpolation ruleset created by Gorilla of Destiny.

Website: https://www.gorillaofdestiny.com/

Video explanation: https://youtu.be/A01-46iNFgw?si=QPNCay82aSNycgtL

This Foundry VTT module implementation is not affiliated with or endorsed by Gorilla of Destiny unless otherwise stated.
However, you should 100% check out his stuff! 

## Requirements

- Foundry VTT v14 (verified on 14.370)
- dnd5e 5.3.3 or newer (verified on 6.1.1)
- midi-qol 14.0.7 or newer (verified on 14.7.0)

## Current damage types

- Tarnish
- Frost
- Spark
- Wither
- Corrosive
- Alkaline
- Hydraulic
- Venom
- Spiritual
- Stress
- Tempest
- Void
- Ice
- Storm
- Vitriol
- Synaptic
  * This is reskined from the original Psionic. I did this to avoid potential confusion with systems that might already reference Psionic skills or damage.  
- Divine
- Righteous


   

## Installation

Use this manifest URL:

```text
https://github.com/norraist/spell-interpolation/releases/latest/download/module.json
```

## AI Usage
AI was used to assist in writing and debugging this code. 


## Damage defenses

Specific custom-type traits replace inherited parent-type interpolation. All Damage resistance, immunity and vulnerability still apply; a defense is not counted twice. Percentage interpolation rounds damage down once, allowing for floating-point noise at integer boundaries.

## Tests

Run `node --test tests/interpolation.test.cjs`. The suite covers All Damage traits, parent/global combinations, direct custom-type overrides, percentage rounding, mixed damage, temporary HP, saves and duplicate hook delivery. Live validation on Foundry 14.370 / dnd5e 6.1.1 / Midi-QOL 14.7.0 passed 26 checks across 25 workflows and 400 target applications. Conditional bypass and absorption interactions were not exhaustively tested.
