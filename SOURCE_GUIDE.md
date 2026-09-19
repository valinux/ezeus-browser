# eZeus source review — 0.8.2-beta.4

Reviewed September 19, 2026 at commit `474a96206278293dbd9cde6d506b5570934f8acf`. This is a static review of the core simulation and the systems relevant to our city design. It is not a full audit of every subsystem or an in-game validation.

This review describes the original checkout and setup status at review time. Subsequent implementation and asset preparation are tracked in [current status](docs/STATUS.md).

eZeus is a separate, open-source C++ implementation using original Zeus/Poseidon assets. Its [README](dev/README.md) explicitly describes differences from the original game. Housing requirements below are taken from this checkout, rather than copied from the original game's model files.

## Engine structure

| Responsibility | Main source locations | How it works |
| --- | --- | --- |
| Startup and assets | [main.cpp](dev/main.cpp), [egamedir.cpp](dev/egamedir.cpp) | Initializes SDL video/audio, image and font support, paths, settings, numeric defaults, textures, and the main window. |
| Input and presentation | [emainwindow.cpp](dev/emainwindow.cpp), [widgets/](dev/widgets/) | SDL event loop with the project's own widgets and rendering. Qt/qmake can be used as build tooling; this is not a Qt widget application. |
| Simulation driver | [egamewidgetpaint.cpp](dev/widgets/egamewidgetpaint.cpp), [egameboard.cpp](dev/engine/egameboard.cpp) | The active game widget processes background results and advances `eGameBoard::incTime(mSpeed)` when the game is allowed to run. The board updates dates, cities, players, buildings, characters, events, and goals. |
| Map and city state | [egameboard.h](dev/engine/egameboard.h), [eboardcity.cpp](dev/engine/eboardcity.cpp), [etile.h](dev/engine/etile.h) | The board owns the simulation context; city objects handle city-specific population, employment, resources, and events. Tiles reference terrain, buildings, and characters. |
| Placement | [egamewidgetbuild.cpp](dev/widgets/egamewidgetbuild.cpp), [egameboard.cpp](dev/engine/egameboard.cpp) | UI placement leads to board build functions, which check the site, create the building, register its footprint, and charge construction costs. Specialized structures have additional paths. |
| Building behavior | [buildings/](dev/buildings/) | Shared building, employing-building, house, storage, vendor, and patrol classes implement common behavior; concrete classes specify dimensions and services. |
| Walkers and actions | [echaracter.cpp](dev/characters/echaracter.cpp), [characters/actions/](dev/characters/actions/) | Characters run serializable actions for patrols, travel, carts, combat, and other behavior. Moving onto a tile triggers service delivery to nearby buildings. |
| Background calculations | [ethreadpool.h](dev/engine/ethreadpool.h), [engine/thread/](dev/engine/thread/), [engine/boardData/](dev/engine/boardData/) | Pathfinding and map calculations use thread-board data; the main simulation handles finished tasks. |
| Campaigns and persistence | [ecampaign.cpp](dev/engine/ecampaign.cpp), [ecampaignreadpak.cpp](dev/engine/ecampaignreadpak.cpp), [fileIO/](dev/fileIO/) | Campaign loading, original adventure imports, and eZeus's own save serialization are separate paths. |

Core flow: **input → placement/actions → board simulation → building and walker updates → resource/service delivery → house state → rendering and saves**.

## Elite housing: exact upgrade conditions

See `eEliteHousing::updateLevel()` in [eelitehousing.cpp](dev/buildings/eelitehousing.cpp), near line 337. Every elite plot stays **4 × 4**. Each row below requires all earlier requirements too. Every stock check is `> 0`; appeal comparisons are strictly `>`.

| Level | Usual Greek name | Capacity | Additional requirements |
| --- | --- | ---: | --- |
| 0 | Homestead | 6 | Base occupied elite house |
| 1 | Residence | 6 | Food, fleece, oil, at least **3** active culture/science categories, average appeal **> 5** |
| 2 | Mansion | 10 | Armor, average appeal **> 7** |
| 3 | Manor | 16 | Wine, average appeal **> 9** |
| 4 | Estate | 20 | Horses/chariots, **all 4** categories, average appeal **> 10** |

The final mount requirement is stored as `mHorses`. The [chariot vendor](dev/buildings/echariotvendor.cpp) converts chariot resources into the same `eProvide::horses` service used by Greek horses.

