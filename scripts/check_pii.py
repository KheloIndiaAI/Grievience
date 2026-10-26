#!/usr/bin/env python3
"""
PII guard for the public build — CI gate (also used by the offline redaction step).

    python3 scripts/check_pii.py public/data/grievances.json dist

Fails (exit 1) if the dataset is not marked redacted, if any forbidden field
name exists in its records, or if any string looks like a mobile number, email
address, Aadhaar or PAN. Built output dirs get the same scan on data/HTML files
and a serialised-PII signature check on JS/CSS bundles.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

FORBIDDEN_KEYS = {"name", "mobile", "email", "address", "description", "reply", "remarks", "text", "phone"}

PATTERNS = {
    "mobile": re.compile(r"(?<![\d.])(?:\+?91[\s-]?)?[6-9]\d{9}(?![\d.])"),
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}"),
    "aadhaar": re.compile(r"(?<!\d)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)"),
    "pan": re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"),
}
# Free text can carry names/addresses that no pattern catches, so every published
# string must be label-sized. `path` is a chain of office codes and is checked by shape.
MAX_LABEL_LEN = 150
PATH_SHAPE = re.compile(r"[A-Za-z0-9?]+(?: > [A-Za-z0-9?]+)*")   # "?" = unknown office
# Data-bearing build files get the full pattern scan.
DATA_EXT = {".html", ".json", ".txt", ".csv", ".svg"}
# Minified JS/CSS is mostly library code, where version strings and hashes look like
# numbers (e.g. React's "f1338f8080-20240426"), so those files get a signature check
# instead: the internal dataset serialised into a bundle would show quoted PII keys.
CODE_EXT = {".js", ".mjs", ".css", ".map"}
CODE_SIGNATURE = re.compile(r'"(?:name|mobile|email|address|remarks|description|reply)"\s*:\s*"[^"]{3,}')


def _walk(o, path="$"):
    if isinstance(o, dict):
        for k, v in o.items():
            yield path, k, v
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from _walk(v, f"{path}[{i}]")


def scan_strings(text: str, where: str) -> list[str]:
    out = []
    for kind, rx in PATTERNS.items():
        m = rx.search(text)
        if m:
            out.append(f"{where}: {kind}-like value at offset {m.start()}")
    return out


def scan_build(dist: Path) -> list[str]:
    out = []
    for f in sorted(dist.rglob("*")):
        if not f.is_file():
            continue
        if f.suffix == ".json":
            try:
                out += [f"{f}: {p}" for p in scan_dataset(json.loads(f.read_text(encoding="utf-8")))] \
                    if f.name == "grievances.json" else scan_strings(f.read_text(encoding="utf-8"), str(f))
            except ValueError:
                out.append(f"{f}: not valid JSON")
        elif f.suffix in DATA_EXT:
            out += scan_strings(f.read_text(encoding="utf-8", errors="ignore"), str(f))
        elif f.suffix in CODE_EXT:
            m = CODE_SIGNATURE.search(f.read_text(encoding="utf-8", errors="ignore"))
            if m:
                out.append(f"{f}: personal-data field serialised into bundle at offset {m.start()}")
    return out


def scan_dataset(ds: dict) -> list[str]:
    problems = []
    if ds.get("redacted") is not True:
        problems.append("dataset is not marked redacted:true (was the internal export copied by mistake?)")
    for path, k, v in _walk(ds):
        if k in FORBIDDEN_KEYS and path.startswith("$.records"):
            problems.append(f"{path}: forbidden field '{k}'")
        if isinstance(v, str):
            problems += scan_strings(v, f"{path}.{k}")
            if path.startswith("$.records"):
                if k == "path":
                    if v and not PATH_SHAPE.fullmatch(v):
                        problems.append(f"{path}.path: not a chain of office codes")
                elif len(v) > MAX_LABEL_LEN:
                    problems.append(f"{path}.{k}: {len(v)}-char value — free text is not allowed in the public dataset")
    return problems


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    problems = scan_dataset(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    for d in sys.argv[2:]:
        problems += scan_build(Path(d))
    if problems:
        print("PII CHECK FAILED")
        for p in problems[:50]:
            print("  " + p)
        if len(problems) > 50:
            print(f"  ... and {len(problems) - 50} more")
        return 1
    print("PII check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
