import unittest
from nexus_py.application import create_application

class PythonApplicationTests(unittest.TestCase):
    def test_application_returns_normalized_context(self):
        result = create_application().handle("  Alice ", "active")
        self.assertEqual(result["key"], "Alice")
        self.assertEqual(result["metadata"]["normalized"], "alice")
        self.assertEqual(result["metadata"]["service"], "nexusauth")

    def test_blank_key_is_rejected(self):
        with self.assertRaises(ValueError):
            create_application().handle("   ")

if __name__ == "__main__":
    unittest.main()
