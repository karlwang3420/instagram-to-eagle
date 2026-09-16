"""Bundle an existing tested XPI with AMO materials, without changing it.

The reviewer source ZIP can reproduce the original runtime members with:
    python tools/prepare_amo.py --rebuild-reviewed
"""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import runpy
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_source(name: str) -> Path:
    relative = PurePosixPath(name)
    if relative.is_absolute() or ".." in relative.parts or "\\" in name:
        raise ValueError(f"Invalid archive path: {name}")
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f"Missing or unsafe source path: {name}")
    return path


def write_archive(output: Path, files: dict[str, bytes]) -> None:
    with ZipFile(output, "x", ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError(f"Archive integrity check failed: {output}")


def rebuild_reviewed() -> None:
    record = json.loads((ROOT / "REVIEWED-RUNTIME.json").read_text(encoding="utf-8"))
    files = {}
    for member in record["files"]:
        data = safe_source(member["path"]).read_bytes()
        if digest(data) != member["sha256"]:
            raise ValueError(f"Runtime file differs from reviewed XPI: {member['path']}")
        files[member["path"]] = data
    output_dir = ROOT / "dist"
    output_dir.mkdir(exist_ok=True)
    output = output_dir / "reviewed-runtime-rebuilt.xpi"
    write_archive(output, files)
    print(f"Rebuilt {len(files)} verified runtime members: {output}")
    print("ZIP timestamps can differ; runtime member bytes match the original XPI.")


def prepare() -> None:
    packaging = runpy.run_path(str(ROOT / "tools" / "package_extension.py"))
    version = packaging["VERSION"]
    artifact = ROOT / "dist" / f"instagram-to-eagle-{version}-unsigned.xpi"
    original = artifact.read_bytes()
    with ZipFile(artifact) as archive:
        if archive.testzip() is not None:
            raise ValueError("The existing XPI failed its integrity check")
        names = archive.namelist()
        if len(set(names)) != len(names):
            raise ValueError("Duplicate runtime archive members")
        required = set(packaging["RUNTIME"]) - {"LICENSE"}
        if set(names) not in (required, set(packaging["RUNTIME"])):
            raise ValueError("Existing XPI has an unexpected runtime file set")
        runtime = {name: archive.read(name) for name in names}
    for name, data in runtime.items():
        if safe_source(name).read_bytes() != data:
            raise ValueError(f"Current source differs from tested XPI: {name}")
    if json.loads(runtime["manifest.json"])["version"] != version:
        raise ValueError("XPI and source manifest versions differ")

    outputs = [
        artifact.parent / f"instagram-to-eagle-{version}-amo-source.zip",
        artifact.parent / f"instagram-to-eagle-{version}-amo-submission.zip",
    ]
    for output in outputs:
        if output.exists():
            raise FileExistsError(f"Refusing to replace existing package: {output}")

    record = {
        "version": version,
        "original_xpi": artifact.name,
        "original_sha256": digest(original),
        "files": [{"path": name, "sha256": digest(data)}
                  for name, data in runtime.items()],
    }
    source = {name: safe_source(name).read_bytes() for name in packaging["SOURCE"]}
    source["REVIEWED-RUNTIME.json"] = (json.dumps(record, indent=2) + "\n").encode()
    source["BUILD-REVIEW.md"] = (
        f"# Reviewing version {version}\n\n"
        "The submitted runtime is plain JavaScript, HTML, CSS, and checked-in PNGs. "
        "No runtime build or dependency installation is required.\n\n"
        "To reconstruct the exact original runtime member contents, extract this ZIP "
        "to an empty directory and run with Python 3.10 or newer:\n\n"
        "```sh\npython tools/prepare_amo.py --rebuild-reviewed\n```\n\n"
        "This verifies each file against REVIEWED-RUNTIME.json before creating "
        "dist/reviewed-runtime-rebuilt.xpi. ZIP timestamps and therefore the overall "
        "archive hash may differ; member contents must match. The helper uses only "
        "the Python standard library and refuses to overwrite an existing output.\n\n"
        "The source archive also includes publication documentation and the "
        "publisher's MIT license. The review reconstruction follows the submitted "
        "XPI member list exactly, including LICENSE when present.\n\n"
        f"Original XPI SHA-256: `{digest(original)}`\n"
    ).encode()
    write_archive(outputs[0], source)

    materials = {
        artifact.name: original,
        outputs[0].name: outputs[0].read_bytes(),
        "README.md": (ROOT / "README.md").read_bytes(),
        "CHANGELOG.md": (ROOT / "CHANGELOG.md").read_bytes(),
        "LICENSE": (ROOT / "LICENSE").read_bytes(),
        "PRIVACY.md": (ROOT / "PRIVACY.md").read_bytes(),
        "icons/icon-128.png": (ROOT / "icons" / "icon-128.png").read_bytes(),
    }
    for path in sorted((ROOT / "docs").rglob("*")):
        if path.is_file():
            materials[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    write_archive(outputs[1], materials)
    if artifact.read_bytes() != original:
        raise ValueError("The tested XPI changed during preparation")
    for output in outputs:
        print(f"Created {output} ({output.stat().st_size:,} bytes)")
    print(f"Tested XPI preserved: SHA-256 {digest(original)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rebuild-reviewed", action="store_true")
    args = parser.parse_args()
    if args.rebuild_reviewed:
        rebuild_reviewed()
    else:
        prepare()
