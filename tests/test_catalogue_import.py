import argparse
import contextlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from scripts import manage_catalogue


class ImportTests(unittest.TestCase):
    def run_import(self, names, apply=False, permission=False):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        source = root / "source"
        source.mkdir()
        for name in names:
            (source / name).write_bytes(b"test fixture; not a video")
        datasets = root / "datasets"
        args = argparse.Namespace(source_dir=str(source), apply=apply, permission_confirmed=permission)
        with patch.multiple(manage_catalogue, APP_ROOT=root, DATASETS_DIR=datasets,
                            CATALOGUE_PATH=root / "catalogue.json"), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            result = manage_catalogue.import_dataset(args)
        return result, datasets

    def test_dry_run_copies_nothing(self):
        result, target = self.run_import(["hello.mp4"])
        self.assertEqual(result, 0)
        self.assertFalse(target.exists())

    def test_incoming_normalization_collision_aborts_all_copies(self):
        result, target = self.run_import(["hello-world.mp4", "hello world.mp4"], True, True)
        self.assertEqual(result, 1)
        self.assertFalse(target.exists())

    def test_same_id_across_formats_aborts(self):
        result, target = self.run_import(["hello.mp4", "hello.webm"], True, True)
        self.assertEqual(result, 1)
        self.assertFalse(target.exists())

    def test_apply_requires_confirmed_permission(self):
        result, target = self.run_import(["hello.mp4"], True)
        self.assertEqual(result, 2)
        self.assertFalse(target.exists())

    def test_apply_copies_local_media_only(self):
        result, target = self.run_import(["hello.mp4", "unsupported.gif"], True, True)
        self.assertEqual(result, 0)
        self.assertEqual([path.name for path in target.iterdir()], ["hello.mp4"])

    def test_generation_preserves_existing_ids_and_review_metadata(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            datasets = root / "datasets"
            datasets.mkdir()
            (datasets / "hello.mp4").touch()
            catalogue = root / "catalogue.json"
            existing = {"entries": [{"id": "stable.custom.id", "asset_path": "datasets/hello.mp4", "source": "reviewed source"}]}
            catalogue.write_text(json.dumps(existing), encoding="utf-8")
            with patch.multiple(manage_catalogue, APP_ROOT=root, DATASETS_DIR=datasets,
                                CATALOGUE_PATH=catalogue), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(manage_catalogue.generate_catalogue(None), 0)
            self.assertEqual(json.loads(catalogue.read_text(encoding="utf-8")), existing)
