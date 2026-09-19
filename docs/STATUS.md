# Status — v0.1.0-alpha.1

This is a browser prototype based on upstream eZeus 0.8.2-beta.4. It is not yet a production online game.

## Implemented and exercised locally

- Native reference and WebAssembly engine compile on Intel macOS.
- A native-created eZeus Athens city loads in the browser and advances its date when unpaused.
- Initial progress reports bytes and asset verification; the full 1,818-file inventory loaded and automatic startup passed twice in the client check.
- Menu, roster and settings backgrounds cover wide and portrait windows. Five viewport sizes, including DPR 2, passed resize/edge checks; a city loads from the resized menu.
- Resizing a loaded city preserves the current city and an open dialog.
- Hidden startup waits; hidden games stop advancing. Idle paused scenes/main menu reduce rendering to 2 fps, with input waking rendering.
- A small runtime integration probe exercised worker execution, pixel readback and IndexedDB write/reload. This is narrower than complete game save/reload validation.
- Original Zeus `.sav` input was cleanly rejected by the actual `.ez` format check.

Screenshots are from these checks on macOS with Brave/Chromium 153. Browser checks use disposable profiles. The release-folder checks also passed fresh asset preparation, two automatic starts using the packaged Wasm, streaming progress, hidden startup and resizing. See [validation results](VALIDATION.json). General Windows/Linux, Firefox, Safari, mobile, large-city and long-session performance remain unverified.

## Known limitations

1. **Scene transition flicker:** `dev/widgets/eloadingwidget.cpp` selects a random background after preparation steps. Progress widgets are hidden. A stable loading picture/progress display until the first city frame is planned, not fixed in this release.
2. **Save compatibility:** original `.sav` files have a different binary format. Native `.ez` loading passed a smoke test, but no general converter exists and complete save/reload/endurance testing is outstanding.
3. **Local storage only:** browser saves use IndexedDB. There is no account system, cloud recovery, save export UI or remote synchronization yet.
4. **Large startup:** about 511 MB of assets are loaded into the runtime. Streaming/lazy asset loading and memory reduction remain future work.
5. **Gameplay coverage:** campaigns, the editor, combat, mature Greek/Atlantean cities and every service chain have not passed full browser testing. The Unix libnoise terrain generator is disabled in the WebAssembly build.
6. **CPU coverage:** hidden/idle handling is improved; active city rendering remains 20 fps and is coupled to simulation. Lower CPU on a tiny city is not proof of large-city performance.
7. **No multiplayer/server simulation:** the Python server supplies files only. Accounts, per-player cloud storage, updates and a shared strategic world are defined in the roadmap.
8. **Blueprint scope:** the included elite district targets original-game rules. Geometry is checked, but a full game year at target housing has not been observed; eZeus rule differences require adaptation.

See the [development plan](../DEVELOPMENT_PLAN.md) and [backlog](../BACKLOG.csv) for acceptance criteria. Their starting-point table is a historical planning baseline; this page describes the release's current behavior.
