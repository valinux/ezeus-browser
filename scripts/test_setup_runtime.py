import stat
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipInfo
from setup_runtime import BASE_FOLDER, extract_runtime, runtime_path


class RuntimeSetupTests(unittest.TestCase):
    def test_selects_runtime_assets_not_windows_binaries_or_saves(self):
        self.assertEqual(str(runtime_path(ZipInfo(BASE_FOLDER+'/Fonts/Zeus.ttf'))), 'Fonts/Zeus.ttf')
        self.assertEqual(str(runtime_path(ZipInfo(BASE_FOLDER+'/i15.e'))), 'i15.e')
        for name in ['Bin/eZeus.exe', 'Save/a.ez', 'foo.dll', 'README.txt']:
            self.assertIsNone(runtime_path(ZipInfo(BASE_FOLDER+'/'+name)))

    def test_rejects_traversal_and_symlinks(self):
        for name in ['/tmp/a', BASE_FOLDER+'/../../a', BASE_FOLDER+'\\..\\a', 'unexpected/file']:
            with self.assertRaises(ValueError):
                runtime_path(ZipInfo(name))
        link = ZipInfo(BASE_FOLDER+'/Fonts/link')
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaises(ValueError):
            runtime_path(link)

    def test_wrong_checksum_writes_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory)/'wrong.zip'
            archive.write_bytes(b'not the expected release')
            destination = Path(directory)/'runtime'
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                extract_runtime(archive, destination)
            self.assertFalse(destination.exists())


if __name__ == '__main__':
    unittest.main()
