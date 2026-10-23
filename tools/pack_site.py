"""Publish the exact embedded Unity assets as compressed, independently cacheable chunks."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil

CHUNK_SIZE = 2 * 1024 * 1024
MIMES = {'dataUrl': 'application/octet-stream', 'frameworkUrl': 'application/javascript', 'codeUrl': 'application/wasm'}


def package(source, output):
    text = Path(source).read_text(encoding='utf-8')
    assets = {}
    pending = bytearray()
    loader = None
    for match in re.finditer(r'<script>(.*?)</script>', text, re.DOTALL):
        script = match.group(1)
        encoded = re.search(r'parts\.push\(decode\("([A-Za-z0-9+/=]+)"\)\)', script)
        if encoded:
            pending.extend(base64.b64decode(encoded.group(1), validate=True))
        elif script.startswith('urls['):
            key = json.loads(script[5:script.index(']')])
            assets[key] = pending
            pending = bytearray()
        elif 'function createUnityInstance(' in script:
            loader = script
    for key in MIMES:
        if not assets.get(key):
            raise ValueError('Missing Unity asset: ' + key)
    if not loader:
        raise ValueError('Missing Unity loader')
    output = Path(output)
    (output / 'assets').mkdir(parents=True, exist_ok=True)
    manifest = {'version': '5.9.62', 'assets': {}}
    for key, content in assets.items():
        chunks = []
        for offset in range(0, len(content), CHUNK_SIZE):
            raw = content[offset:offset + CHUNK_SIZE]
            compressed = gzip.compress(raw, compresslevel=9, mtime=0)
            digest = hashlib.sha256(compressed).hexdigest()
            url = 'assets/' + digest + '.bin'
            (output / url).write_bytes(compressed)
            chunks.append({'url': url, 'offset': offset, 'size': len(raw), 'compressedSize': len(compressed), 'sha256': digest})
        manifest['assets'][key] = {'size': len(content), 'mime': MIMES[key], 'sha256': hashlib.sha256(content).hexdigest(), 'chunks': chunks}
    (output / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
    (output / 'unity-loader.js').write_text(loader, encoding='utf-8')
    templates = Path(__file__).resolve().parents[1] / 'web'
    for name in ('index.html', 'boot.js'):
        shutil.copyfile(templates / name, output / name)
    (output / '.nojekyll').touch()
    summary = {key: {'originalBytes': asset['size'], 'downloadBytes': sum(part['compressedSize'] for part in asset['chunks']), 'chunks': len(asset['chunks']), 'sha256': asset['sha256']} for key, asset in manifest['assets'].items()}
    print(json.dumps(summary, indent=2))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    package(Path(args.input), Path(args.output))
