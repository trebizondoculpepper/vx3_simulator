# Development Diary Entry - 2026-10-13

## Context

The owner requested a complete lore-appropriate label pass, including unwired controls, a recirculator-aware xenon shortcut, a Stage 3 cold-start shortcut, a lights-on shortcut and rapid mercury-arc illumination. They also reported black poster and BBC-guide rectangles and objected to temporary title-card fallbacks.

## Implementation

Restored the ferrocore rig's intended legends, added missing instrument/control captions and matched spare-control names to nearby panel wording. Reworked the control test's legends in the German industrial register. The Stage 3 shortcut establishes a cold, purged, sealed and pressurised vessel with supply selections on but drive off; LIGHTS ON is idempotent for both rooms. XENON ON now closes the plant supply and enables recirculation. The mercury arc pulses at 8 Hz, including room illumination, with steady reduced-motion lighting. Poster and book images keep the original artwork, using smaller WebP assets and a decoded-canvas upload path without temporary title cards.

The owner subsequently requested permanently lit hallway lights and a geometric green CRT progression on the southmost panel. Corridor fixtures now have their own lighting/render layer and always-on room-light uniform. The CRT uses pre-rendered plane, cube, regular/irregular polyhedron and true tesseract projections selected by measured core temperature; failed cores show a fault screen. Texture storage dimensions are fixed before the first GPU upload so decoded artwork can replace the initial pixels reliably.
