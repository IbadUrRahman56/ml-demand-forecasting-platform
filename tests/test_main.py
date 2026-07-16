import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "api" / "app" / "main.py"


class MainStartupTests(unittest.TestCase):
    def test_load_artifacts_ignores_broken_model_files(self):
        def fake_joblib_load(path):
            raise ValueError("corrupt model stream")

        with patch("joblib.load", side_effect=fake_joblib_load):
            spec = importlib.util.spec_from_file_location("main_under_test", MODULE_PATH)
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)

        self.assertIsNone(module._state["model"])
        self.assertIsNone(module._state["store_encoder"])
        self.assertIsNone(module._state["product_encoder"])
        self.assertIsNone(module._state["price_lookup"])


if __name__ == "__main__":
    unittest.main()
