import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "studiolink-lite-extension"


class ExtensionReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))

    def test_manifest_identity_and_hy4_registration(self):
        self.assertEqual(self.manifest["manifest_version"], 3)
        self.assertEqual(self.manifest["name"], "StudioLink Lite")
        self.assertEqual(self.manifest["version"], "1.6.3")
        scripts = self.manifest["content_scripts"]
        hy4 = [entry for entry in scripts if "https://www.workbuddy.ai/*" in entry["matches"]]
        self.assertEqual(len(hy4), 1)
        self.assertIn("providers/hy4.js", hy4[0]["js"])

    def test_no_promotional_endpoints_in_extension(self):
        forbidden = ("discord.gg", "ko-fi.com", "work.ink", "game-pass", "youtube.com", "youtu.be")
        for path in EXTENSION.rglob("*"):
            if path.suffix not in {".js", ".css", ".html", ".json", ".md"}:
                continue
            text = path.read_text(encoding="utf-8").lower()
            for value in forbidden:
                self.assertNotIn(value, text, f"{value} remains in {path.relative_to(ROOT)}")

    def test_background_does_not_forward_process_configuration(self):
        source = (EXTENSION / "background.js").read_text(encoding="utf-8")
        self.assertNotIn('case "add_server"', source)
        self.assertNotIn('case "remove_server"', source)
        self.assertIn('case "call_tool"', source)
        self.assertIn('case "restart_mcp"', source)

    def test_agent_prompt_is_roblox_only(self):
        config = (EXTENSION / "core" / "config.js").read_text(encoding="utf-8")
        main = (EXTENSION / "core" / "main.js").read_text(encoding="utf-8")
        self.assertNotIn("list_mcp_servers", config)
        self.assertNotIn('name === "list_mcp_servers"', main)

    def test_required_provider_files_exist(self):
        expected = {"chatgpt", "deepseek", "gemini", "kimi", "glm", "qwen", "arena", "meta", "hy4"}
        existing = {path.stem for path in (EXTENSION / "providers").glob("*.js")}
        self.assertTrue(expected.issubset(existing))


if __name__ == "__main__":
    unittest.main()
