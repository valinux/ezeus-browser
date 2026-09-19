> Archived research notes. Paths to the original game installation, trainer and disassembly describe local evidence and are not included in this repository.

# Research record — 19 September 2026

## Scope and decision

The request was to research the installed Zeus + Poseidon game and produce a compact, copyable city design that can reach elite housing with the required goods, attractiveness, science/culture, health and water accounted for.

The recommendation is an original eight-estate street with complete local services, plus a common-house district and shared supply/training yard. Eight homes amortize the unique Museum/Stadium and market infrastructure while keeping every home on a short, unbranched service street. Four homes would use much of the same service infrastructure for half the elite capacity. Larger neighborhoods can be more space-efficient per home, but need fresh road/dispatch/unique-venue checks. This is a practical choice, not an exhaustive optimization of all possible maps or layouts.

The clear rectangle, access to all required buildings and a working supply economy are assumptions. No save was selected or modified, so this is not fitted to a specific existing map. No original engine source is distributed here; the inspected code consists of the local trainer sources and selected disassembly of the installed executable.

## Primary local evidence

### Installed model data

Files: `../Model/Zeus_Model_{VeryEasy,Easy,Normal,Hard,Impossible}.txt`.

Difficulty mapping: Beginner / Mortal / Hero / Titan / Olympian, respectively. `build.py` parses each file rather than copying the Hero values into every difficulty.

The model introduction explains:

- Building values: price, desirability parameters, employment and hazard risk.
- House values: lower and upper desirability thresholds, culture/science, water, Stadium/Museum, military goods and ordinary goods, population and other fields.
- Boulevard/avenue exceptions and the general desirability range cap.

The actual comma-separated house fields have 21 values before the extra spreadsheet-style columns. Relevant indexes, counted from zero, are:

| Index | Meaning used here |
| --- | --- |
| 0 / 1 | Current level's lower devolution threshold / upper evolution threshold |
| 2 | Culture or science requirement for the row's housing level |
| 3 | Water requirement |
| 4 | Stadium / Museum requirement |
| 7–12 | Mounts, food, fleece, oil, wine and armor requirement flags |
| 17 | Capacity |

For entry into level N, the guide pairs the preceding level's upper desirability threshold with the level-N service/goods requirements. It does not call the Estate row's upper value of 100 an entry requirement.

| Difficulty | Residence / Mansion / Manor / Estate entry appeal | Estate score | Estate lower threshold |
| --- | --- | --- | --- |
| Beginner | 40 / 50 / 60 / 70 | 70 | 66 |
| Mortal | 46 / 56 / 66 / 76 | 80 | 72 |
| Hero | 50 / 60 / 70 / 80 | 80 | 76 |
| Titan | 50 / 60 / 70 / 80 | 80 | 76 |
| Olympian | 55 / 65 / 75 / 85 | 80 | 80 |

All five models give a maximum of 20 residents per Estate and 60 per Townhouse. Elite water is zero; common water is required from Hovel onward. Normal/Hero elite disease increment is zero, but higher difficulty changes disease risk, so the plan retains an Infirmary. Tax and watch coverage are separate civic concerns; they are not represented as required elite evolution goods.

### Installed executable and local code

Executable SHA-256:

`382bcd286192a06eb8fdc45f5c37390a19999f5db9c940c3ce2dfcd775e90a57`

Read `../Trainer/src/house_services.h`, `../Trainer/src/science_services.h`, and `../Trainer/research/science-layout.md`. Rechecked the executable's city-mode and house-scoring routines using the system LLVM `objdump`; excerpts are saved in `research/`.

- City-mode routine at `0x4200f0`: distinguishes an Atlantean city from a Greek city running in the expansion. Owning Poseidon does not mean every scenario uses science.
- House-scoring routine at `0x484de0`: Atlantis adds 20 for the curator slot, 20 for astronomy, 15 for scholars and 25 for inventors. Greece adds 20 for competitors, 15 for philosophers, 20 for athletes and 25 for actors. Both sums are 80, with another conditional 10 controlled by existing city flags.
- The local research maps science delivery slots from walker IDs 72–75. The delivery routines at `0x4a60e0`–`0x4a6470` set the corresponding house service counters to 96; their examined tile window extends two tiles in each coordinate direction. The blueprint still uses actual road/boulevard frontage rather than detached housing.
- Health and water use separate fields from science/culture.

One community entertainment table reverses the astronomer and inventor weights relative to this executable. The guide uses the installed-code values. It does not rely on the optional +10 bonus to make the layout work.

### Official manuals shipped with the game

The local PDFs were read through PDFKit text extraction into temporary files. Full manual text was not copied into this deliverable.

