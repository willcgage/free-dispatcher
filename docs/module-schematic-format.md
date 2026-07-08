# Module Schematic Format — v1 (draft)

Status: **draft** · Epic: [#122](https://github.com/willcgage/free-dispatcher/issues/122)

The contract between the **Module Repository** (which authors a module's schematic)
and **Free-Dispatcher** (which imports and composes modules into a layout). It lets
an owner depict their module accurately once — track paths, turnouts, signals,
endplates — so Free-Dispatcher can chain modules into a layout without
reconstructing each module's internals.

## Division of labor

- **Module Repository** owns *authoring*: one build tool, one canonical schematic
  per module, versioned.
- **Free-Dispatcher** owns *composition*: import each module's schematic, chain by
  endplate, assign sections/districts, and drive dispatching. FD never re-derives a
  module's internals.

## Design principles

1. **Topological, straightened-first.** The doc describes *what connects to what*,
   not exact angles. Real CTC/dispatcher panels straighten the railroad; geometry
   (curves/corners) stays in the existing MR fields for the *footprint* view only.
2. **Minimal by default.** A plain single-track straight is a few lines of data.
   Everything past the through-track is optional.
3. **Composition by endplate.** Modules join only at endplates; each endplate
   declares the tracks crossing it so FD can wire lanes across the boundary and run
   the single↔double compatibility check.
4. **Additive & versioned.** No schematic → FD falls back to deriving single/double
   from endplate `track_config`. Existing modules keep working.

## Coordinate model — 1-D `pos` + `lane`

- **`pos`** — inches along the module measured from endplate **A** (the canonical
  West/left end). FD applies the placement `flipped` flag by mirroring
  `pos → lengthInches − pos` and swapping endplates A/B.
- **`lane`** — integer track index across the module (0 = primary main, 1 = second
  main; sidings/spurs get their own indices). Vertical spacing is FD's to render.

There is deliberately **no 2-D geometry** here — that would reintroduce the angles
the operations view drops, and is harder to author. The footprint view keeps using
`geometry_type` / `geometry_degrees` / lengths.

## Storage & transport

- **MR storage:** a `schematic jsonb` column plus `schematic_version int` on
  `freemon_modules`. One document per module.
- **Transport:** `modules-full` returns the `schematic` object **inline** (it is
  small). FD syncs it into `repo_modules.schematic` (jsonb), alongside the file
  `schematics[]` metadata it already stores.

## Entity model

All ids are strings unique within the document. Positions are inches; `config`
values are `single` | `double`.

| Entity | Purpose | Fields |
|---|---|---|
| **endplate** | connection point to the neighbor | `id` (`A`/`B`/…), `label`, `tracks[]` = `{ trackId, lane, config }` |
| **track** | a running track | `id`, `role` (`main`\|`siding`\|`spur`\|`yard`\|`crossover`), `lane`, `from`, `to` (endplate or node id), `fromPos?`/`toPos?` (explicit inches, overriding node lookup), `capacityFeet?`, `industryRef?` |
| **turnout** | a switch diverging off a track | `id`, `pos`, `onTrack`, `divergeTrack`, `kind` (`left`\|`right`\|`wye`), `name`, `address?` |
| **control point** | an interlocking: a named group of signals + the turnout(s) it governs | `id`, `name`, `turnouts[]` (turnout ids), `signals[]` = `{ id, pos, track, facing, kind }` |
| **signal** (within a control point) | a mast/dwarf governing a track | `id`, `pos`, `track`, `facing` (`AtoB`\|`BtoA`), `kind` (`mast`\|`dwarf`), `aspects?`, `address?` |
| **block** | native detection segment | `id`, `name`, `tracks[]`, `from`, `to` (pos range) |
| **mss** | signal-system interface | `type`, `interfaces[]` (endplate ids) |

Top-level document fields: `version` (int), `module` (record number), `lengthInches`,
then the arrays above (`endplates` and `tracks` required; the rest optional).

Decisions baked in (revisable):
- **Blocks** are *native* to the module and optional; FD may subdivide or group them
  into sections at the layout.
- **Turnout/signal `address`** is optional and included now (forward-looking for
  DCC/LCC automation) even though FD is manual today.

## Example — minimal single-track straight

```json
{
  "version": 1, "module": "FMN-0001", "lengthInches": 48,
  "endplates": [
    { "id": "A", "label": "West", "tracks": [{ "trackId": "main", "lane": 0, "config": "single" }] },
    { "id": "B", "label": "East", "tracks": [{ "trackId": "main", "lane": 0, "config": "single" }] }
  ],
  "tracks": [ { "id": "main", "role": "main", "lane": 0, "from": "A", "to": "B" } ]
}
```

## Example — passing siding + industry spur + signal

```json
{
  "version": 1, "module": "FMN-0003", "lengthInches": 96,
  "endplates": [
    { "id": "A", "label": "West", "tracks": [{ "trackId": "main", "lane": 0, "config": "single" }] },
    { "id": "B", "label": "East", "tracks": [{ "trackId": "main", "lane": 0, "config": "single" }] }
  ],
  "tracks": [
    { "id": "main", "role": "main",   "lane": 0, "from": "A",   "to": "B" },
    { "id": "sid",  "role": "siding", "lane": 1, "from": "swW", "to": "swE", "fromPos": 18, "toPos": 78, "capacityFeet": 8 },
    { "id": "spur", "role": "spur",   "lane": 2, "from": "swW", "to": "spurEnd", "fromPos": 18, "toPos": 40, "industryRef": 5 }
  ],
  "turnouts": [
    { "id": "swW", "pos": 18, "onTrack": "main", "divergeTrack": "sid", "kind": "right", "name": "West Siding" },
    { "id": "swE", "pos": 78, "onTrack": "main", "divergeTrack": "sid", "kind": "left",  "name": "East Siding" }
  ],
  "signals": [
    { "id": "sW", "pos": 10, "track": "main", "facing": "AtoB", "kind": "mast", "name": "CP West", "aspects": ["red","yellow","green"] }
  ],
  "blocks": [
    { "id": "b1", "name": "Main W", "tracks": ["main"], "from": 0,  "to": 48 },
    { "id": "b2", "name": "Main E", "tracks": ["main"], "from": 48, "to": 96 }
  ]
}
```

## Composition rules (Free-Dispatcher)

1. Chain modules **West → East** in layout sequence order.
2. At each boundary, module N's endplate **B** meets N+1's endplate **A**; match
   tracks by **lane**, verify **config** compatibility (the single↔double endplate
   check), and continue lanes across the boundary.
3. Apply `flipped` by mirroring `pos` and swapping A/B before chaining.
4. The layout operations schematic is the **concatenation of module graphs** —
   turnouts, sidings, signals appear where the owner placed them.

## What stays in Free-Dispatcher

- Grouping module **blocks → sections → districts** and dispatcher assignment
  (layout/event-specific, not a module property).
- Runtime **occupancy / allocations** and **signal aspect** derivation — the module
  supplies the mast; FD computes red/yellow/green from occupancy + authority.
- The **footprint** view (uses existing geometry fields).

## Fallback (no authored schematic)

FD derives a trivial graph: one `main` track per endplate `track_config`
(`single`→1 lane, `double`→2 lanes), no turnouts/signals. This is exactly what the
current operations renderer does, so un-authored modules render unchanged.

## Versioning

- `version` is the format version (start at 1).
- `schematic_version` (the MR column) increments when an owner edits a module's
  schematic, so a layout that imported an older revision can detect drift.

## Implementation checklist

**Module Repository**
- [x] Migration: `schematic jsonb`, `schematic_version int` on `freemon_modules`.
- [x] `modules-full`: return `schematic` inline.
- [ ] Build tool: the authoring UI in the MR web app (Next.js) that produces this doc.

**Free-Dispatcher**
- [x] Sync `repo_modules.schematic` (jsonb).
- [x] Import + overlay module graphs (sidings/spurs, turnouts, signals) on the
      operations schematic, with the field-derived fallback above.
- [ ] Seed layout turnouts/signals/blocks (occupancy/allocation) from imported graphs.

## Endplate equality (Free-moN standard)

The Free-moN standard defines **one** endplate interface — minimum 12" wide,
track crossing in the central third, perpendicular and level at the plate,
single or double track. There is **no "mainline endplate" vs "branch
endplate"**: main and branch are *layout-time roles* assigned when a setup is
composed, never properties of a module.

In this format, endplate ids `A`/`B` mark only the pair the **straightened
schematic uses as its drawing axis** (positions are measured in inches from
`A`). Additional endplates (`C`, `D`, …, placed with `at: {pos, side}`) are the
same standard interface — a set that carries a second railroad through simply
has more of them. Layout composition (joins, the footprint solver, endplate
compatibility checks) must treat every endplate as an equal node: any endplate
may mate with any compatible endplate, and the dispatching "main" follows the
layout's actual route, not the letters.
