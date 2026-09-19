#!/usr/bin/env python3
"""Bundle tracked source and an existing browser build, never local game assets."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

PROJECT = Path(__file__).resolve().parents[1]


def sanitize_assertion_paths(wasm, prefix):
    """Replace only NUL-terminated source diagnostic paths without moving bytes."""
    if not wasm.startswith(b'\x00asm\x01\x00\x00\x00'):
        raise ValueError('Not a WebAssembly 1 binary')
    prefix = prefix.encode()
    if len(prefix) < len(b'/src/ezeus/'):
        raise ValueError('Source prefix is too short')
    start = 0
    count = 0
    while (start := wasm.find(prefix, start)) >= 0:
        end = wasm.find(b'\0', start)
        path = wasm[start:end] if end >= 0 else b''
        if not path.endswith((b'.cpp', b'.h')) or any(c < 32 or c > 126 for c in path):
            raise ValueError('Source prefix occurs outside an expected diagnostic string')
        count += 1
        start += len(prefix)
    replacement = b'/src/ezeus/' + b'/' * (len(prefix)-len(b'/src/ezeus/'))
    result = wasm.replace(prefix, replacement)
    assert len(result) == len(wasm)
    return result, count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engine-build', type=Path, default=PROJECT/'builds/browser')
    parser.add_argument('--source-prefix', help='Absolute original source directory, including trailing slash; redact assertion paths')
    parser.add_argument('--output', type=Path, default=PROJECT/'dist/ezeus-browser-v0.1.0-alpha.1.zip')
    args = parser.parse_args()
    names = subprocess.check_output(['git', '-C', str(PROJECT), 'ls-files', '-z']).decode().split('\0')
    names = [name for name in names if name]
    if not names:
        parser.error('No tracked source files; run from the repository checkout')
    forbidden = {'runtime', 'downloads', 'builds', 'toolchains', 'fixtures', 'logs', 'dist'}
    for name in names:
        path = Path(name)
        if path.parts[0] in forbidden or path.suffix.lower() in {'.sav', '.ez', '.eng', '.epak', '.ttf', '.e', '.exe', '.dll'} or name == 'asset-manifest.json':
            parser.error(f'Local asset or generated output is tracked: {name}')
    engine = {name: (args.engine_build/name).read_bytes() for name in ['eZeus.js', 'eZeus.wasm']}
    count = 0
    if args.source_prefix:
        engine['eZeus.wasm'], count = sanitize_assertion_paths(engine['eZeus.wasm'], args.source_prefix)
    info = {'release': 'v0.1.0-alpha.1',
            'source_commit': subprocess.check_output(['git', '-C', str(PROJECT), 'rev-parse', 'HEAD'], text=True).strip(),
            'redacted_assertion_paths': count,
            'engine': {name: {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in engine.items()}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name in sorted(names):
            archive.write(PROJECT/name, 'ezeus-browser/'+name)
        for name, data in engine.items():
            archive.writestr('ezeus-browser/builds/browser/'+name, data)
        archive.writestr('ezeus-browser/RELEASE_BUILD.json', json.dumps(info, indent=2)+'\n')
    print(json.dumps(info, indent=2))
    print(args.output)


if __name__ == '__main__':
    main()
