#!/usr/bin/env python3
"""Loopback-only eZeus development server with explicit asset allowlists."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit

PROJECT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8787)
    parser.add_argument('--engine-build', choices=['browser', 'browser-before-cpu-fix', 'browser-before-loading-resize', 'browser-before-menu'], default='browser')
    args = parser.parse_args()
    if not (PROJECT/'asset-manifest.json').is_file():
        parser.error('Prepare your assets first: see BUILDING.md or run scripts/setup_runtime.py --help')
    if not all((PROJECT/'builds'/args.engine_build/name).is_file() for name in ['eZeus.js', 'eZeus.wasm']):
        parser.error('Browser engine missing. Extract the release bundle or build from source; see BUILDING.md')
    manifest = json.loads((PROJECT/'asset-manifest.json').read_text())
    roots = {'original-game': (PROJECT/manifest['original_game_relative_to_project']).resolve(),
             'ezeus-runtime': (PROJECT/manifest['runtime_relative_to_project']).resolve()}
    allowed = {}
    hashes = {}
    index = []
    for asset in manifest['files']:
        origin = asset['origin']; name = asset['path']
        # Packed .e files supply graphics; the engine checks that DATA exists.
        # Keep large source graphic archives out of the initial browser load.
        if origin == 'original-game' and name.startswith('DATA/'):
            continue
        if origin == 'ezeus-runtime' and name == 'i30.e':
            continue
        target = (roots[origin]/name).resolve()
        if not target.is_relative_to(roots[origin]):
            raise ValueError('Manifest path escapes its asset root')
        route = '/assets/'+origin+'/'+name
        allowed[route] = target
        hashes[route] = asset['sha256']
        index.append({**asset, 'url': quote(route, safe='/')+'?sha256='+asset['sha256'], 'destination':
                      ('/game/' if origin == 'original-game' else '/runtime/')+name})

    class Handler(SimpleHTTPRequestHandler):
        # Reuse connections across the asset inventory instead of opening a
        # new TCP connection and server thread for every small file.
        protocol_version = 'HTTP/1.1'
        disable_nagle_algorithm = True

        def end_headers(self):
            self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
            self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
            self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
            self.send_header('Cache-Control', getattr(self, 'cache_control', 'private, no-cache'))
            super().end_headers()

        def do_HEAD(self):
            self.serve_allowed(head_only=True)

        def do_GET(self):
            self.serve_allowed()

        def serve_allowed(self, head_only=False):
            request = urlsplit(self.path)
            path = unquote(request.path)
            self.cache_control = 'private, no-cache'
            if path == '/asset-index.json':
                data = json.dumps({'files': index, 'bytes': sum(f['bytes'] for f in index)}).encode()
                self.send_response(200); self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data))); self.end_headers()
                if not head_only:
                    self.wfile.write(data)
                return
            if path.startswith('/assets/'):
                file = allowed.get(path)
                requested_hash = parse_qs(request.query).get('sha256', [None])[0]
                if requested_hash is not None and requested_hash != hashes.get(path):
                    self.send_error(404); return
                if requested_hash:
                    self.cache_control = 'private, max-age=31536000, immutable'
            elif path.startswith('/probe/'):
                name = path.removeprefix('/probe/')
                file = PROJECT/'builds/runtime-probe'/name if name in {
                    'runtime.html', 'runtime.js', 'runtime.wasm', 'runtime.worker.js'} else None
            elif path.startswith('/engine/'):
                name = path.removeprefix('/engine/')
                file = PROJECT/'builds'/args.engine_build/name if name in {
                    'eZeus.js', 'eZeus.wasm', 'eZeus.worker.js'} else None
            else:
                name = 'index.html' if path == '/' else path.lstrip('/')
                file = PROJECT/'dev/web'/name if name in {'index.html', 'app.js'} else None
            if not file or not file.is_file():
                self.send_error(404); return
            stat = file.stat()
            etag = '"'+hashes[path]+'"' if path in hashes else f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
            if self.headers.get('If-None-Match') == etag:
                self.send_response(304)
                self.send_header('ETag', etag)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('ETag', etag)
            self.send_header('Content-Type', self.guess_type(str(file)))
            self.send_header('Content-Length', str(stat.st_size))
            self.end_headers()
            if head_only:
                return
            with file.open('rb') as source:
                self.copyfile(source, self.wfile)

    print(f'Local prototype: http://127.0.0.1:{args.port}', flush=True)
    print(f'Initial asset payload: {sum(f["bytes"] for f in index)/1e6:.1f} MB', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
