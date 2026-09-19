"""Binary fixtures exercise actual offsets, encoding, and corruption rejection."""
import struct
import unittest
import xml.etree.ElementTree as ET
from convert_eng import parse_text, parse_messages


class ConverterTests(unittest.TestCase):
    def test_text_ids_padding_and_encoding(self):
        b = bytearray(8028)
        b[:16] = b"Zeus textfile.\0\0"
        data = b"Hello & world\0\0caf\xe9\0"
        struct.pack_into("<ii", b, 28+7*8, 0, 2)
        root = parse_text(bytes(b)+data)
        self.assertEqual(root.find("group").get("id"), "7")
        self.assertEqual([s.text for s in root.findall("group/string")], ["Hello & world", "café"])
        self.assertEqual(ET.fromstring(ET.tostring(root)).find("group/string").text, "Hello & world")

    def test_rejects_out_of_range_text_offset(self):
        b = bytearray(8028)
        b[:16] = b"Zeus textfile.\0\0"
        struct.pack_into("<ii", b, 28+8, 9999, 1)
        with self.assertRaises(ValueError):
            parse_text(bytes(b)+b"x\0")

    def test_message_record_fields_and_content(self):
        b = bytearray(24+80)
        b[:16] = b"Zeus MM file.\0\0\0"
        struct.pack_into("<ii", b, 16, 1, 1)
        struct.pack_into("<2h", b, 24, 2, 3)
        struct.pack_into("<4h", b, 24+6, 10, 20, 30, 40)
        struct.pack_into("<2h", b, 24+26, 12, 13)
        struct.pack_into("<i", b, 24+56, 1)
        struct.pack_into("<i", b, 24+68, 1)
        struct.pack_into("<i", b, 24+76, 7)
        root = parse_messages(bytes(b)+b"\0Title\0Body\x0emore\0")
        m = root.find("message")
        self.assertEqual(m.get("urgent"), "true")
        self.assertEqual(m.find("dialog").get("height"), "40")
        self.assertEqual(m.find("title").get("x"), "12")
        self.assertEqual(m.find("title").text, "Title")
        self.assertEqual(m.find("content").text, "Body~more")

    def test_rejects_truncated_messages(self):
        with self.assertRaises(ValueError):
            parse_messages(b"Zeus MM file.\0\0\0")


if __name__ == "__main__":
    unittest.main()
