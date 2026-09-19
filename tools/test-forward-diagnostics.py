import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("diagnostics", ROOT / "public/downloads/aurum-guard-ai/forward_diagnostics.py")
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


class DiagnosticsTests(unittest.TestCase):
    def test_legacy_untouched_and_model_reason_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            legacy = Path(folder) / "forward.csv"
            legacy.write_text("legacy data", encoding="utf-8")
            record = dict.fromkeys(diagnostics.FIELDS, "")
            record.update(schema_version=2, bar_time=100, model_id="a", model_health="NO_CANDIDATE", effective_health="EQUITY_GUARD")
            path = diagnostics.append_diagnostics(legacy, record)
            diagnostics.append_diagnostics(legacy, record)
            summary = diagnostics.summarize(path)
            self.assertEqual(legacy.read_text(), "legacy data")
            self.assertEqual(summary["unique_observations"], 1)
            self.assertEqual(summary["duplicate_observations"], 1)
            self.assertEqual(summary["model_health"], {"NO_CANDIDATE": 1})
            self.assertIsNone(summary["win_rate"])

    def test_header_mismatch_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            legacy = Path(folder) / "forward.csv"
            companion = Path(folder) / "forward_diagnostics_v2.csv"
            companion.write_text("wrong header\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                diagnostics.append_diagnostics(legacy, dict.fromkeys(diagnostics.FIELDS, ""))
            self.assertEqual(companion.read_text(), "wrong header\n")

    def test_window_first_observation_and_model_separation(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "legacy.csv"
            with path.open("w", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["bar_time", "model_id", "raw_label", "health"])
                writer.writerows([[100, "a", "BUY", "OK"], [100, "a", "SELL", "CHANGED"], [100, "b", "SELL", "OK"], [200, "a", "WAIT", "WAIT"], ["bad", "a", "", ""]])
            summary = diagnostics.summarize(path, 100, 200)
            self.assertEqual(summary["raw_labels"], {"BUY": 1, "SELL": 1})
            self.assertEqual(summary["malformed_rows"], 1)
            self.assertEqual(summary["duplicate_observations"], 1)
            self.assertEqual(diagnostics.summarize(path, 300)["unique_observations"], 0)


if __name__ == "__main__":
    unittest.main()
