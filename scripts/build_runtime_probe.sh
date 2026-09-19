#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source toolchains/emsdk/emsdk_env.sh
mkdir -p builds/runtime-probe
em++ scripts/verify_browser_runtime.cpp --use-port=sdl2 -pthread \
  -sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=262144 -sPTHREAD_POOL_SIZE=8 \
  -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=8388608 -sINVOKE_RUN=0 \
  -sEXIT_RUNTIME=1 -lidbfs.js -sEXPORTED_RUNTIME_METHODS=FS,callMain \
  -sENVIRONMENT=web,worker --shell-file scripts/runtime_probe_shell.html \
  -o builds/runtime-probe/runtime.html
