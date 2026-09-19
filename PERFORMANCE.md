# CPU behavior and diagnostics

Two independent CPU issues were addressed: **compilation** and **browser runtime**.

The original Binaryen optimizer could occupy all CPU cores even with Ninja limited to one job. Browser CMake now defaults `EZEUS_WASM_OPT_CORES` to `1`; build with `--parallel 1` as well. The previously observed ~800% compilation load is not a measurement of the game's runtime cost.

The browser client delays heavy startup while hidden, suspends hidden single-player simulation/audio, reduces idle paused/menu rendering to 2 fps and wakes on input. Active scenes remain at 20 fps because simulation and rendering still share the engine loop. Rendering resolution follows the viewport's aspect ratio with a bounded logical size; it does not multiply work by the screen's Retina pixel ratio. HTTP connections are reused for the asset inventory.

Local checks verified pause/hidden/resize behavior, but the reference city is small. Asset loading, shader/texture preparation and active gameplay have different costs. No fixed CPU percentage is promised for mature cities or different hardware. Keep hardware acceleration enabled and avoid multiple running game tabs.

## Bounded browser check

Requires Node 22+ (built-in WebSocket), prepared assets, a browser engine build and a Chromium-compatible browser. The diagnostic uses an isolated temporary profile, server port 8788 and debugging port 9348, with a three-minute watchdog and process cleanup. It leaves the normal server on 8787 alone. Run from the repository root:

```sh
node scripts/profile_game_cpu.mjs client --client-only
```

It defaults to Brave's macOS application path. Set `EZEUS_BROWSER` to another browser executable if needed. The process/CPU diagnostic is tested on macOS; other platforms may need adaptation. `--headless` is optional; normal GPU selection is the default. `--software` deliberately selects SwiftShader for comparison and is not representative of normal hardware rendering.

For actual city/menu/resize checks, supply your own **native eZeus** Athens initial save (paused on day 1), never an original Zeus `.sav`:

```sh
EZEUS_SAVE_FIXTURE="/path/to/initial-athens.ez" node scripts/profile_game_cpu.mjs city
EZEUS_SAVE_FIXTURE="/path/to/initial-athens.ez" node scripts/profile_game_cpu.mjs layout --layout-only
EZEUS_SAVE_FIXTURE="/path/to/initial-athens.ez" node scripts/profile_game_cpu.mjs menu --menu-only
```

Optionally set `EZEUS_ORIGINAL_SAVE_FIXTURE` to an original `.sav` when running `--menu-only` to exercise clean format rejection. The test creates an alias only inside its disposable browser; it does not convert or modify your source file. No fixtures are distributed. Generated logs can contain local paths and game state; they stay ignored.

Do not run the benchmark concurrently with a build. Stop at a failing check and inspect `logs/cpu-<label>.json` rather than leaving browsers running.
