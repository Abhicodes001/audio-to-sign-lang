import json
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote


APP_ROOT = Path(__file__).resolve().parent.parent
CATALOGUE_PATH = APP_ROOT / "data" / "sign_catalogue.json"
SUPPORTED_MEDIA_EXTENSIONS = {".mp4", ".webm"}
REQUIRED_METADATA_FIELDS = {
    "id",
    "entry_type",
    "language",
    "words",
    "approved_aliases",
    "asset_path",
    "source",
    "reuse_license",
    "linguistic_review",
    "release_status",
}


def normalize_text(value):
    return re.sub(r"\s+", " ", str(value or "").casefold()).strip()


def tokenize_with_boundaries(text):
    tokens = []
    for match in re.finditer(r"[^\W_]+(?:['\u2019][^\W_]+)*", text or ""):
        original = match.group(0)
        tokens.append(
            {
                "text": original,
                "normalized": normalize_text(original),
                "start": match.start(),
                "end": match.end(),
                "phrase_break_before": bool(re.search(r"[^\s]", (text or "")[tokens[-1]["end"]:match.start()])) if tokens else False,
            }
        )
    return tokens


def token_key(words):
    return tuple(normalize_text(word) for word in words if normalize_text(word))


@dataclass(frozen=True)
class SignEntry:
    raw: dict

    @property
    def id(self):
        return self.raw["id"]

    @property
    def entry_type(self):
        return self.raw["entry_type"]

    @property
    def words(self):
        return self.raw["words"]

    @property
    def asset_path(self):
        return self.raw["asset_path"]

    def public_dict(self):
        return {
            "id": self.id,
            "entry_type": self.entry_type,
            "language": self.raw["language"],
            "words": self.words,
            "asset_path": self.asset_path,
            "source": self.raw["source"],
            "reuse_license": self.raw["reuse_license"],
            "linguistic_review": self.raw["linguistic_review"],
            "release_status": self.raw["release_status"],
        }


class SignCatalogue:
    def __init__(self, catalogue_path=CATALOGUE_PATH, app_root=APP_ROOT, release_only=False):
        self.catalogue_path = Path(catalogue_path)
        self.app_root = Path(app_root)
        self.release_only = release_only
        self.entries = []
        self.phrase_index = {}
        self.alias_index = {}
        self.fingerspelling_index = {}
        self.max_phrase_length = 1
        self.load()

    def load(self):
        with self.catalogue_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)

        self.entries = [SignEntry(entry) for entry in data.get("entries", [])]
        self.phrase_index = {}
        self.alias_index = {}
        self.fingerspelling_index = {}
        self.max_phrase_length = 1

        for entry in self.entries:
            if self.release_only and not is_verified_release(entry.raw):
                continue
            if entry.entry_type == "fingerspelling":
                key = normalize_text(" ".join(entry.words))
                if key:
                    self.fingerspelling_index[key] = entry
                continue

            key = token_key(entry.words)
            if key:
                self.phrase_index[key] = entry
                self.max_phrase_length = max(self.max_phrase_length, len(key))

            for alias in entry.raw.get("approved_aliases", []):
                alias_key = token_key(alias.get("words", []))
                if alias_key and alias.get("reviewed", False):
                    self.alias_index[alias_key] = entry
                    self.max_phrase_length = max(self.max_phrase_length, len(alias_key))

    def asset_url(self, entry):
        if asset_problem(entry.asset_path, self.app_root):
            return None
        return "/" + quote(Path(entry.asset_path).as_posix(), safe="/")

    def match_tokens(self, tokens):
        sequence = []
        index = 0
        while index < len(tokens):
            match = self._find_longest_match(tokens, index)
            if match:
                entry, end_index, match_type = match
                sequence.append(self._entry_item(tokens[index:end_index], entry, match_type))
                index = end_index
                continue
            sequence.extend(self._fingerspell_token(tokens[index]))
            index += 1
        return sequence

    def _find_longest_match(self, tokens, start_index):
        max_end = min(len(tokens), start_index + self.max_phrase_length)
        for end_index in range(max_end, start_index, -1):
            if any(token.get("phrase_break_before") for token in tokens[start_index + 1:end_index]):
                continue
            key = tuple(token["normalized"] for token in tokens[start_index:end_index])
            if key in self.phrase_index:
                match_type = "phrase" if len(key) > 1 else "exact_word"
                return self.phrase_index[key], end_index, match_type
        for end_index in range(max_end, start_index, -1):
            if any(token.get("phrase_break_before") for token in tokens[start_index + 1:end_index]):
                continue
            key = tuple(token["normalized"] for token in tokens[start_index:end_index])
            if key in self.alias_index:
                return self.alias_index[key], end_index, "reviewed_alias"
        return None

    def _entry_item(self, tokens, entry, match_type):
        url = self.asset_url(entry)
        return {
            "type": ("word" if len(tokens) == 1 else "phrase") if url else "unsupported",
            "match_type": match_type,
            "fallback_reason": None if url else "missing_or_unsupported_asset",
            "original_text": " ".join(token["text"] for token in tokens),
            "normalized_text": " ".join(token["normalized"] for token in tokens),
            "boundary": {"start": tokens[0]["start"], "end": tokens[-1]["end"]},
            "catalogue_entry": entry.public_dict(),
            "word": " ".join(entry.words),
            "url": url,
        }

    def _fingerspell_token(self, token):
        items = []
        for offset, char in enumerate(token["text"]):
            normalized_char = normalize_text(char)
            entry = self.fingerspelling_index.get(normalized_char)
            boundary = {"start": token["start"] + offset, "end": token["start"] + offset + 1}
            if entry and self.asset_url(entry):
                items.append(
                    {
                        "type": "letter" if normalized_char.isalpha() else "digit",
                        "match_type": "fingerspelling",
                        "fallback_reason": "no_catalogue_word_or_phrase_match",
                        "original_text": char,
                        "normalized_text": normalized_char,
                        "parent_word": token["text"],
                        "word_boundary": {"start": token["start"], "end": token["end"]},
                        "boundary": boundary,
                        "catalogue_entry": entry.public_dict(),
                        "word": normalized_char,
                        "url": self.asset_url(entry),
                    }
                )
            else:
                items.append(
                    {
                        "type": "unsupported",
                        "match_type": "unsupported_character",
                        "fallback_reason": "missing_fingerspelling_asset",
                        "original_text": char,
                        "normalized_text": normalized_char,
                        "parent_word": token["text"],
                        "word_boundary": {"start": token["start"], "end": token["end"]},
                        "boundary": boundary,
                        "catalogue_entry": None,
                        "word": normalized_char,
                        "url": None,
                    }
                )
        return items