**Zeus manual:** printed pp. 25–27 (walker types), 29–35 (common versus elite housing), 69–73 (Agora and vendors), 83–93 (health, maintenance and water), 95–97 (Palace/tax), 105–110 (culture), 147–148 (Horse Ranch), 154–156 (beauty and boulevards).

The manual establishes that elite houses have their own water, that common and elite housing are separately placed, that the Agora road runs through its footprint, and that buildings adjoining a boulevard have normal access to the road across its planted verges. It also explains why the Palace and final housing level are different concepts.

The horse-production section specifies wheat and excludes direct Granary supply to the ranch. The distribution section distinguishes citizen food in Granaries from horse wheat in Storehouses.

**Poseidon manual:** printed pp. 10–13 (science training and roaming/destination behavior), 18–19 and the production diagram (wood, horses and chariots). Universities train both astronomers and curators. A Museum is unique per city. Inventors train at the workshop before going to a Laboratory. Finished chariots cannot be imported/exported.

Official manual mirrors consulted online:

- [Zeus manual, Sierra Help](https://sierrahelp.com/Documents/Manuals/Zeus_-_Manual.pdf)
- [Poseidon manual, Steam](https://cdn.akamai.steamstatic.com/steam/apps/566050/manuals/Zeus_-_Poseidon_-_Manual.pdf?t=1626116105)

## Community cross-checks

- [Citadel of Poseidon: building data](https://poseidon.biancavanschaik.nl/buildingmodels.html) supplies footprint dimensions missing from the text model: elite 4×4, common 2×2, Agora 6×5 / 6×3, Infirmary 4×4, Bibliotheke 2×2, Observatory/Theater 5×5, Laboratory 4×4, Museum 6×6, Stadium 10×5 (rotatable), and the remaining civic/training footprints.
- [Walker distances](https://poseidon.biancavanschaik.nl/walkerdist.html) gives roaming limits of 27 for water/healers, 35 for culture/science/tax, and 44 for maintenance/watch/peddlers. These are community measurements, not independently confirmed binary constants. The checker deliberately evaluates every road tile touching a provider, rather than assuming one favorable exit orientation. It does not model the Fountain/Infirmary return-point quirk described on that page.
- [Housing requirements](https://poseidon.biancavanschaik.nl/housing.html) corroborates separate housing classes and the initial placement allowance of two food, one fleece and one oil per elite plot.
- [Appeal table](https://poseidon.biancavanschaik.nl/appeal.html) corroborates attraction from landscaping and negative influence from storage/industry. The proposal does not claim a numerical total appeal at each house.
- [Published block index](https://poseidon.biancavanschaik.nl/blocks.html), especially the 17- and 22-estate Poseidon examples, was reviewed for comparison. Their larger footprints and notes about extra appeal reinforced keeping the first recommended neighborhood smaller. No published layout image or tile arrangement is reproduced in this design.

## Static verification

`validate.py` independently constructs tile sets and a road graph from `blueprint.json` and checks:

1. All footprints are within their declared envelopes.
2. No illegal building overlaps exist; market stalls are allowed only within their parent Agora.
3. No building occupies the central road, except the intended Agora footprint; no building occupies a reserved boulevard verge.
4. Every occupied house and functional facility has access to the interior street.
5. The service street is connected and has no internal junctions.
6. For every service provider and every possible touching entry tile, BFS distance to every house frontage is within the reference range.
7. Five difficulty models have the expected water/capacity requirements and Beginner's distinct estate score.

These tests validate placement and potential geometric reach. They do not establish how often a randomly dispatched walker chooses each direction, how quickly a service counter decays, whether buyers return in time, or whether staff remain available. They also do not execute a live game tick.

`check-browser.mjs` exercises 30 civilization/district/difficulty combinations in an isolated headless browser. It checks the inspector, layer filter, tile/label controls, local checklist, real export downloads and mobile overflow, and produces preview PNGs, standalone SVG maps and a printable PDF. See the generated `browser-validation.json` for the actual result.

## In-game acceptance criteria

Use a map with the buildings and supply chains available. Complete all landscaping, then place the elite plots. Run a full game year with automatic service and goods boosts disabled. Every home should remain supplied, receive all four service types, have acceptable appeal and become an Estate as goods arrive. Keep worker housing supplied and inspect employment and hazards throughout the test.

The beauty reserve is intentionally explicit: eight rear 4×4 ponds, parks in all shown gaps and a continuous boulevard. The exact desirability calculation, starting terrain, nearby structures, production rates and live service recurrence remain unverified. If a house reports insufficient appeal, replace its rear decoration with a stronger available structure or extend the beauty buffer. Do not add internal road branches. This adaptation may increase the final footprint.

There is no guarantee that this is globally smallest, universally available in every scenario, or sufficient without the map's required production/trade capacity. The source-backed upgrade requirements, copyable geometry and inspection procedure make it a reviewable starting design rather than an untested assertion of perfection.
