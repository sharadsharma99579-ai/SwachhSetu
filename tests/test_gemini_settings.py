import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from server import DEFAULT_GEMINI_MODEL, Problem, gemini_ready, load_gemini_settings, write_gemini_settings


class GeminiSettings(unittest.TestCase):
    def test_saved_key_is_loaded_and_environment_overrides_it(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'settings.json'
            with patch.dict(os.environ, {}, clear=True):
                self.assertFalse(gemini_ready())
                load_gemini_settings(path)
                write_gemini_settings(path, 'fake-test-key-12345678', DEFAULT_GEMINI_MODEL)
                load_gemini_settings(path)
                self.assertTrue(gemini_ready())
                self.assertEqual(os.environ['GEMINI_MODEL'], DEFAULT_GEMINI_MODEL)
            with patch.dict(os.environ, {'GEMINI_API_KEY': 'fake-override-key'}, clear=True):
                load_gemini_settings(path)
                self.assertEqual(os.environ['GEMINI_API_KEY'], 'fake-override-key')

    def test_invalid_input_does_not_overwrite_existing_key(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'settings.json'
            write_gemini_settings(path, 'fake-test-key-12345678', DEFAULT_GEMINI_MODEL)
            with self.assertRaises(Problem):
                write_gemini_settings(path, 'short', DEFAULT_GEMINI_MODEL)
            self.assertEqual(json.loads(path.read_text())['key'], 'fake-test-key-12345678')


if __name__ == '__main__':
    unittest.main()
