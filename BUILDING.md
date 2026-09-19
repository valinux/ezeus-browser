# Setup and building

Run commands from the repository root. The tested environment is an Intel Mac with Brave/Chromium 153, Python 3.14, CMake 4.4, Ninja 1.13 and **Emscripten 6.0.9**. Python 3.11+ is required. Modern desktop Chromium with WebAssembly threads and WebGL is the initial target. Other browsers and operating systems have not passed a complete game test.

## 1. Obtain the engine

For the fastest setup, extract the custom ZIP from [v0.1.0-alpha.1](https://github.com/valinux/ezeus-browser/releases/tag/v0.1.0-alpha.1). It includes `builds/browser/eZeus.js` and `builds/browser/eZeus.wasm`, plus matching source. Skip the compilation section below.

To develop, clone the private repository with an account that has access:

```sh
git clone https://github.com/valinux/ezeus-browser.git
cd ezeus-browser
```

A clone or GitHub's automatic source archive requires compilation. No npm packages are needed for the game client or server.

## 2. Prepare your own game assets

Install Zeus + Poseidon through your game provider. Locate the folder containing `DATA/`, `Audio/`, `Adventures/`, `Model/`, `Zeus_Text.eng`, `Zeus_MM.eng`, and `zeus.ico`. On Steam, use the game's **Manage → Browse local files** option. The original executable does not run in the browser.

Separately download [eZeus-0.8.2-beta.zip](https://github.com/MaurycyLiebner/eZeus/releases/download/0.8.2-beta/eZeus-0.8.2-beta.zip) from the upstream release. It supplies the graphics packs and other eZeus runtime resources. This is the **base ZIP**, not the beta.4 Windows executable. Expected SHA-256:

```text
77e46d79edc3cfb7818b6992cd861cb303a1055b72a1be2b0c04f8a91a47c5a3
```

```sh
python3 scripts/setup_runtime.py --game-root "/path/to/Zeus + Poseidon" --base-zip "/path/to/eZeus-0.8.2-beta.zip"
```

On Windows, replace `python3` with `py -3` and quote Windows paths. The setup script verifies the archive, extracts selected runtime files into ignored `runtime/`, converts your ENG text into XML, and writes the ignored `asset-manifest.json`. It reads original game files without changing them. Windows executables and DLLs in the ZIP are not installed or executed. Keep your original game folder in place; the server reads its audio, adventures and model files directly.

Existing extracted runtime owners can instead use:

```sh
python3 scripts/prepare_assets.py --game-root "/path/to/Zeus + Poseidon" --runtime "/path/to/extracted/eZeus-0.8.2-beta"
```

Text conversion currently targets Western Windows-1252 game text. Custom East Asian encodings have not been implemented.

## 3. Build from source (skip for the custom release ZIP)

Install Git, Python 3.11+, CMake 3.16+ and Ninja, then follow the pinned SDK setup. The source needs no game assets to compile.

```sh
git clone https://github.com/emscripten-core/emsdk.git toolchains/emsdk
git -C toolchains/emsdk checkout c59d6e841da55c2c21af32004c4c173cbd1c0f10
toolchains/emsdk/emsdk install 6.0.9
toolchains/emsdk/emsdk activate 6.0.9
source toolchains/emsdk/emsdk_env.sh
emcmake cmake -S dev -B builds/browser -G Ninja -DCMAKE_BUILD_TYPE=Release -DEZEUS_WASM_OPT_CORES=1
nice -n 10 cmake --build builds/browser --parallel 1
```

On Windows, use `emsdk.bat` and `emsdk_env.bat` in a command prompt, and omit `nice -n 10`. These platform substitutions are provided for development; this project has only been played and measured on macOS so far. See the [official Emscripten installation guide](https://emscripten.org/docs/getting_started/downloads.html) for platform prerequisites.

A clean build is substantial: hundreds of C++ translation units plus WebAssembly optimization. Leave **both** parallel build jobs and `EZEUS_WASM_OPT_CORES` at `1` to keep CPU use bounded. Binaryen optimization otherwise can use every core even with a single Ninja job. Do not run browser benchmarks during a build. Output is `builds/browser/eZeus.js` and `eZeus.wasm`; assets are loaded separately at runtime.

## 4. Play

```sh
python3 scripts/serve_dev.py
```

Open **http://127.0.0.1:8787/**. Keep the server running; stop it with Ctrl+C when finished. On later visits you need only this command, unless game assets changed or you rebuilt the engine. If assets change, rerun preparation to update hashes.

The server binds to `127.0.0.1` and serves an explicit file allowlist. It supplies the COOP/COEP isolation headers needed by WebAssembly threads. Double-clicking the HTML file or using a generic static server is insufficient. HTTPS plus these headers is required for a future remote deployment. GitHub stores this project's source and releases; it does not host a playable game here.

Startup downloads and hashes approximately 1,818 files / 511 MB for the tested installation. Content/version differences can change these figures. The loader shows progress and starts the game automatically after preparing its filesystem. Select/create a leader using the game's roster and choose New Adventure. `P` toggles pause in a city. The rest of the controls use the game's menus.

### Storage and saves

The engine reads assets from an in-memory filesystem populated by HTTP responses. Versioned asset responses allow the browser's HTTP cache to retain downloads; cache eviction can cause another download. This is separate from `/runtime/Save`, which uses IndexedDB. The client attempts save synchronization every 30 seconds while running and when the page becomes hidden. Wait at least 30 seconds after saving before closing the tab. Do not rely on browser saves as your only copy while save/reload validation is incomplete.

Removing cached images/files can reclaim cached assets; clearing site data also risks removing saves. A different browser/profile/host/port has separate storage. Accounts, automatic cloud backups and a user-facing save import/export workflow are future work. Original `.sav` files cannot be loaded by renaming them to `.ez`.

### Troubleshooting

| Symptom | Action |
| --- | --- |
| Python reports `file_digest` missing | Use Python 3.11 or newer. |
| Base ZIP checksum mismatch | Download the exact linked base ZIP again; do not substitute a patched EXE or source archive. |
| Missing game asset | Point `--game-root` at the installed folder containing DATA and Audio. |
| Browser engine missing | Use the custom release ZIP or complete the source build. |
| SharedArrayBuffer/isolation error | Use the supplied server at the loopback URL; check `crossOriginIsolated` in the browser console. |
| Asset hash mismatch or 404 | Rerun asset preparation after changing files; keep the game installation accessible. |
| Address already in use | Stop another local server or use `--port 8789`; remember saves are separate at the new port. |
| High CPU during compilation | Keep one build job and one Binaryen core. |
| High CPU in browser | Pause, hide unused game tabs and use hardware acceleration; see PERFORMANCE.md. |
| Brief scene-loading image flashes | Known loading-widget behavior; see docs/STATUS.md. |

## Developer checks

```sh
python3 -m unittest discover -s scripts -p 'test_*.py' -v
python3 -m compileall -q scripts
node --check dev/web/app.js
python3 city-blueprint/validate.py
```

CI runs source checks without game assets. Actual browser checks require prepared assets and a compiled engine; see [PERFORMANCE.md](PERFORMANCE.md). Synthetic unit fixtures contain no game content.

## Optional native reference

The retained CMake target also supports a native reference using its pinned SDL dependencies:

```sh
cmake -S dev -B builds/native -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build builds/native --parallel 1
```

A native build additionally requires a C++17 compiler and development dependencies for SDL's image/font libraries. The executable belongs in `runtime/eZeus-0.8.2-beta/Bin/` alongside the generated relative `zeus_path.txt` configuration in its parent. Native dependency packaging is outside this browser release. The upstream `compile_apple.sh` rewrites source files; use the documented CMake route instead.
