"""Create an unsigned Firefox XPI and matching source ZIP for this version."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
RUNTIME = [
    "manifest.json",
    "popup.html",
    "popup.js",
    "popup.css",
    "access.js",
    "core.js",
    "extractor.js",
    "stories.js",
    "background.js",
    "carousel-dom.js",
    "content.js",
    "profile-controls.js",
    *(f"icons/icon-{size}.png" for size in (16, 32, 48, 96, 128)),
]
SOURCE = RUNTIME + [
    "icon.svg",
    "README.md",
    "CHANGELOG.md",
    "docs/DEVELOPMENT.md",
    ".gitignore",
    "artwork/instagram_to_eagle_icon-source.png",
    "tools/build_icons.py",
    "tools/package_extension.py",
    *(str(path.relative_to(ROOT)).replace("\\", "/")
      for path in sorted((ROOT / "tests").iterdir()) if path.is_file()),
]


def build(name: str, paths: list[str]) -> Path:
    output = ROOT / "dist" / name
    if output.exists():
        raise FileExistsError(f"Refusing to replace existing build: {output}")
    for relative in paths:
        if not (ROOT / relative).is_file():
            raise FileNotFoundError(relative)
    with ZipFile(output, "x", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in paths:
            archive.write(ROOT / relative, relative)
    return output


if __name__ == "__main__":
    for result in (
        build(f"instagram-to-eagle-{VERSION}-unsigned.xpi", RUNTIME),
        build(f"instagram-to-eagle-{VERSION}-source.zip", SOURCE),
    ):
        print(f"Created {result} ({result.stat().st_size:,} bytes)")
