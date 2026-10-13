# VX3 control graph

Every operator input in the running game, the machine state it sets, and the indicators that show it, as wired on 12 October 2026. Read each diagram left to right: what a person touches, what the machine does about it, and where you can see the result. Taken from the code in `src/game/rig.ts`, `rack-controls.ts`, `safety-telltales.ts` and `start-scene.ts`.

Since 13 October 2026 the rack, side cabinet and ferrocore drum are no longer in the lab: the first-generation rig is kept, unwired, as an archive in room dev3 (`src/scene/gen1-vx3.ts`), so its controls below no longer work anywhere, and the diagrams below record the first rig as it was wired. The bay now holds the second-generation VX3, the ferrocore column, whose ferrocore drive is this same drive model, worked from the column's panels as well as the east board, and interlocked by the vessel's atmosphere (`src/game/gen2-wiring.ts`); the diagrams below still hold for the drive, and the vessel's own graph is still to be drawn.

In each diagram, amber boxes are inputs set by an operator, green circles are machine state and blue boxes are indicators driven by that state.

## Power and drive

The path that gets the ferrocore drum turning. The plant-room master supply must be on before the mains will close; the spindle waits for the valve heaters to pass half temperature.

```mermaid
flowchart LR
classDef input fill:#f2c26b,stroke:#1d2622,color:#1d2622
classDef state fill:#cfe5d2,stroke:#1d2622,color:#1d2622
classDef ind fill:#cddbe8,stroke:#1d2622,color:#1d2622
HS["HAUPTSCHALTER<br/>plant room"]:::input --> PP(("Plant supply")):::state
PP --> RECT["Rectifier bulb and arc glow"]:::ind
PP -. must be on .-> MAINS
BRK["BREAKER<br/>SUPPLY-B"]:::input --> MAINS(("Mains")):::state
MAINS --> HEAT(("Valve heaters")):::state
HT["HT<br/>SUPPLY-B"]:::input --> VALVES["Valve glow, both banks"]:::ind
HEAT --> VALVES
HEAT --> HG["HEATER gauge"]:::ind
HEAT --> SWL["Rack switch lamps"]:::ind
HEAT -- "above half" --> SPIN(("Spindle speed")):::state
SPINSW["SPIN<br/>SPINDLE-A"]:::input --> SPIN
SPEED["SPEED<br/>SPINDLE-A"]:::input --> SPIN
ENG["ENGAGE<br/>SPINDLE-B"]:::input --> GOV(("Governor limit")):::state
LIMIT["LIMIT<br/>SPINDLE-B"]:::input --> GOV
GOV --> SPIN
RESP["RESPONSE<br/>SPINDLE-B"]:::input -- "spin-up rate" --> SPIN
SPIN --> DRUM["Ferrocore drum carousel"]:::ind
SPIN --> SG["SPINDLE gauges ×2"]:::ind
SPIN --> NX["Spindle Nixie counters ×2"]:::ind
SPIN --> CUBR["Bench monitor RPM"]:::ind
HT --> LOAD(("Load kW")):::state
LT["LT<br/>SUPPLY-B"]:::input --> LOAD
HEAT --> LOAD
SPIN --> LOAD
LOAD --> WM["Wall load meter and kWh register"]:::ind
  
```

## Redlines and first-stage overheating

Spindle speed, field strength and supply load each have one operating limit shared by the affected gauges and the thermal model. Heat rises while a reading exceeds its limit and falls below it. At heat 0.35 the associated machine begins to smoke; device smoke contributes to laboratory smoke. The ashtray plume is decorative and never enters this hazard path. Detector, alarm, sprinkler and ruin links are planned in [the fire analysis](redline-fire-analysis.md) but are not wired yet.

```mermaid
flowchart LR
classDef input fill:#f2c26b,stroke:#1d2622,color:#1d2622
classDef state fill:#cfe5d2,stroke:#1d2622,color:#1d2622
classDef ind fill:#cddbe8,stroke:#1d2622,color:#1d2622
SPEED["SPEED and governor"]:::input --> SPIN(("Spindle speed")):::state
FIELD["FIELD and EXCITE"]:::input --> HBF(("H-B field")):::state
AUX["Auxiliaries and betaform gain"]:::input --> LOAD(("Supply load")):::state
SPIN -- "above 85%" --> HEAT1(("Encabulator heat")):::state
HBF -- "above 85%" --> HEAT2(("Coil heat")):::state
LOAD -- "above 6.5 kW" --> HEAT3(("Amplifier heat")):::state
HEAT1 --> SMOKE["Machine smoke and log"]:::ind
HEAT2 --> SMOKE
HEAT3 --> SMOKE
SMOKE --> AIR(("Laboratory smoke")):::state
SPIN --> SG["Spindle redline"]:::ind
HBF --> FG["Field redline"]:::ind
LOAD --> LG["Wall load redline"]:::ind
```

