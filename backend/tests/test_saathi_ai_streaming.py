import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_saathi_ai_stream_endpoint_connected():
    """
    Verifies that the /api/v1/intelligence/assistant/stream SSE endpoint returns 200 OK,
    streams event-stream data, and delivers chunk, metadata, and done events.
    """
    response = client.get(
        "/api/v1/intelligence/assistant/stream?query=hello%20saathi&area=Rohini%20Sector%2015&lat=28.7196&lon=77.1186"
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("Content-Type", "")

    # Parse SSE events from response text
    lines = response.text.strip().split("\n\n")
    events = []
    for line in lines:
        if line.startswith("data: "):
            payload_str = line[len("data: "):].strip()
            if payload_str:
                events.append(json.loads(payload_str))

    assert len(events) >= 3, f"Expected at least chunk, metadata, and done events, got {len(events)}"

    types = [e.get("type") for e in events]
    assert "chunk" in types, "Missing 'chunk' event in SSE stream"
    assert "metadata" in types, "Missing 'metadata' event in SSE stream"
    assert "done" in types, "Missing 'done' event in SSE stream"

    # Verify metadata payload structure
    meta_event = next(e for e in events if e.get("type") == "metadata")
    assert "key_findings" in meta_event
    assert "recommendations" in meta_event
    assert "grounded_sources" in meta_event
    assert "confidence" in meta_event
    assert len(meta_event["grounded_sources"]) > 0

    # Verify done event contains full text
    done_event = next(e for e in events if e.get("type") == "done")
    assert "full_text" in done_event
    assert len(done_event["full_text"]) > 10


def test_saathi_ai_stream_post_endpoint():
    """
    Verifies that POST /api/v1/intelligence/assistant/stream also streams SSE tokens cleanly.
    """
    response = client.post(
        "/api/v1/intelligence/assistant/stream?query=traffic%20update%20near%20me&area=Indiranagar&lat=12.9716&lon=77.5946"
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("Content-Type", "")

    lines = response.text.strip().split("\n\n")
    events = []
    for line in lines:
        if line.startswith("data: "):
            payload_str = line[len("data: "):].strip()
            if payload_str:
                events.append(json.loads(payload_str))

    types = [e.get("type") for e in events]
    assert "chunk" in types
    assert "metadata" in types
    assert "done" in types

    chunks = [e["text"] for e in events if e.get("type") == "chunk"]
    combined = "".join(chunks)
    assert len(combined) > 5
