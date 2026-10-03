import argparse
import json
import re
import shutil
import sys
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parent.parent
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from backend.sign_catalogue import SUPPORTED_MEDIA_EXTENSIONS, validate_catalogue  # noqa: E402


CATALOGUE_PATH = APP_ROOT / "data" / "sign_catalogue.json"
DATASETS_DIR = APP_ROOT / "datasets"


def slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug or "asset"


def words_from_stem(stem):
    return re.sub(r"\s+", " ", stem.casefold()).strip().split(" ")


def entry_for_asset(asset_path):
    rel_path = asset_path.relative_to(APP_ROOT).as_posix()
    stem = asset_path.stem.casefold()
    is_char = len(stem) == 1 and stem.isalnum()
    return {
        "id": f"{'fingerspelling' if is_char else 'sign'}.dev.{slugify(stem)}",
        "entry_type": "fingerspelling" if is_char else "sign",
        "language": "unverified",
        "words": [stem] if is_char else words_from_stem(stem),
        "approved_aliases": [],
        "asset_path": rel_path,
        "source": "bundled repository asset; provenance unknown",
        "reuse_license": "unknown",
        "linguistic_review": "unreviewed",
        "release_status": "developer_preview",
        "notes": "Filename-derived catalogue entry. The filename is not proof that the video is correct ISL.",
    }


def generate_catalogue(_args):
    media_assets = sorted(
        path
        for path in DATASETS_DIR.iterdir()
        if path.is_file() and path.suffix.casefold() in SUPPORTED_MEDIA_EXTENSIONS
    )
    data = {
        "schema_version": 1,
        "catalogue_status": "developer_preview",
        "verification_notice": (
            "This catalogue is generated from repository filenames only. "
            "Language, sign correctness, source, licence, and reuse permissions are unverified."
        ),
        "entries": [entry_for_asset(path) for path in media_assets],
    }
    if CATALOGUE_PATH.exists():
        with CATALOGUE_PATH.open(encoding="utf-8") as handle:
            existing = json.load(handle)
        known_paths = {entry["asset_path"] for entry in existing["entries"]}
        additions = [entry for entry in data["entries"] if entry["asset_path"] not in known_paths]
        data = existing
        data["entries"] = existing["entries"] + additions
    ids = [entry["id"] for entry in data["entries"]]
    if len(ids) != len(set(ids)):
        print("Catalogue ID collision; no catalogue written. Resolve asset names first.", file=sys.stderr)
        return 1
    CATALOGUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CATALOGUE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")
    print(f"Wrote {len(data['entries'])} developer-preview entries to {CATALOGUE_PATH}")
    return 0


def validate(_args):
    report = validate_catalogue(CATALOGUE_PATH, APP_ROOT)
    print(json.dumps(report, indent=2))
    return 1 if report["errors"] else 0


def audit(_args):
    report = validate_catalogue(CATALOGUE_PATH, APP_ROOT)
    print(f"Catalogue entries: {report['entries']}")
    print(f"Verified release entries: {report['verified_release_entries']}")
    print(f"Developer-preview entries: {report['developer_preview_entries']}")
    print(
        "Fingerspelling coverage: "
        f"{report['fingerspelling_coverage']['present']}/{report['fingerspelling_coverage']['required']}"
    )
    if report["errors"]:
        print("\nErrors:")
        for error in report["errors"]:
            print(f"- {error}")
    if report["warnings"]:
        print("\nWarnings / needs human help:")
        for warning in report["warnings"]:
            print(f"- {warning}")
    return 1 if report["errors"] else 0


def import_dataset(args):
    source_dir = Path(args.source_dir).resolve()
    if not source_dir.exists() or not source_dir.is_dir():
        print(f"Source directory does not exist: {source_dir}", file=sys.stderr)
        return 2

    candidates = sorted(path for path in source_dir.iterdir() if path.is_file())
    planned = []
    collisions = []
    unsupported = []
    reserved_names = {path.name.casefold() for path in DATASETS_DIR.iterdir()} if DATASETS_DIR.exists() else set()
    reserved_ids = set()
    if CATALOGUE_PATH.exists():
        with CATALOGUE_PATH.open(encoding="utf-8") as handle:
            reserved_ids = {entry["id"] for entry in json.load(handle)["entries"]}

    for path in candidates:
        suffix = path.suffix.casefold()
        if suffix not in SUPPORTED_MEDIA_EXTENSIONS:
            unsupported.append(path.name)
            continue

        target_name = f"{slugify(path.stem).replace('-', ' ')}{suffix}"
        target = DATASETS_DIR / target_name
        entry_id = entry_for_asset(target)["id"]
        if path.is_symlink() or target_name.casefold() in reserved_names or entry_id in reserved_ids:
            collisions.append({"source": str(path), "target": str(target)})
        else:
            planned.append({"source": path, "target": target})
            reserved_names.add(target_name.casefold())
            reserved_ids.add(entry_id)

    print(f"Supported media candidates: {len(planned) + len(collisions)}")
    print(f"Will import: {len(planned)}")
    print(f"Collisions: {len(collisions)}")
    print(f"Unsupported files skipped: {len(unsupported)}")

    for collision in collisions:
        print(f"COLLISION: {collision['source']} -> {collision['target']}")
    for filename in unsupported:
        print(f"UNSUPPORTED: {filename}")

    if not args.apply:
        print("Dry run only. Re-run with --apply to copy non-colliding local files.")
        return 1 if collisions else 0

    if collisions:
        print("Import aborted: resolve all collisions before applying. No files copied.")
        return 1
    if not args.permission_confirmed:
        print("Import requires --permission-confirmed after you verify permission to copy these assets.", file=sys.stderr)
        return 2

    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    for item in planned:
        with item["source"].open("rb") as source, item["target"].open("xb") as target:
            shutil.copyfileobj(source, target)
        print(f"IMPORTED: {item['source']} -> {item['target']}")

    print("Import complete. Run `python scripts/manage_catalogue.py generate` then validate before committing.")
    return 1 if collisions else 0


def main():
    parser = argparse.ArgumentParser(description="Manage the local SignWave sign catalogue.")
    subparsers = parser.add_subparsers(required=True)

    generate_parser = subparsers.add_parser("generate", help="Generate developer-preview catalogue from local datasets/")
    generate_parser.set_defaults(func=generate_catalogue)

    validate_parser = subparsers.add_parser("validate", help="Validate catalogue metadata and asset coverage")
    validate_parser.set_defaults(func=validate)

    audit_parser = subparsers.add_parser("audit", help="Print a human-readable coverage report")
    audit_parser.set_defaults(func=audit)

    import_parser = subparsers.add_parser("import", help="Safely import local media files with collision reporting")
    import_parser.add_argument("source_dir", help="Local directory containing user-provided media files")
    import_parser.add_argument("--apply", action="store_true", help="Copy non-colliding files into datasets/")
    import_parser.add_argument("--permission-confirmed", action="store_true", help="Confirm you verified permission to copy the local media; does not mark entries as release-approved")
    import_parser.set_defaults(func=import_dataset)

    args = parser.parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
