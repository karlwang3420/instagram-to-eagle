"""Create an unsigned Firefox XPI, a Chrome ZIP and a matching source ZIP for this version."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
VERSION = MANIFEST["version"]
RUNTIME = [
    "manifest.json",
    "LICENSE",
    "popup/popup.html",
    "popup/popup.js",
    "popup/popup.css",
    "background/access.js",
    "shared/core.js",
    "page/posts.js",
    "page/stories.js",
    "background/index.js",
    "content/detection.js",
    "content/ui.js",
    "content/carousel-dom.js",
    "content/controls.js",
    "content/grid-controls.js",
    "sounds/success.ogg",
    *(f"icons/icon-{size}.png" for size in (16, 32, 48, 96, 128)),
]
CHROME = RUNTIME + ["sounds/chime.html"]
SOURCE = CHROME + [
    "icon.svg",
    "README.md",
    "CHANGELOG.md",
    "PRIVACY.md",
    ".gitignore",
    "artwork/instagram_to_eagle_icon-source.png",
    "tools/build_icons.py",
    "tools/package_extension.py",
    "tools/prepare_amo.py",
    *(str(path.relative_to(ROOT)).replace("\\", "/")
      for path in sorted((ROOT / "docs").rglob("*")) if path.is_file()),
    *(str(path.relative_to(ROOT)).replace("\\", "/")
      for path in sorted((ROOT / "tests").rglob("*")) if path.is_file()),
]


def chrome_files() -> dict[str, bytes]:
    """Chrome runs the Firefox background scripts in a service worker."""
    manifest = {key: value for key, value in MANIFEST.items() if key != "browser_specific_settings"}
    manifest["background"] = {"service_worker": "service-worker.js"}
    manifest["permissions"] = [*MANIFEST["permissions"], "offscreen"]
    scripts = ", ".join(json.dumps("/" + path) for path in MANIFEST["background"]["scripts"])
    return {
        "manifest.json": (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode(),
        "service-worker.js": f"importScripts({scripts});\n".encode(),
    }


def build(name: str, paths: list[str], generated: dict[str, bytes] | None = None) -> Path:
    generated = generated or {}
    output = ROOT / "dist" / name
    output.parent.mkdir(exist_ok=True)
    if output.exists():
        raise FileExistsError(f"Refusing to replace existing build: {output}")
    for relative in paths:
        if not (ROOT / relative).is_file():
            raise FileNotFoundError(relative)
    with ZipFile(output, "x", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in paths:
            if relative not in generated:
                archive.write(ROOT / relative, relative)
        for relative, data in generated.items():
            archive.writestr(relative, data)
    return output


if __name__ == "__main__":
    for result in (
        build(f"instagram-to-eagle-{VERSION}-unsigned.xpi", RUNTIME),
        build(f"instagram-to-eagle-{VERSION}-chrome.zip", CHROME, chrome_files()),
        build(f"instagram-to-eagle-{VERSION}-source.zip", SOURCE),
    ):
        print(f"Created {result} ({result.stat().st_size:,} bytes)")
