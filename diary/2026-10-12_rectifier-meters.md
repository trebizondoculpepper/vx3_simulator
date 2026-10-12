# Development Diary Entry - 2026-10-12

## Context

- **Date**: 2026-10-12 22:11 UTC
- **Branch**: main
- **Commit**: 8be99cf
- **Contributors**: creative lead agent with Salim Fadhley

## Problem Statement

The plant room's breaker enclosure was too close to the throw switch, leaving no rectifier instrumentation between them. The owner asked for historically suitable gauges.

## Our Approach

The [Powerhouse Collection's 1954 mercury-arc rectifier](https://collection.powerhouse.com.au/object/139225) has an ammeter and voltmeter on its cabinet alongside AC and DC power switches. A [period description of a General Electric rectifier panel](https://chestofbooks.com/crafts/popular-mechanics/Amateur-Work-6/Mercury-Arc-Rectifiers.html) likewise names a voltmeter and ammeter beside switches and a circuit breaker. We used those primary examples for the meter choices. Separating AC input voltage and DC output voltage into two dials is a reconstruction for this VX3 installation; the 240 V input, 180 V nominal output and 50 A scale are game values, not specifications from the historical examples.

## Implementation

The breaker enclosure moved farther right on the east wall. A grey instrument plate between it and the throw switch has three German-labelled moving-coil meters: NETZ V~, AUSGANG V= and LAST A=. Their needles respond to plant power and estimated VX3 load. The output voltage sags slightly as current rises; a small holding current appears when the arc is lit.

## Outcomes

The switch, three meters and breaker enclosure read as a clear left-to-right sequence in the local browser. Typecheck, lint, format check, 115 tests and production build passed.

## Next Steps

Replace the approximate meter values if a more detailed rectifier and transformer model is introduced.
