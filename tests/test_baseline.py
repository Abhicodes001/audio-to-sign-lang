import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from app import app
from backend.gesture_recognizer import classify_gesture_from_landmarks
from backend.nlp_processor import process_text
from backend.sign_catalogue import SignCatalogue, tokenize_with_boundaries, validate_catalogue


def catalogue_entry(entry_id, words, asset_path, entry_type="sign", aliases=None):
    return {
        "id": entry_id,
        "entry_type": entry_type,
        "language": "unverified",
        "words": words,
        "approved_aliases": aliases or [],
        "asset_path": asset_path,
        "source": "test fixture",
        "reuse_license": "test-only",
        "linguistic_review": "unreviewed",
        "release_status": "developer_preview",
    }


class CatalogueFixture:
    def __enter__(self):
        self.temp_dir = TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        (self.root / "datasets").mkdir()
        (self.root / "data").mkdir()

        entries = [
            catalogue_entry("sign.dev.thank", ["thank"], "datasets/thank.mp4"),
            catalogue_entry("sign.dev.thank-you", ["thank", "you"], "datasets/thank you.mp4"),
            catalogue_entry("sign.dev.do", ["do"], "datasets/do.mp4"),
            catalogue_entry("sign.dev.do-not", ["do", "not"], "datasets/do not.mp4"),
            catalogue_entry("sign.dev.go", ["go"], "datasets/go.mp4"),
            catalogue_entry(
                "sign.dev.good",
                ["good"],
                "datasets/good.mp4",
                aliases=[{"words": ["great"], "reviewed": True, "notes": "test alias"}],
            ),
        ]
        for char in "abcdefghijklmnopqrstuvwxyz0123456789":
            entries.append(catalogue_entry(f"fingerspelling.dev.{char}", [char], f"datasets/{char}.mp4", "fingerspelling"))

        for entry in entries:
            path = self.root / entry["asset_path"]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"")

        self.catalogue_path = self.root / "data" / "sign_catalogue.json"
        self.catalogue_path.write_text(json.dumps({"schema_version": 1, "entries": entries}), encoding="utf-8")
        self.catalogue = SignCatalogue(self.catalogue_path, self.root)
        return self

    def __exit__(self, *_args):
        self.temp_dir.cleanup()


class TextProcessingTests(unittest.TestCase):
    def test_process_text_preserves_stopwords_and_negation(self):
        self.assertEqual(process_text("Do not go!"), ["do", "not", "go"])


class CatalogueMatchingTests(unittest.TestCase):
    def test_phrase_precedence_beats_shorter_word(self):
        with CatalogueFixture() as fixture:
            sequence = fixture.catalogue.match_tokens([
                {"text": "Thank", "normalized": "thank", "start": 0, "end": 5},
                {"text": "you", "normalized": "you", "start": 6, "end": 9},
            ])

        self.assertEqual(len(sequence), 1)
        self.assertEqual(sequence[0]["match_type"], "phrase")
        self.assertEqual(sequence[0]["catalogue_entry"]["id"], "sign.dev.thank-you")
        self.assertEqual(sequence[0]["boundary"], {"start": 0, "end": 9})

    def test_punctuation_and_case_match_catalogue(self):
        with CatalogueFixture() as fixture:
            sequence = fixture.catalogue.match_tokens(tokenize_with_boundaries("GOOD!"))

        self.assertEqual(sequence[0]["match_type"], "exact_word")
        self.assertEqual(sequence[0]["url"], "/datasets/good.mp4")

    def test_reviewed_alias_mapping(self):
        with CatalogueFixture() as fixture:
            sequence = fixture.catalogue.match_tokens([
                {"text": "great", "normalized": "great", "start": 0, "end": 5},
            ])

        self.assertEqual(sequence[0]["match_type"], "reviewed_alias")
        self.assertEqual(sequence[0]["catalogue_entry"]["id"], "sign.dev.good")

    def test_unknown_names_and_repeated_letters_fingerspell_each_character(self):
        with CatalogueFixture() as fixture:
            sequence = fixture.catalogue.match_tokens([
                {"text": "Anna", "normalized": "anna", "start": 0, "end": 4},
            ])

        self.assertEqual([item["word"] for item in sequence], ["a", "n", "n", "a"])
        self.assertEqual([item["boundary"] for item in sequence], [
            {"start": 0, "end": 1},
            {"start": 1, "end": 2},
            {"start": 2, "end": 3},
            {"start": 3, "end": 4},
        ])

    def test_numbers_fallback_to_digit_fingerspelling(self):
        with CatalogueFixture() as fixture:
            sequence = fixture.catalogue.match_tokens([
                {"text": "101", "normalized": "101", "start": 5, "end": 8},
            ])

        self.assertEqual([item["type"] for item in sequence], ["digit", "digit", "digit"])
        self.assertEqual([item["word"] for item in sequence], ["1", "0", "1"])

    def test_negation_phrase_is_preserved(self):
        with CatalogueFixture() as fixture:
            sequence = fixture.catalogue.match_tokens([
                {"text": "do", "normalized": "do", "start": 0, "end": 2},
                {"text": "not", "normalized": "not", "start": 3, "end": 6},
                {"text": "go", "normalized": "go", "start": 7, "end": 9},
            ])

        self.assertEqual([item["catalogue_entry"]["id"] for item in sequence], ["sign.dev.do-not", "sign.dev.go"])

    def test_missing_fingerspelling_character_is_explicit(self):
        with CatalogueFixture() as fixture:
            fixture.catalogue.fingerspelling_index.pop("x")
            sequence = fixture.catalogue.match_tokens([
                {"text": "x", "normalized": "x", "start": 0, "end": 1},
            ])

        self.assertEqual(sequence[0]["type"], "unsupported")
        self.assertEqual(sequence[0]["fallback_reason"], "missing_fingerspelling_asset")
        self.assertIsNone(sequence[0]["url"])

    def test_unicode_names_and_contractions_do_not_lose_characters(self):
        with CatalogueFixture() as fixture:
            for text in ["Jos\u00e9", "don't", "don\u2019t"]:
                sequence = fixture.catalogue.match_tokens(tokenize_with_boundaries(text))
                self.assertEqual("".join(item["original_text"] for item in sequence), text)
                self.assertTrue(any(item["type"] == "unsupported" for item in sequence))

    def test_phrases_do_not_span_sentence_punctuation(self):
        with CatalogueFixture() as fixture:
            sequence = fixture.catalogue.match_tokens(tokenize_with_boundaries("Thank. You!"))
            self.assertNotIn("phrase", [item["match_type"] for item in sequence])

    def test_exact_word_precedes_longer_alias(self):
        with CatalogueFixture() as fixture:
            fixture.catalogue.alias_index[("thank", "now")] = fixture.catalogue.entries[5]
            sequence = fixture.catalogue.match_tokens(tokenize_with_boundaries("thank now"))
            self.assertEqual(sequence[0]["match_type"], "exact_word")

    def test_missing_files_return_no_playable_url(self):
        with CatalogueFixture() as fixture:
            (fixture.root / "datasets/good.mp4").unlink()
            (fixture.root / "datasets/x.mp4").unlink()
            sequence = fixture.catalogue.match_tokens(tokenize_with_boundaries("good x"))
            self.assertEqual([item["type"] for item in sequence], ["unsupported", "unsupported"])
            self.assertTrue(all(item["url"] is None for item in sequence))

    def test_release_mode_excludes_all_unverified_fixtures(self):
        with CatalogueFixture() as fixture:
            catalogue = SignCatalogue(fixture.catalogue_path, fixture.root, release_only=True)
            sequence = catalogue.match_tokens(tokenize_with_boundaries("good"))
            self.assertTrue(all(item["type"] == "unsupported" for item in sequence))