The four categories are counted equally. `eHouseBase::allCultureScience()` returns a count from 0 to 4; the house upgrade functions likewise count positive counters. This is not the original game's weighted 15/20/25/20 score. These upgrade functions contain no difficulty-specific appeal threshold branch.

Elite houses do not accept water or hygiene in their `provide()` switch, and neither is checked by their upgrade function. Maintenance is handled through the shared building class. Water and health coverage remain necessary for the supporting common housing.

Goods and services expire or are consumed. Culture/science counters refill to 8 and decrement over simulation time. Elite monthly food consumption includes people and the mount counter; fleece, oil, and (at the relevant levels) wine are consumed as well. A layout must maintain deliveries, rather than merely reach the upgrade once. Vendor stock conversion means these internal counters should not be treated directly as warehouse crates.

## Common housing and supporting services

See `eSmallHouse::updateLevel()` in [esmallhouse.cpp](dev/buildings/esmallhouse.cpp), near line 403. Plots are **2 × 2**. Requirements accumulate down the table.

| Level | Capacity | Additional requirements |
| --- | ---: | --- |
| 0 | 8 | Base occupied common house |
| 1 | 16 | Food |
| 2 | 24 | Water and at least 1 culture/science category |
| 3 | 32 | Fleece and appeal > 2 |
| 4 | 40 | At least 2 categories |
| 5 | 48 | Oil and appeal > 5 |
| 6 | 60 | At least 3 categories and appeal > 8 |

Hygiene is handled by common-house health/plague logic rather than being an explicit gate in this upgrade function. [Fountains](dev/buildings/efountain.cpp) spawn water distributors and [hospitals](dev/buildings/ehospital.cpp) spawn healers. Employment, taxation, food, and water also feed satisfaction and population stability. Maintenance, taxation, and public order have their own walkers and effects.

## Beauty: footprint average and distance falloff

The relevant pipeline is [eheatgetters.cpp](dev/buildings/eheatgetters.cpp) → [eheatmaptask.cpp](dev/engine/boardData/eheatmaptask.cpp) → [eheatmap.cpp](dev/engine/boardData/eheatmap.cpp) → `eBuilding::appeal()` in [ebuilding.cpp](dev/buildings/ebuilding.cpp), near line 2690.

Each building type supplies a value and range. The heat-map calculation measures Euclidean distance outside its rectangle and applies linear falloff `(range - distance) / range`, ignoring positions beyond the range. Contributions accumulate, with `addHeat(x, y, a)` adding `a / 2` after tile-coordinate conversion. A receiving building's appeal is the **mean of map values under all its footprint tiles**.

Examples of raw source parameters, before falloff and accumulation:

| Building | Value | Range |
| --- | ---: | ---: |
| Avenue / park | 3 | 3 |
| Fish pond | 18 | 6 |
| Stone circle | 24 | 4 |
| Museum | 12 | 4 |
| Observatory | 7 | 4 |
| Fountain | 4 | 4 |
| University | -5 | 3 |
| Granary | -12 | 4 |
| Hospital | -2 | 4 |

Design consequence: calculate each complete house footprint and keep a margin above its threshold. A beautiful corner alone does not prove estate eligibility. A future calculator should reproduce `eTileHelper` coordinate conversion and rectangle boundaries exactly, or call the engine's calculation directly. These parameters are not interchangeable with the original game's displayed desirability values.

## Roads, service reach, and routes

`eCharacter::changeTile()` in [echaracter.cpp](dev/characters/echaracter.cpp), near line 194, visits a 3 × 3 neighborhood in logical tile coordinates and calls each encountered building's `provide()` method. [eAvenue::provide()](dev/buildings/eavenue.cpp) forwards services to neighboring non-avenue buildings. It deliberately skips other avenues, so this is not an unlimited relay through a chain of avenues.

[ePatrolBuildingBase](dev/buildings/epatrolbuildingbase.cpp) manages spawning, road access, patrol guides, and optional alternating route directions. With no custom guide path, [ePatrolAction](dev/characters/actions/epatrolaction.cpp) uses free patrol with a walkability filter that excludes roadblocks. [ePatrolMoveAction](dev/characters/actions/epatrolmoveaction.cpp) prefers directions with the oldest recorded use, randomly breaking ties, and reverses when no forward option exists.

With a guide path, the action follows an explicit path using a different road/avenue walkability filter. Consequently, roadblock behavior must be considered per action type; a roadblock is not a universal obstruction for every character. Guide paths are updated when the relevant road state changes.