def load_catalogue(catalogue_path=CATALOGUE_PATH, app_root=APP_ROOT, release_only=False):
    return SignCatalogue(catalogue_path=catalogue_path, app_root=app_root, release_only=release_only)


def asset_problem(asset_path, app_root):
    if not isinstance(asset_path, str) or not asset_path.strip():
        return "missing asset path"
    path = Path(asset_path)
    try:
        resolved = (app_root / path).resolve()
        resolved.relative_to((app_root / "datasets").resolve())
    except (ValueError, OSError):
        return f"asset path escapes datasets directory: {asset_path}"
    if path.is_absolute() or "\\" in asset_path:
        return f"asset path must be application-relative with forward slashes: {asset_path}"
    if resolved.suffix.casefold() not in SUPPORTED_MEDIA_EXTENSIONS:
        return f"unsupported media format {asset_path}"
    if not resolved.is_file():
        return f"missing asset {asset_path}"
    return None


def is_verified_release(entry):
    return (entry.get("release_status") == "verified_release"
            and entry.get("language") == "isl"
            and entry.get("linguistic_review") == "reviewed"
            and entry.get("source") not in (None, "", "unknown", "bundled repository asset; provenance unknown")
            and entry.get("reuse_license") not in (None, "", "unknown"))


def validate_catalogue(catalogue_path=CATALOGUE_PATH, app_root=APP_ROOT):
    catalogue_path = Path(catalogue_path)
    app_root = Path(app_root)
    with catalogue_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    errors = []
    warnings = []
    entries = data.get("entries", [])
    seen_ids = set()
    seen_terms = {}
    seen_aliases = {}
    catalogue_assets = set()
    fingerspelling_chars = set()
    seen_characters = set()

    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("entry must be an object")
            continue
        entry_id = entry.get("id", "<missing id>")
        missing = sorted(field for field in REQUIRED_METADATA_FIELDS if field not in entry)
        if missing:
            errors.append(f"{entry_id}: missing metadata fields: {', '.join(missing)}")
        invalid_fields = [field for field in REQUIRED_METADATA_FIELDS - {"words", "approved_aliases"}
                          if field in entry and not isinstance(entry[field], str)]
        words = entry.get("words", [])
        aliases = entry.get("approved_aliases", [])
        if not isinstance(words, list) or any(not isinstance(word, str) or not word.strip() for word in words):
            invalid_fields.append("words")
        if not isinstance(aliases, list) or any(
            not isinstance(alias, dict) or not isinstance(alias.get("words"), list)
            or not alias["words"] or any(not isinstance(word, str) or not word.strip() for word in alias["words"])
            or not isinstance(alias.get("reviewed"), bool) for alias in aliases
        ):
            invalid_fields.append("approved_aliases")
        if invalid_fields:
            errors.append(f"{entry_id}: invalid metadata types: {', '.join(sorted(invalid_fields))}")
            continue
        for field in REQUIRED_METADATA_FIELDS - {"approved_aliases"}:
            if field in entry and not entry[field]:
                errors.append(f"{entry_id}: empty metadata field: {field}")
        if entry.get("entry_type") not in {"sign", "fingerspelling"}:
            errors.append(f"{entry_id}: invalid entry_type")
        if entry.get("release_status") not in {"developer_preview", "verified_release"}:
            errors.append(f"{entry_id}: invalid release_status")
        if entry.get("release_status") == "verified_release" and not is_verified_release(entry):
            errors.append(f"{entry_id}: verified release requires ISL language, reviewed linguistics, source and licence")
        if entry_id in seen_ids:
            errors.append(f"{entry_id}: duplicate id")
        seen_ids.add(entry_id)

        asset_path = entry.get("asset_path")
        problem = asset_problem(asset_path, app_root)
        if problem:
            errors.append(f"{entry_id}: {problem}")
        if asset_path:
            if asset_path in catalogue_assets:
                errors.append(f"{entry_id}: duplicate asset path {asset_path}")
            catalogue_assets.add(asset_path)

        key = token_key(entry.get("words", []))
        if entry.get("entry_type") == "fingerspelling":
            if len(key) != 1 or key[0] not in set("abcdefghijklmnopqrstuvwxyz0123456789"):
                errors.append(f"{entry_id}: fingerspelling entries must be one letter or digit")
            elif key:
                if key[0] in seen_characters:
                    errors.append(f"{entry_id}: duplicate fingerspelling character {key[0]}")
                seen_characters.add(key[0])
                if not problem:
                    fingerspelling_chars.add(key[0])
        elif key:
            if key in seen_terms:
                errors.append(f"{entry_id}: duplicate term {' '.join(key)} also used by {seen_terms[key]}")
            seen_terms[key] = entry_id

        for alias in entry.get("approved_aliases", []):
            alias_key = token_key(alias.get("words", []))
            if not alias.get("reviewed", False):
                warnings.append(f"{entry_id}: alias {' '.join(alias_key)} is present but not reviewed")
                continue
            if alias_key in seen_aliases:
                errors.append(f"{entry_id}: duplicate reviewed alias {' '.join(alias_key)} also used by {seen_aliases[alias_key]}")
            seen_aliases[alias_key] = entry_id

        if entry.get("release_status") != "verified_release":
            warnings.append(f"{entry_id}: developer-preview or non-release asset")
        if entry.get("linguistic_review") != "reviewed":
            warnings.append(f"{entry_id}: linguistic review is {entry.get('linguistic_review', 'missing')}")
        if entry.get("reuse_license") in {"unknown", None, ""}:
            warnings.append(f"{entry_id}: reuse/licence information is unknown")

    for key in seen_aliases.keys() & seen_terms.keys():
        errors.append(f"reviewed alias {' '.join(key)} collides with exact term")

    required_chars = set("abcdefghijklmnopqrstuvwxyz0123456789")
    missing_chars = sorted(required_chars - fingerspelling_chars)
    if missing_chars:
        errors.append(f"missing required fingerspelling characters: {', '.join(missing_chars)}")

    dataset_files = set()
    datasets_dir = app_root / "datasets"
    if datasets_dir.exists():
        for path in datasets_dir.rglob("*"):
            if path.is_file():
                rel_path = path.relative_to(app_root).as_posix()
                if path.suffix.casefold() in SUPPORTED_MEDIA_EXTENSIONS:
                    dataset_files.add(rel_path)
                else:
                    warnings.append(f"unsupported dataset file not catalogued for playback: {rel_path}")

    for asset in sorted(dataset_files - catalogue_assets):
        warnings.append(f"dataset media asset is not catalogued: {asset}")

    return {
        "entries": len(entries),
        "errors": errors,
        "warnings": warnings,
        "developer_preview_entries": sum(1 for entry in entries if isinstance(entry, dict) and not is_verified_release(entry)),
        "verified_release_entries": sum(1 for entry in entries if isinstance(entry, dict) and is_verified_release(entry)),
        "fingerspelling_coverage": {
            "required": len(required_chars),
            "present": len(fingerspelling_chars),
            "missing": missing_chars,
        },
    }
