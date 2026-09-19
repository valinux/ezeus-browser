#!/usr/bin/env python3
"""Prepare local eZeus assets and record provenance without copying Steam data."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
from convert_eng import convert, require


PROJECT = Path(__file__).resolve().parents[1]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game-root', type=Path, required=True)
    parser.add_argument('--runtime', type=Path, default=PROJECT/'runtime/eZeus-0.8.2-beta')
    args = parser.parse_args()
    game = args.game_root.resolve()
    runtime = args.runtime.resolve()
    for file in ['interface.e', 'i15.e', 'i30.e', 'Fonts/Zeus.ttf', 'Text/language.txt']:
        require((runtime/file).is_file(), f'Missing runtime asset: {runtime/file}')
    for directory in ['DATA', 'Audio', 'Adventures', 'Model']:
        require((game/directory).is_dir(), f'Missing game assets: {game/directory}')
    conversions = [convert(game/f'{name}.eng', runtime/f'{name}.xml')
                   for name in ['Zeus_Text', 'Zeus_MM']]
    # eGameDir concatenates this relative path with SDL_GetBasePath() (Bin/).
    relative = Path(os.path.relpath(game, runtime/'Bin')).as_posix() + '/'
    (runtime/'zeus_path.txt').write_text(relative+'\n')
    files = []
    for origin, root, groups in [
        ('original-game', game, ['DATA', 'Audio', 'Adventures', 'Model']),
        ('ezeus-runtime', runtime, ['Fonts', 'Text', 'Sanctuaries', 'Adventures'])]:
        for group in groups:
            for path in sorted((root/group).rglob('*')):
                if path.is_file():
                    files.append({'origin': origin, 'path': path.relative_to(root).as_posix(),
                                  'bytes': path.stat().st_size, 'sha256': digest(path)})
    icon = game/'zeus.ico'
    require(icon.is_file(), 'Missing game window icon: zeus.ico')
    files.append({'origin': 'original-game', 'path': 'zeus.ico',
                  'bytes': icon.stat().st_size, 'sha256': digest(icon)})
    for name in ['interface.e', 'i15.e', 'i30.e', 'Zeus_Text.xml', 'Zeus_MM.xml']:
        path = runtime/name
        files.append({'origin': 'ezeus-runtime', 'path': name,
                      'bytes': path.stat().st_size, 'sha256': digest(path)})
    for entry in conversions:
        entry['source'] = Path(entry['source']).relative_to(game).as_posix()
        entry['output'] = Path(entry['output']).relative_to(runtime).as_posix()
    converter_repo = PROJECT/'toolchains/citybuilding-tools'
    upstream_commit = subprocess.check_output(
        ['git', '-C', str(converter_repo), 'rev-parse', 'HEAD'], text=True).strip() if converter_repo.exists() else None
    manifest = {'schema_version': 1, 'purpose': 'Local development inventory; not an asset redistribution bundle',
                'engine_tag': '0.8.2-beta.4', 'converter_reference_commit': upstream_commit,
                'original_game_relative_to_project': os.path.relpath(game, PROJECT),
                'runtime_relative_to_project': os.path.relpath(runtime, PROJECT),
                'zeus_path_relative_to_bin': relative, 'conversions': conversions, 'files': files}
    (PROJECT/'asset-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({'inventoried_files': len(files), 'bytes': sum(f['bytes'] for f in files),
                      'zeus_path': relative, 'manifest': 'asset-manifest.json'}, indent=2))


if __name__ == '__main__':
    main()
