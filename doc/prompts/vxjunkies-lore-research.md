# Prompt: research the lore of r/VXJunkies

Copy everything below the line into a research-capable LLM that has web access. Save its two deliverables in this repository as `docs/lore/vxjunkies-lore.md` and `docs/lore/component-catalogue.json`.

---

## Your task

You are researching the online community **r/VXJunkies** (https://www.reddit.com/r/VXJunkies/) for a small browser game called **VX3 Simulator**. The game is an elaborate bench toy: the player powers up and tends a historical "full" VX3 rig on a garage workbench, and amusing things happen when parts of it (for example the Helmholtz-Blatz field) destabilise.

r/VXJunkies is a long-running deadpan humour community. Its members post photos of real electronics, lab equipment, industrial salvage and household junk, and discuss them in character as components of "VX" rigs, an amateur hobby that is never explained. The tone combines the earnest, gear-proud culture of amateur radio with the casual danger of high-energy physics. Nobody breaks character.

We want the game to feel authentic to people who know the subreddit. Your job is to collect the community's actual vocabulary, recurring jokes and conventions, so we use real lore where it exists and invent new material only in the same spirit.

## Where to look

Work from primary sources first:

1. The subreddit's sidebar, rules, wiki and any FAQ or pinned posts.
2. The top posts of all time and of each year, and their highest-voted comments. The old interface or the JSON endpoints (for example `https://old.reddit.com/r/VXJunkies/top/.json?t=all&limit=100`) may be easier to read than the new site.
3. Posts or comments that define or argue about terms, explain rig generations (VX2, VX3, VX4 and so on), or tell stories of accidents.
4. Secondary sources only to point you back to primary ones: Know Your Meme, articles about the subreddit, archived threads, and sister communities if any exist.

If a source cannot be reached, say so in the report rather than filling the gap from memory.

## What to collect

### 1. Community conventions

- How the joke works: the rules of staying in character, what gets downvoted or removed, and how newcomers are treated.
- Common post formats, such as build logs, "rate my rig", part identification, requests for parts, warnings and incident reports.
- Recurring phrases, catchphrases, running gags and memes, with examples of how they are used.
- How danger and accidents are described: the deadpan register, typical consequences (time loss, displacement, objects duplicating or vanishing, neighbours, pets), and safety advice given in character.

### 2. Lore and history

- Rig generations and versions: what is said about VX3 in particular, what "full" or "complete" rigs mean, and old-timer snobbery about older equipment.
- Named people, manufacturers, standards bodies, incidents, places or eras, if any are mentioned repeatedly.
- Units of measurement, named fields, effects, phenomena and "laws".

### 3. Apparatus (most important)

We will build the rig from **pre-designed components that are randomised each time the player opens the bench**. One of the game's jokes is that no two "standard" VX3 rigs are ever the same, but every part is something an enthusiast would recognise. For each component the community mentions repeatedly, record:

- its name and spelling variants
- what kind of real object people photograph when they post one (for example a vacuum tube, a toroidal coil, a rotary switch bank or a piece of plumbing). We will model it from this description.
- what it is said to do, and which other components it connects to, feeds or must be calibrated with
- the controls an operator adjusts on it, and the readings it gives
- how it fails, and the in-character consequences of the failure
- how often it appears, so we can tell core lore from one-off jokes

## Deliverable 1: `docs/lore/vxjunkies-lore.md`

A readable lore bible in Markdown, with sections for conventions, glossary, history and generations, phenomena and units, accidents and consequences, and a list of the best example posts. Write one paragraph per line, with no hard wrapping. Keep quotations short (one or two sentences at most) and paraphrase otherwise. Link every claim to a source permalink.

## Deliverable 2: `docs/lore/component-catalogue.json`

A JSON array, one object per component, in this shape:

```json
{
  "id": "helmholtz-blatz-coil",
  "name": "Helmholtz-Blatz coil",
  "aliases": ["H-B coil", "Blatz pair"],
  "role": "field",
  "real_object": "A pair of large copper-wound air-core coils facing each other on posts",
  "description": "Generates and contains the Helmholtz-Blatz field.",
  "connects_to": ["phase-spindle"],
  "controls": ["field strength", "trim"],
  "readings": ["field strength in milliblatz"],
  "failure_modes": ["field drift", "inversion"],
  "consequences": ["objects nearby become left-handed"],
  "provenance": "community",
  "frequency": "recurring",
  "sources": ["https://www.reddit.com/r/VXJunkies/comments/..."]
}
```

- `role` is one of: `power`, `heater`, `field`, `rotation`, `regulation`, `measurement`, `containment`, `signal`, `cooling`, `ancillary`. Add a new value only if none of these fits, and explain it in the lore bible.
- `provenance` is `community` when the term appears in the subreddit, and `invented` when you propose it to fill a gap. Invented entries must still match the community's style, and must have an empty `sources` array.
- `frequency` is `core` (appears very often), `recurring` (several independent posts) or `one-off`.
- Aim for at least 25 community components if the sources support that many, plus up to 15 invented components that fill gaps in the roles above.

## Rules

- Never present an invented term as community lore. The distinction between `community` and `invented` is the most important thing in this research.
- Do not record usernames or any personal details about posters. Permalinks are enough.
- Do not copy long passages. We need vocabulary and ideas, not reposted text.
- Keep the deadpan tone in the examples you record, but write your own analysis plainly.
- Finish with a short section in the lore bible listing what you could not verify and which sources you could not reach.
