import json
import sys


TOOLS = [
    {
        "name": "echo",
        "description": "Return the supplied text.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
    },
    {
        "name": "list_roblox_studios",
        "description": "List connected studios.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_studio_state",
        "description": "Return mock Studio state.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def send(request_id, result):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": request_id, "result": result}) + "\n")
    sys.stdout.flush()


for line in sys.stdin:
    try:
        message = json.loads(line)
    except json.JSONDecodeError:
        continue
    request_id = message.get("id")
    if request_id is None:
        continue
    method = message.get("method")
    if method == "initialize":
        send(request_id, {"protocolVersion": "2024-11-05", "capabilities": {}, "serverInfo": {"name": "mock-studio", "version": "1.0"}})
    elif method == "tools/list":
        send(request_id, {"tools": TOOLS})
    elif method == "tools/call":
        params = message.get("params") or {}
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if name == "echo":
            text = arguments.get("text", "")
        elif name == "list_roblox_studios":
            text = json.dumps({"studios": [{"id": "mock", "name": "Mock Place", "active": True}]})
        elif name == "get_studio_state":
            text = "Available DataModels: Edit"
        else:
            text = f"unknown tool: {name}"
        send(request_id, {"content": [{"type": "text", "text": text}]})
    else:
        send(request_id, {})
