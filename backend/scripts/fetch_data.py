"""Fetch the Elexon data used by the app and write data/snapshot/.

Run from backend/:  python -m scripts.fetch_data [--out DIR]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app import config, data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=config.Settings.from_env().snapshot_dir)
    args = parser.parse_args()

    base_url = config.Settings.from_env().elexon_base_url
    print(f"Fetching FUELHH and WINDFOR from {base_url} ...")
    actuals, forecasts = data.fetch_live(base_url)
    manifest = data.write_snapshot(args.out, actuals, forecasts)
    print(json.dumps(manifest, indent=2))
    print(f"Snapshot written to {args.out}")


if __name__ == "__main__":
    main()