class CatalogueValidationTests(unittest.TestCase):
    def test_duplicates_empty_metadata_formats_and_release_claims(self):
        with CatalogueFixture() as fixture:
            data = json.loads(fixture.catalogue_path.read_text(encoding="utf-8"))
            data["entries"].append(dict(data["entries"][-1]))
            data["entries"][0].update(source="", asset_path="datasets/bad.avi", release_status="verified_release")
            del data["entries"][1]["language"]
            fixture.catalogue_path.write_text(json.dumps(data), encoding="utf-8")
            errors = "\n".join(validate_catalogue(fixture.catalogue_path, fixture.root)["errors"])
            for expected in ["duplicate id", "duplicate fingerspelling", "empty metadata", "missing metadata", "unsupported media", "verified release requires"]:
                self.assertIn(expected, errors)

    def test_missing_file_does_not_count_as_character_coverage(self):
        with CatalogueFixture() as fixture:
            (fixture.root / "datasets/x.mp4").unlink()
            report = validate_catalogue(fixture.catalogue_path, fixture.root)
            self.assertEqual(report["fingerspelling_coverage"]["missing"], ["x"])

    def test_paths_cannot_escape_dataset_directory(self):
        with CatalogueFixture() as fixture:
            entry = fixture.catalogue.entries[0]
            entry.raw["asset_path"] = "../outside.mp4"
            self.assertIsNone(fixture.catalogue.asset_url(entry))

    def test_validation_reports_missing_assets_and_metadata(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "data").mkdir()
            catalogue_path = root / "data" / "sign_catalogue.json"
            entries = [
                {
                    "id": "sign.dev.bad",
                    "entry_type": "sign",
                    "language": "unverified",
                    "words": ["bad"],
                    "approved_aliases": [],
                    "asset_path": "datasets/missing.mp4",
                    "source": "test fixture",
                    "reuse_license": "unknown",
                    "linguistic_review": "unreviewed",
                    "release_status": "developer_preview",
                }
            ]
            catalogue_path.write_text(json.dumps({"entries": entries}), encoding="utf-8")

            report = validate_catalogue(catalogue_path, root)

        self.assertTrue(any("missing asset" in error for error in report["errors"]))
        self.assertTrue(any("missing required fingerspelling characters" in error for error in report["errors"]))


class ApiBaselineTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_process_text_requires_text(self):
        response = self.client.post("/api/process-text", json={"text": ""})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "No text provided"})

    def test_predict_gesture_rejects_missing_landmarks(self):
        response = self.client.post("/api/predict-gesture", json={"landmarks": []})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Invalid or missing landmarks data"})


class GestureRecognizerTests(unittest.TestCase):
    def test_classifier_does_not_report_fabricated_confidence(self):
        result = classify_gesture_from_landmarks([])

        self.assertNotIn("confidence", result)
        self.assertEqual(result["status"], "no_hand")
        self.assertTrue(result["heuristic"])


if __name__ == "__main__":
    unittest.main()