The default free-patrol distance parameter is 40 and the default wait parameter is 5,000 simulation-time units. Culture decrement defaults to 20,000, water to 7,500, and hygiene to 25,000. These come from [enumbers.cpp](dev/enumbers.cpp) and can be overridden; they are not guarantees of real-world seconds or universal service radius.

Design consequence: keep patrol routes short enough to refresh every house, explicitly connect training sources to their venues, and separate delivery access from assumptions about free patrol. A custom route could improve predictability, but still needs a time-based simulation check.

## Food, goods, and science

[eVendor](dev/buildings/evendor.cpp) uses carts to collect the relevant resource and maintains vendor stock. The [peddler](dev/characters/epeddler.cpp) asks its [agora](dev/buildings/eagorabase.cpp) to deliver from the stocked vendors to reached houses or avenues. A road connection alone cannot substitute for actual vendor stock or a successful service visit.

The Atlantean science chains are:

| Source and destination | House service |
| --- | --- |
| [Bibliotheke](dev/buildings/ebibliotheke.cpp) → patrolling scholar | `gymnastScholar` |
| [Inventors' workshop](dev/buildings/einventorsworkshop.cpp) → [laboratory](dev/buildings/elaboratory.cpp) → inventor patrol | `philosopherInventor` |
| [University](dev/buildings/euniversity.cpp) → [observatory](dev/buildings/eobservatory.cpp) → astronomer patrol | `actorAstronomer` |
| University → [museum](dev/buildings/emuseum.cpp) → curator patrol | `competitorCurator` |

[ePatrolSourceBuilding](dev/buildings/epatrolsourcebuilding.cpp) sends characters to destination venues. [ePatrolTarget](dev/buildings/epatroltarget.cpp) enables patrols after an arrival and disables them when its availability timer expires. Building a venue without sustaining that chain is insufficient.

## Saves and a future city importer

`eMainWindow::saveGame()` / `loadGame()` in [emainwindow.cpp](dev/emainwindow.cpp), near lines 251 and 274, use the binary format marker **`eZeus.ez`**, followed by game-widget settings and the campaign. [eReadStream](dev/fileIO/ereadstream.h) and [eWriteStream](dev/fileIO/ewritestream.h) serialize object fields; deferred post-load callbacks resolve object references.

[egameboardread.cpp](dev/engine/egameboardread.cpp) reconstructs board objects and registrations. [ecampaignreadpak.cpp](dev/engine/ecampaignreadpak.cpp) is the separate original-adventure import path. Normal eZeus save loading does not accept an original Zeus save simply because its extension is changed.

For a future blueprint importer, the useful integration point is board placement through `build()` / `buildBase()` and the specialized structure builders, followed by the normal eZeus serializer. That preserves building registrations, occupied tiles, city ownership, and population bookkeeping more reliably than patching arbitrary binary offsets. A complete importer would also need terrain validation, building availability, agora assembly, resource setup, and round-trip load verification. No importer or save edit was made in this task.

## Build and asset setup

[CMakeLists.txt](dev/CMakeLists.txt) declares C++17 and fetches SDL2 2.32.10, SDL_ttf 2.24.0, SDL_image 2.8.12, and SDL_mixer 2.8.2. The alternative [eZeus.pro](dev/eZeus.pro) explicitly removes Qt linkage and contains platform-specific paths and flags.

[compile_apple.sh](dev/compile_apple.sh) provides a macOS build route, but also rewrites source/build files, builds both CPU architectures, and fetches additional files. It has not been executed. A native build should be performed in a separate working copy so the release checkout remains reproducible.

[egamedir.cpp](dev/egamedir.cpp) resolves original assets two levels above the executable by default. It reads an optional `../zeus_path.txt`, whose line is appended to the executable directory. For the current nested runtime location, a relative override would need to point four levels up from `Bin/` to this Steam game directory. The setup script generates this override for the chosen asset directory. Interface/textures, fonts, converted XML text, adventures, settings, and eZeus saves use their respective runtime paths.

## What is established

The release files and exact tagged source are downloaded and verified. The core update loop, housing gates, appeal math, neighborhood service delivery, patrol paths, agora supply, science chains, placement entry points, and save structure have been traced in source. The original city blueprint has not yet been recalculated against eZeus or tested inside this engine. A playable installation and runtime validation are separate work from this completed download and source review.
