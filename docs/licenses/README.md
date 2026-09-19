# Dependency notices

The browser engine links SDL2 and the font, image and audio libraries supplied by Emscripten 6.0.9. License/copyright notices from the exact cached port sources accompany this release in the folders below. Versions are recorded in [provenance.json](../../provenance.json). The native target uses different pinned SDL versions; see its CMake configuration.

The engine is under [GPLv3](../../LICENSE.md). ENG conversion includes a separate [MIT notice](../../scripts/THIRD_PARTY_NOTICES.md). Screenshots contain original game artwork and do not grant rights to redistribute the game's asset packs.

The release also provides `ezeus-browser-dependency-sources.zip` containing the original compressed sources for the cached Emscripten ports. The pinned SDK's ports recipes describe how these libraries are built. SDL_mixer includes additional codec notices in its source archive. Emscripten's license identifies its compiler/runtime component notices and upstream sources.

This software is based in part on the work of the Independent JPEG Group. FreeType may be used under the GNU GPL as described in its included license files.