## Field and stability

The field needs a spindle above a fifth of full speed. Instability is the gap between BLATZ TRIM and where the field wants it, which moves with spindle, field, drift and the spindle gearing (RATIO). GND? earths the plasma inducer and slows the drift. Strain builds while instability is high, or while the xenon circuit is unsafe, and bleeds away fastest when the insulation BAND matches the field; at full strain an incident trips the mains. Time only dilates while the ferrocores are fully operational.

```mermaid
flowchart LR
classDef input fill:#f2c26b,stroke:#1d2622,color:#1d2622
classDef state fill:#cfe5d2,stroke:#1d2622,color:#1d2622
classDef ind fill:#cddbe8,stroke:#1d2622,color:#1d2622
SPIN(("Spindle speed")):::state -- "above 0.2" --> FIELD(("H-B field")):::state
HB["H–B<br/>FIELD-A"]:::input --> FIELD
FK["FIELD<br/>FIELD-A"]:::input --> FIELD
PL["PLASMA<br/>FIELD-B"]:::input --> EXC(("Plasma excitation")):::state
EX["EXCITE<br/>FIELD-B"]:::input --> EXC
EXC -- "caps" --> FIELD
TRIM["BLATZ TRIM<br/>FIELD-A"]:::input --> INST(("Instability")):::state
NULL["NULL<br/>FIELD-B"]:::input --> INST
SPIN -- "ideal trim" --> INST
FIELD --> INST
DRIFT(("Drift")):::state --> INST
RATIO["RATIO<br/>SPINDLE-A"]:::input -- "gearing moves the ideal trim" --> INST
GND["GND?<br/>FIELD-B"]:::input -- "earthed: drift slows" --> DRIFT
FIELD --> FG["FIELD gauges ×2"]:::ind
FIELD --> EMIT["Flux emitter lamp"]:::ind
FIELD --> MAP["Flux map pin lights"]:::ind
INST --> STG["STABILITY gauges ×2"]:::ind
INST --> MNX["Monitor Nixie counters ×2"]:::ind
FIELD --> DELTA(("Delta")):::state
INST --> DELTA
DELTA --> DR["Delta readouts: status bar, bench monitor, east board"]:::ind
INST --> STRAIN(("Strain")):::state
PURGE["PURGE<br/>SERVICE-B"]:::input -- "relieves" --> STRAIN
BAND["BAND<br/>SERVICE-B"]:::input -- "bleed rate, best matched to field" --> STRAIN
FIELD -- "sets the best band" --> BAND
DONOT["DO NOT<br/>SERVICE-B"]:::input -- "adds" --> STRAIN
STRAIN -- "at full: incident" --> TRIP(("Mains trip")):::state
OPS(("Ferrocores operational:<br/>powered, warm, xenon,<br/>spindle settled")):::state -- "gates" --> DIL(("Time dilation")):::state
SPIN -- "settled at SPEED" --> OPS
SPIN -- "core activity" --> DIL
STRAIN --> DIL
DAMP["DAMP<br/>FIELD-A"]:::input -- "damps" --> DIL
DIL --> CRY["Time Dilation crystal and pulse lamp"]:::ind
RESET["RESET<br/>SERVICE-B"]:::input -- "zeroes the rig" --> FIELD
  
```

## Monitors and valve banks

Each monitor panel has its own gain and its own BLATZ switch, which puts the field on that panel's trace. The side cabinet's betaform stage gain feeds both monitors, switches stages in (one lamp each, once the heaters reach it) and draws power. Each valve glows from its own switch, scaled by the heaters and HT.

```mermaid
flowchart LR
classDef input fill:#f2c26b,stroke:#1d2622,color:#1d2622
classDef state fill:#cfe5d2,stroke:#1d2622,color:#1d2622
classDef ind fill:#cddbe8,stroke:#1d2622,color:#1d2622
GA["GAIN<br/>MONITOR-A"]:::input --> SA["Scope A trace"]:::ind
BA["BLATZ<br/>MONITOR-A"]:::input -- "trace on" --> SA
GB["GAIN<br/>MONITOR-B"]:::input --> SB["Scope B trace"]:::ind
BB["BLATZ<br/>MONITOR-B"]:::input -- "trace on" --> SB
AMP["Betaform stage gain<br/>side cabinet"]:::input -- "amplitude" --> SA
AMP -- "amplitude" --> SB
AMP -- "stages switched in" --> STAGE["Betaform stage lamps ×7"]:::ind
HEAT(("Valve heaters")):::state --> STAGE
RATIO["RATIO<br/>SPINDLE-A"]:::input -- "trace frequency" --> SA
RATIO --> SB
FIELD(("H-B field")):::state --> SA
FIELD --> SB
INST(("Instability")):::state --> SA
INST --> SB
A1["AUX 1, AUX 2, XTAL A, XTAL B<br/>VALVES-A"]:::input --> VA["VALVES-A valve glow, one per switch"]:::ind
B1["AUX 1, XTAL A, XTAL B, XTAL C<br/>VALVES-B"]:::input --> VB["VALVES-B valve glow, one per switch"]:::ind
A1 -- "AUX 1, AUX 2" --> LOAD(("Load kW")):::state
B1 -- "AUX 1" --> LOAD
A1 -- "AUX 1" --> SPARK["Spark crackle"]:::ind
AMP -- "draws power" --> LOAD
LOAD --> WM["Wall load meter"]:::ind
  
```

