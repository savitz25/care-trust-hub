from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load_env() -> None:
    path = ROOT / ".env.local"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        if os.environ.get(k.strip()) in (None, ""):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def main() -> None:
    load_env()
    DATA.mkdir(parents=True, exist_ok=True)
    from care_ingest.downloader import download_source
    from care_ingest.registry import get_source

    results = {}
    for key in (
        "nursing-home-mds-quality-measures",
        "nursing-home-fire-safety-deficiencies",
    ):
        path, manifest = download_source(get_source(key), DATA, timeout=600)
        results[key] = {
            "path": str(path),
            "release": manifest.source_release_date,
            "sha256": manifest.sha256,
            "bytes": manifest.byte_size,
        }
        print(json.dumps(results[key], indent=2))
    (ROOT / "docs" / "sen-nat-002-download.json").write_text(
        json.dumps(results, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
