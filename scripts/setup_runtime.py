#!/usr/bin/env python3
"""Prepare player-owned assets using the verified upstream base package."""
import argparse
import hashlib
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import sys
import zipfile

PROJECT = Path(__file__).resolve().parents[1]
BASE_SHA256 = '77e46d79edc3cfb7818b6992cd861cb303a1055b72a1be2b0c04f8a91a47c5a3'
BASE_FOLDER = 'eZeus-0.8.2-beta'
RUNTIME_FILES = {'interface.e', 'i15.e', 'i30.e'}
RUNTIME_DIRS = {'Fonts', 'Text', 'Sanctuaries', 'Adventures'}


def runtime_path(info):
    """Reject archive traversal/links; return only runtime asset paths."""
    path = PurePosixPath(info.filename)
    if path.is_absolute() or '..' in path.parts or '\\' in info.filename:
        raise ValueError(f'Unsafe archive path: {info.filename}')
    if stat.S_ISLNK(info.external_attr >> 16):
        raise ValueError(f'Archive symlink is not allowed: {info.filename}')
    if not path.parts or path.parts[0] != BASE_FOLDER:
        raise ValueError(f'Unexpected archive root: {info.filename}')
    if len(path.parts) < 2 or info.is_dir():
        return None
    relative = PurePosixPath(*path.parts[1:])
    if relative.as_posix() in RUNTIME_FILES or relative.parts[0] in RUNTIME_DIRS:
        return relative
    return None


def extract_runtime(archive, destination):
    with archive.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if digest != BASE_SHA256:
        raise ValueError('Base ZIP checksum mismatch. Download the exact 0.8.2-beta ZIP linked in BUILDING.md.')
    with zipfile.ZipFile(archive) as source:
        # Check every entry before writing any files. Never overwrite through
        # existing links in a user-provided destination.
        selected = [(info, runtime_path(info)) for info in source.infolist()]
        for info, relative in selected:
            if relative is None:
                continue
            target = destination.joinpath(*relative.parts)
            if not target.resolve().is_relative_to(destination.resolve()):
                raise ValueError(f'Runtime destination escapes through a symlink: {relative}')
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(info) as src, target.open('wb') as dst:
                shutil.copyfileobj(src, dst)
    (destination/'Bin').mkdir(exist_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game-root', type=Path, required=True, help='Your installed Zeus + Poseidon directory')
    parser.add_argument('--base-zip', type=Path, required=True, help='Official eZeus-0.8.2-beta.zip; see BUILDING.md')
    parser.add_argument('--runtime', type=Path, default=PROJECT/'runtime'/BASE_FOLDER)
    args = parser.parse_args()
    game = args.game_root.expanduser().resolve()
    archive = args.base_zip.expanduser().resolve()
    for name in ['DATA', 'Audio', 'Adventures', 'Model', 'Zeus_Text.eng', 'Zeus_MM.eng', 'zeus.ico']:
        if not (game/name).exists():
            parser.error(f'Missing original game asset: {game/name}')
    if not archive.is_file():
        parser.error(f'Base ZIP not found: {archive}')
    try:
        extract_runtime(archive, args.runtime.expanduser().resolve())
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        parser.error(str(error))
    subprocess.run([sys.executable, str(PROJECT/'scripts/prepare_assets.py'),
                    '--game-root', str(game), '--runtime', str(args.runtime.expanduser().resolve())], check=True)
    print('Assets ready. Run: python3 scripts/serve_dev.py')


if __name__ == '__main__':
    main()
