#!/usr/bin/env python3
"""Convert player-owned Zeus ENG text/message files to eZeus-compatible XML.

Uses only Python's standard library. Binary layouts and XML conventions are
adapted from Bianca van Schaik's MIT-licensed citybuilding-tools EngConverter:
https://github.com/bvschaik/citybuilding-tools/tree/master/engconverter
See THIRD_PARTY_NOTICES.md. Original game text is never bundled with this tool.
"""

import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET


def require(condition, message):
    if not condition:
        raise ValueError(message)


def decode(raw, encoding):
    text = raw.decode(encoding).replace("\x0e", "~")
    require(all(ord(c) >= 32 or c in "\t\n\r" for c in text),
            "Text contains characters invalid in XML 1.0")
    return text


def cstring(data, offset, encoding):
    require(0 <= offset < len(data), f"String offset outside data: {offset}")
    end = data.find(b"\0", offset)
    require(end >= 0, f"Unterminated string at offset {offset}")
    return decode(data[offset:end], encoding)


def parse_text(blob, encoding="cp1252"):
    require(len(blob) >= 8028, "Truncated text header or index")
    require(blob[:16].split(b"\0", 1)[0] == b"Zeus textfile.", "Not a Zeus text ENG")
    entries = [(i, *struct.unpack_from("<ii", blob, 28 + 8*i)) for i in range(1000)]
    require(all(count >= 0 for _, _, count in entries), "Negative group count")
    groups = [(i, offset, count) for i, offset, count in entries if count]
    data = blob[8028:]
    root = ET.Element("strings", name="Zeus textfile.",
                      indexWithCounts="true" if any(g[2] > 1 for g in groups) else "false")
    for n, (gid, start, count) in enumerate(groups):
        end = groups[n+1][1] if n+1 < len(groups) else len(data)
        require(0 <= start <= end <= len(data), f"Invalid offsets for group {gid}")
        region = data[start:end]
        require(not region or region.endswith(b"\0"), f"Unterminated group {gid}")
        # EngConverter skips repeated NUL padding used in some retail files.
        strings = [part for part in region.split(b"\0") if part]
        if root.get("indexWithCounts") == "true":
            require(len(strings) == count, f"Group {gid}: expected {count} strings, found {len(strings)}")
        group = ET.SubElement(root, "group", id=str(gid))
        for sid, raw in enumerate(strings):
            ET.SubElement(group, "string", id=str(sid)).text = decode(raw, encoding)
    return root


def parse_messages(blob, encoding="cp1252"):
    require(len(blob) >= 24, "Truncated message header")
    require(blob[:16].split(b"\0", 1)[0] == b"Zeus MM file.", "Not a Zeus message ENG")
    total, used = struct.unpack_from("<ii", blob, 16)
    require(0 <= used <= total <= 10000, "Invalid message counts")
    data_start = 24 + total*80
    require(data_start <= len(blob), "Truncated message index")
    data = blob[data_start:]
    root = ET.Element("messages", name="Zeus MM file.", entries=str(total))
    for mid in range(total):
        rec = blob[24+80*mid:24+80*(mid+1)]
        if not any(rec):
            continue
        shorts = struct.unpack_from("<21h", rec)
        urgent, video, unused, title, subtitle, content = struct.unpack_from("<6i", rec, 56)
        attributes = {"id": str(mid), "type": str(shorts[0]), "subtype": str(shorts[1])}
        if urgent:
            attributes["urgent"] = "true"
        message = ET.SubElement(root, "message", attributes)
        ET.SubElement(message, "dialog", dict(zip(("x", "y", "width", "height"), map(str, shorts[3:7]))))
        for tag, vals in (("image", shorts[7:10]), ("image2", shorts[10:13])):
            if any(vals):
                ET.SubElement(message, tag, dict(zip(("graphic", "x", "y"), map(str, vals))))
        for tag, offset, position in (("title", title, shorts[13:15]),
                                      ("subtitle", subtitle, shorts[15:17]),
                                      ("video", video, shorts[19:21])):
            if offset:
                element = ET.SubElement(message, tag, dict(zip(("x", "y"), map(str, position))))
                element.text = cstring(data, offset, encoding)
        if content:
            ET.SubElement(message, "content").text = cstring(data, content, encoding)
    return root


def convert(source, destination, encoding="cp1252"):
    require(source.resolve() != destination.resolve(), "Output must not overwrite the source")
    blob = source.read_bytes()
    if blob.startswith(b"Zeus textfile."):
        root = parse_text(blob, encoding)
    elif blob.startswith(b"Zeus MM file."):
        root = parse_messages(blob, encoding)
    else:
        raise ValueError("Unsupported ENG signature; only Zeus text and message files are supported")
    ET.indent(root, space="    ")
    xml = ET.tostring(root, encoding="utf-8", xml_declaration=True, short_empty_elements=False) + b"\n"
    ET.fromstring(xml)  # Verify valid XML before replacing the destination.
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_bytes(xml)
    temporary.replace(destination)
    return {"source": str(source), "output": str(destination), "encoding": encoding,
            "source_sha256": hashlib.sha256(blob).hexdigest(),
            "output_sha256": hashlib.sha256(xml).hexdigest(),
            "groups": len(root.findall("group")), "strings": len(root.findall("group/string")),
            "messages": len(root.findall("message"))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--encoding", default="cp1252", help="Source text encoding (default: cp1252)")
    args = parser.parse_args()
    try:
        print(json.dumps(convert(args.source, args.destination, args.encoding), indent=2))
    except (ValueError, UnicodeError, OSError) as error:
        parser.exit(1, f"Conversion failed: {error}\n")


if __name__ == "__main__":
    main()
