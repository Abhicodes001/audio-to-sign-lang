import os
import tempfile
import unittest
from unittest.mock import patch

from app import app
from backend.gesture_recognizer import classify_gesture_from_landmarks
from backend import sign_mapper
from backend.nlp_processor import process_text


class TextProcessingTests(unittest.TestCase):
    def test_process_text_fallback_lowercases_and_strips_punctuation(self):
        with patch("backend.nlp_processor.nltk.data.find", side_effect=LookupError):
            with patch("backend.nlp_processor.nltk.download", side_effect=RuntimeError):
                self.assertEqual(process_text("  Hello, WORLD!!!  "), ["hello", "world"])


class SignMapperTests(unittest.TestCase):
    def setUp(self):
        self.original_dataset_dir = sign_mapper.DATASET_DIR
        self.temp_dir = tempfile.TemporaryDirectory()
        sign_mapper.DATASET_DIR = self.temp_dir.name

    def tearDown(self):
        sign_mapper.DATASET_DIR = self.original_dataset_dir
        self.temp_dir.cleanup()

    def touch_dataset_file(self, filename):
        path = os.path.join(self.temp_dir.name, filename)
        with open(path, "wb"):
            pass

    def test_maps_available_word_video(self):
        self.touch_dataset_file("hello.mp4")

        self.assertEqual(
            sign_mapper.map_words_to_videos(["hello"]),
            [{"word": "hello", "type": "word", "url": "/datasets/hello.mp4"}],
        )

    def test_falls_back_to_available_fingerspelling_letters(self):
        self.touch_dataset_file("h.mp4")
        self.touch_dataset_file("i.mp4")

        self.assertEqual(
            sign_mapper.map_words_to_videos(["hi"]),
            [
                {"word": "h", "parent_word": "hi", "type": "letter", "url": "/datasets/h.mp4"},
                {"word": "i", "parent_word": "hi", "type": "letter", "url": "/datasets/i.mp4"},
            ],
        )

    def test_missing_word_and_missing_letters_are_explicit(self):
        self.assertEqual(
            sign_mapper.map_words_to_videos(["x"]),
            [{"word": "x", "parent_word": "x", "type": "missing", "url": None}],
        )


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
