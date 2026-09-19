import unittest
from package_release import sanitize_assertion_paths


class PackageTests(unittest.TestCase):
    def test_only_path_bytes_change_and_length_is_preserved(self):
        wasm = b'\x00asm\x01\x00\x00\x00\x00/temporary/build/source/widgets/test.cpp\x00remaining'
        sanitized, count = sanitize_assertion_paths(wasm, '/temporary/build/source/')
        self.assertEqual(len(wasm), len(sanitized))
        self.assertEqual(count, 1)
        self.assertIn(b'widgets/test.cpp\x00remaining', sanitized)
        self.assertNotIn(b'/temporary/build/source/', sanitized)

    def test_rejects_non_diagnostic_occurrence(self):
        with self.assertRaises(ValueError):
            sanitize_assertion_paths(b'\x00asm\x01\x00\x00\x00/tmp/build/source/data.bin\x00', '/tmp/build/source/')


if __name__ == '__main__':
    unittest.main()
