// The page is the game client. Diagnostics are available in the developer console.
const canvas = document.querySelector('#canvas');
const loadingScreen = document.querySelector('#loading');
const loadingTitle = document.querySelector('#loading-title');
const loadingDetail = document.querySelector('#loading-detail');
const loadingPercent = document.querySelector('#loading-percent');
const loadingProgress = document.querySelector('#loading-progress');
const state = window.eZeusPrototype = {phase: 'engine', errors: [], filesLoaded: 0, log: []};
let loaded = false, syncing = false, started = false;
let lastProgressPaint = 0, resizeTimer;
function showLoading(title, detail, fraction) {
  loadingScreen.hidden = false;
  loadingScreen.setAttribute('aria-busy', 'true');
  loadingTitle.textContent = title;
  loadingDetail.textContent = detail;
  if(fraction === undefined) {
    loadingProgress.removeAttribute('value');
    loadingPercent.textContent = '';
  } else {
    loadingProgress.value = Math.max(0, Math.min(1, fraction));
    loadingPercent.textContent = Math.floor(loadingProgress.value * 100) + '%';
  }
}
function hideLoading() {
  loadingScreen.hidden = true;
  loadingScreen.setAttribute('aria-busy', 'false');
}
function viewportSize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  // Keep the native UI legible and match the window's aspect ratio. A 720-line
  // rendering budget avoids multiplying the GPU/CPU load on Retina/4K screens.
  const scale = Math.max(720 / height, 800 / width);
  return {width: Math.round(width * scale), height: Math.round(height * scale)};
}
function updateViewport() {
  const size = viewportSize();
  if(Module.browserViewport?.width === size.width && Module.browserViewport?.height === size.height)return;
  Module.browserViewport = size;
  state.viewport = size;
  document.dispatchEvent(new Event('ezeusviewportchange'));
}
function writeGameSettings() {
  updateViewport();
  const {width, height} = Module.browserViewport;
  Module.FS.writeFile('/runtime/settings.txt', `tiny_textures "true"\nsmall_textures "false"\nmedium_textures "false"\nlarge_textures "false"\nfullscreen "false"\nwidth "${width}"\nheight "${height}"\n`);
}
function assetProgress(index, bytes, force = false) {
  state.bytesLoaded = bytes;
  state.totalBytes = index.bytes;
  state.totalFiles = index.files.length;
  state.loadProgress = bytes / index.bytes;
  const now = performance.now();
  if(!force && now - lastProgressPaint < 100)return;
  lastProgressPaint = now;
  showLoading('Loading game assets…',
    `${(bytes / 1e6).toFixed(1)} / ${(index.bytes / 1e6).toFixed(1)} MB · ${state.filesLoaded.toLocaleString()} / ${index.files.length.toLocaleString()} assets verified`,
    state.loadProgress);
}
async function readAsset(response, file, onBytes) {
  if(!response.body) {
    const buffer = await response.arrayBuffer();
    if(buffer.byteLength !== file.bytes)throw new Error('Incomplete asset: ' + file.path);
    onBytes(buffer.byteLength);
    return buffer;
  }
  const bytes = new Uint8Array(file.bytes);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    while(true) {
      await waitForVisibleClient();
      const {done, value} = await reader.read();
      if(done)break;
      if(offset + value.byteLength > bytes.length)throw new Error('Incorrect asset size: ' + file.path);
      bytes.set(value, offset);
      offset += value.byteLength;
      onBytes(offset);
    }
  } catch(error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  if(offset !== bytes.length)throw new Error('Incomplete asset: ' + file.path);
  return bytes.buffer;
}
function report(message) {
  state.log.push(String(message));
  if(state.log.length > 200)state.log.shift();
}
function fail(error) {
  state.phase = 'failed';
  state.errors.push(String(error));
  showLoading('Could not load the game', String(error), state.loadProgress || 0);
  loadingScreen.setAttribute('aria-busy', 'false');
  console.error('eZeus:', error);
}
window.addEventListener('error', event => fail(event.error || event.message));
window.addEventListener('unhandledrejection', event => fail(event.reason));
const syncFiles = populate => new Promise((resolve, reject) => Module.FS.syncfs(populate, error => error ? reject(error) : resolve()));
async function waitForVisibleClient() {
  if(!document.hidden)return;
  await new Promise(resolve => {
    function visible() {
      if(document.hidden)return;
      document.removeEventListener('visibilitychange', visible);
      resolve();
    }
    document.addEventListener('visibilitychange', visible);
    visible();
  });
}
async function persistSaves() {
  if(!loaded || syncing)return;
  syncing = true;
  try { await syncFiles(false); state.lastSaveSync = Date.now(); }
  catch(error) { report('Browser save persistence failed: ' + error); console.error(error); }
  finally { syncing = false; }
}
async function startGame() {
  if(!loaded || started)return;
  started = true;
  await waitForVisibleClient();
  writeGameSettings();
  state.phase = 'starting';
  showLoading('Starting game…', `${state.filesLoaded.toLocaleString()} assets verified.`, 1);
  canvas.focus({preventScroll: true});
  try { Module.callMain([]); }
  catch(error) { fail(error); }
  setInterval(() => { if(!document.hidden && state.phase === 'running')persistSaves(); }, 30000);
}
var Module = {
  canvas,
  browserViewport: viewportSize(),
  locateFile: name => '/engine/' + name,
  print: report,
  printErr: report,
  onAbort: fail,
  onExit(code) {
    state.exitCode = code;
    state.phase = code === 0 ? 'exited' : 'failed';
    hideLoading();
    persistSaves();
  },
  onGameFrame() {
    state.phase = 'running';
    state.firstFrame = true;
    hideLoading();
  },
  async onRuntimeInitialized() {
    try {
      state.phase = 'assets';
      showLoading('Preparing game assets…', 'Restoring your saved games.');
      const FS = Module.FS;
      for(const dir of ['/runtime/Bin', '/runtime/Save', '/game/DATA'])FS.mkdirTree(dir);
      FS.mount(FS.filesystems.IDBFS, {}, '/runtime/Save');
      await syncFiles(true);
      const response = await fetch('/asset-index.json');
      if(!response.ok)throw new Error('Asset inventory is unavailable');
      const index = await response.json();
      let done = 0;
      assetProgress(index, 0, true);
      // One asset at a time avoids simultaneous decode/hash/copy peaks at startup.
      for(const file of index.files) {
        await waitForVisibleClient();
        const response = await fetch(file.url);
        if(!response.ok)throw new Error('Missing asset: ' + file.path);
        const buffer = await readAsset(response, file, received => assetProgress(index, done + received));
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2, '0')).join('');
        if(hash !== file.sha256)throw new Error('Asset checksum mismatch: ' + file.path);
        FS.mkdirTree(file.destination.slice(0, file.destination.lastIndexOf('/')));
        FS.writeFile(file.destination, new Uint8Array(buffer), {canOwn: true});
        done += buffer.byteLength;
        state.filesLoaded++;
        assetProgress(index, done);
      }
      assetProgress(index, done, true);
      FS.writeFile('/runtime/zeus_path.txt', '../../game/\n');
      writeGameSettings();
      loaded = true;
      state.phase = 'ready';
      // The bounded integration benchmark injects a fixture before starting.
      if(!new URLSearchParams(location.search).has('benchmark'))startGame();
    } catch(error) { fail(error); }
  }
};
state.start = startGame;
state.persistSaves = persistSaves;
canvas.addEventListener('pointerdown', () => canvas.focus({preventScroll: true}));
canvas.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('visibilitychange', () => { if(document.hidden)persistSaves(); });
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateViewport, 150);
});

if(!crossOriginIsolated)fail('The game requires the supplied server with browser isolation headers.');
else waitForVisibleClient().then(() => {
  const script = document.createElement('script');
  script.src = '/engine/eZeus.js';
  script.onerror = () => fail('The game engine is unavailable.');
  document.body.appendChild(script);
}).catch(fail);
