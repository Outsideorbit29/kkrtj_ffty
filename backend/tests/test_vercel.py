"""The root requirements.txt (Vercel) must pin the same versions as backend/requirements.txt."""

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def _pins(path: Path) -> dict[str, str]:
    pins = {}
    for line in path.read_text().splitlines():
        spec = line.split("#")[0].strip()
        if spec:
            name, version = spec.split("==")
            pins[name.split("[")[0]] = version
    return pins


def test_vercel_requirements_match_backend():
    vercel = _pins(REPO / "requirements.txt")
    backend = _pins(REPO / "backend" / "requirements.txt")
    assert vercel, "root requirements.txt is empty"
    assert {name: backend.get(name) for name in vercel} == vercel