## Xenon supply and bench monitor

Xenon is needed for safe running but never stops a start. Past 30% spindle on less than 2 SLPM, the bench monitor flashes a warning and strain creeps up.

```mermaid
flowchart LR
classDef input fill:#f2c26b,stroke:#1d2622,color:#1d2622
classDef state fill:#cfe5d2,stroke:#1d2622,color:#1d2622
classDef ind fill:#cddbe8,stroke:#1d2622,color:#1d2622
REG["Flow regulator<br/>xenon cage"]:::input --> FLOW(("Xenon flow")):::state
REG --> PRES(("Delivery pressure")):::state
PRES --> PN["Delivery pressure needle"]:::ind
FLOW --> FLT["Rotameter float"]:::ind
FLOW --> CONT(("Bank contents")):::state
CONT --> CN["Cylinder contents needle"]:::ind
FLOW --> HAZ(("Xenon hazard")):::state
SPIN(("Spindle speed")):::state -- "above 30%" --> HAZ
HAZ --> WARN["Bench monitor warning"]:::ind
HAZ --> STRAIN(("Strain")):::state
FLOW --> FL["East board FLUSS window"]:::ind
FLOW -- "2 SLPM or more" --> OPS(("Ferrocores operational")):::state
OPS --> CRY["Time Dilation crystal and sparks"]:::ind
  
```

## East board

The 1986 remote station. Its handles work the primary rack switches directly; the second panel of each pair keeps its own switches. Everything else on the board repeats machine state.

```mermaid
flowchart LR
classDef input fill:#f2c26b,stroke:#1d2622,color:#1d2622
classDef state fill:#cfe5d2,stroke:#1d2622,color:#1d2622
classDef ind fill:#cddbe8,stroke:#1d2622,color:#1d2622
H1["NETZ, HT, LT, SPIN, H-B, BLATZ,<br/>DÄMPF., ERDE?, AUX 1, AUX 2,<br/>XTAL A, XTAL B, XTAL C handles"]:::input -- "same as the rack switch" --> RACK(("Primary rack switches")):::state
NA["NOT-AUS"]:::input -- "mains and lever off" --> RACK
SP["SPÜLEN"]:::input -- "purge" --> STRAIN(("Strain")):::state
RU["RÜCKS."]:::input -- "reset" --> RIG(("Rig state")):::state
QU["QUITT"]:::input --> ALM(("Alarm sequence")):::state
LT["L-TEST"]:::input -- "3 s, all lamps" --> LAMPS["Every board lamp"]:::ind
STRAIN -- "DRUCK" --> ALM
RIG -- "instability: STÖRUNG" --> ALM
ALM --> WIN["Alarm windows and STÖRUNG lamps"]:::ind
RIG --> GRID["Channel grid: heater, spindle, field, trim match,<br/>instability, strain, Delta, load"]:::ind
RIG --> MET["Ten meters, IST and SOLL trim pointers,<br/>trend screen, kW, kWh and δ readouts"]:::ind
RACK --> HP["Handle positions and EIN lamps"]:::ind
  
```

## Spare inputs

Every input fitted to this rack now changes the machine. Two alternate panels in the catalogue are not fitted: SERVICE-A's BUS BAND selector holds its own value but reaches nothing, and SUPPLY-A duplicates SUPPLY-B. The operator log is also printed, line by line, on the teleprinter's endless paper.
## Fire incident route

Spindle, field and supply-load redlines feed three stored device heats. Heat above 0.35 emits apparatus smoke, which contributes to laboratory room smoke. Twenty continuous seconds with room smoke at or above 0.25 latch the fire alarm; the lab call point latches it immediately. Three seconds after alarm, lab sprinklers run from their modeled ceiling heads and automatically close after 45 seconds. Device heat at or above 0.90 while powered ignites that device; 45 seconds of cumulative active burning ruins the lab. Five seconds of sprinkler water while mains remain closed also ruins it. Opening mains stops the live-water timer. The corridor fire panel resets alarm and water only after smoke falls below 0.25 and no device is burning. Ruin blocks machine controls while allowing camera and doors; the on-screen RESET starts a new cold run after 20 seconds.
