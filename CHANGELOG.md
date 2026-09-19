# Changelog

## v0.1.0-alpha.1 — 2026-09-19

First private browser-port prerelease, based on eZeus 0.8.2-beta.4 (`474a96206278293dbd9cde6d506b5570934f8acf`).

- C++/SDL engine compiled with Emscripten 6.0.9, with JavaScript asset loading and local browser saves.
- Full-window canvas, original-artwork menu/roster/settings, automatic viewport resizing and streamed loading progress.
- CPU controls for builds, idle scenes and hidden tabs; bounded browser diagnostics.
- Portable local asset setup with pinned upstream ZIP checksum, safe extraction, ENG conversion and file hashing.
- Source/build guides, screenshots, city blueprint, architecture, known issues, roadmap and issue template.
- Source CI checks converter fixtures, archive selection/rejection, JavaScript syntax and blueprint geometry; it does not download game content or perform a full C++ build.

A local browser smoke test exercised native eZeus city loading, simulation advancement, menu navigation and resize preservation. This remains an alpha: original `.sav` conversion, scene-flicker cleanup, full save/reload validation, accounts and shared worlds are outstanding. See [status](docs/STATUS.md).

The custom release ZIP includes matching source and the compiled browser engine, without commercial assets or personal saves. The release packager replaces build-machine directory strings in eight Wasm assertion messages with equal-length generic paths; runtime code and section lengths are unchanged. Future source builds can retain their own diagnostic paths.
