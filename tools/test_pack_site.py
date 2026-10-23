import base64
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


class PackagingTests(unittest.TestCase):
    def package(self, html, directory):
        script = Path(__file__).with_name('pack_site.py')
        self.assertTrue(script.exists(), 'Optimized site packer has not been implemented')
        spec = importlib.util.spec_from_file_location('pack_site', script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        source = directory / 'original.html'
        source.write_text(html, encoding='utf-8')
        output = directory / 'site'
        module.package(source, output)
        return output

    def fixture(self, assets):
        scripts = []
        for key, value in assets.items():
            for offset in range(0, len(value), 65537):
                encoded = base64.b64encode(value[offset:offset + 65537]).decode()
                scripts.append(f'<script>parts.push(decode("{encoded}"));document.currentScript.remove();</script>')
            scripts.append('<script>urls[' + json.dumps(key) + ']=URL.createObjectURL(new Blob(parts,{type:"application/octet-stream"}));parts.length=0;document.currentScript.remove();</script>')
        scripts.append('<script>function createUnityInstance(){return Promise.resolve({});}</script>')
        return ''.join(scripts)

    def test_original_unity_bytes_survive_compression_and_reassembly(self):
        assets = {'dataUrl': bytes(range(256)) * 9000, 'frameworkUrl': b'window.framework=true;', 'codeUrl': b'\0asm\1\0\0\0'}
        with tempfile.TemporaryDirectory() as name:
            output = self.package(self.fixture(assets), Path(name))
            manifest = json.loads((output / 'manifest.json').read_text())
            for key, expected in assets.items():
                asset = manifest['assets'][key]
                actual = bytearray()
                for chunk in asset['chunks']:
                    compressed = (output / chunk['url']).read_bytes()
                    self.assertEqual(hashlib.sha256(compressed).hexdigest(), chunk['sha256'])
                    actual.extend(gzip.decompress(compressed))
                self.assertEqual(bytes(actual), expected)
                self.assertEqual(asset['sha256'], hashlib.sha256(expected).hexdigest())
            self.assertLess((output / 'index.html').stat().st_size, 65536)

    def test_missing_unity_asset_is_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            with self.assertRaisesRegex(ValueError, 'codeUrl'):
                self.package(self.fixture({'dataUrl': b'data', 'frameworkUrl': b'js'}), Path(name))

if __name__ == '__main__':
    unittest.main()
