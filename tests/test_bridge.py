import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path

import websockets

import bridge


ROOT = Path(__file__).resolve().parents[1]
MOCK_SERVER = ROOT / "tests" / "mock_mcp_server.py"


def tearDownModule():
    if bridge._log_file:
        bridge._log_file.close()


class HeaderBag:
    def __init__(self, origin):
        self.origin = origin

    def get(self, name):
        return self.origin if name.lower() == "origin" else None


class FakeRequest:
    def __init__(self, origin):
        self.headers = HeaderBag(origin)


class FakeWebSocket:
    def __init__(self, origin, peer="127.0.0.1"):
        self.request = FakeRequest(origin)
        self.remote_address = (peer, 12345)


class BridgeValidationTests(unittest.TestCase):
    def test_accepts_only_loopback_extension_origins(self):
        extension_id = "a" * 32
        self.assertTrue(bridge._allowed_websocket_client(FakeWebSocket(f"chrome-extension://{extension_id}")))
        self.assertTrue(bridge._allowed_websocket_client(FakeWebSocket(f"edge-extension://{extension_id}")))
        self.assertFalse(bridge._allowed_websocket_client(FakeWebSocket("chrome-extension://unit-test")))
        self.assertFalse(bridge._allowed_websocket_client(FakeWebSocket("https://chatgpt.com")))
        self.assertFalse(bridge._allowed_websocket_client(FakeWebSocket(None)))
        self.assertFalse(bridge._allowed_websocket_client(FakeWebSocket(f"chrome-extension://{extension_id}", "192.168.1.4")))

    def test_request_ids_are_bounded_positive_integers(self):
        self.assertTrue(bridge._valid_request_id(1))
        self.assertFalse(bridge._valid_request_id(0))
        self.assertFalse(bridge._valid_request_id(True))
        self.assertFalse(bridge._valid_request_id("1"))
        self.assertFalse(bridge._valid_request_id(2**53))

    def test_config_can_only_select_bundled_roblox_launcher(self):
        original_path = bridge.CONFIG_PATH
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps({
                "mcpServers": {
                    "roblox": {"command": "unsafe.exe", "args": ["--unsafe"]},
                    "extra": {"command": "another.exe", "args": []},
                }
            }), encoding="utf-8")
            bridge.CONFIG_PATH = str(path)
            try:
                manager = bridge.MCPManager()
                manager.load_config()
            finally:
                bridge.CONFIG_PATH = original_path

        self.assertEqual(set(manager.clients), {"roblox"})
        self.assertEqual(manager.clients["roblox"].command, "launch_studio_mcp.py")
        self.assertEqual(manager.clients["roblox"].args, [])


class BridgeRoundTripTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_manager = bridge.mgr
        self.manager = bridge.MCPManager()
        self.client = bridge.MCPClient("roblox", sys.executable, [str(MOCK_SERVER)])
        self.manager.clients["roblox"] = self.client
        await asyncio.to_thread(self.client.start)
        self.manager.rebuild_index()
        bridge.mgr = self.manager
        bridge.clients.clear()
        self.server = await websockets.serve(bridge.handler, "127.0.0.1", 0, max_size=bridge.MAX_BROWSER_MESSAGE_BYTES)
        port = self.server.sockets[0].getsockname()[1]
        self.uri = f"ws://127.0.0.1:{port}"

    async def asyncTearDown(self):
        self.server.close()
        await self.server.wait_closed()
        await asyncio.to_thread(self.client.stop)
        bridge.clients.clear()
        bridge.mgr = self.original_manager

    async def test_tool_list_long_result_status_and_protocol_rejection(self):
        async with websockets.connect(self.uri, origin=f"chrome-extension://{'a' * 32}", max_size=bridge.MAX_BROWSER_MESSAGE_BYTES) as socket:
            connected = json.loads(await socket.recv())
            self.assertEqual(connected["type"], "connected")
            self.assertTrue(connected["mcp_alive"])

            await socket.send(json.dumps({"type": "list_tools", "id": 1}))
            listed = json.loads(await socket.recv())
            self.assertEqual(listed["type"], "tools")
            self.assertIn("echo", {tool["name"] for tool in listed["tools"]})

            payload = "x" * 200_000
            await socket.send(json.dumps({"type": "call_tool", "id": 2, "name": "echo", "arguments": {"text": payload}, "timeout": 120000}))
            result = json.loads(await socket.recv())
            self.assertEqual(result["type"], "tool_result")
            self.assertTrue(result["ok"])
            self.assertEqual(result["text"], payload)

            await socket.send(json.dumps({"type": "studio_status", "id": 3}))
            status = json.loads(await socket.recv())
            self.assertEqual(status["type"], "studio_status")
            self.assertTrue(status["studio"])

            await socket.send(json.dumps({"type": "add_server", "id": 4, "command": "unsafe"}))
            rejected = json.loads(await socket.recv())
            self.assertEqual(rejected["type"], "error")
            self.assertEqual(rejected["error"], "invalid request")

            await socket.send(json.dumps({"type": "call_tool", "id": 5, "name": "echo", "arguments": []}))
            invalid = json.loads(await socket.recv())
            self.assertFalse(invalid["ok"])
            self.assertEqual(invalid["kind"], "invalid_request")

    async def test_rejects_webpage_origin(self):
        async with websockets.connect(self.uri, origin="https://chatgpt.com") as socket:
            with self.assertRaises(websockets.ConnectionClosed):
                await socket.recv()
            self.assertEqual(socket.close_code, 1008)


if __name__ == "__main__":
    unittest.main()
