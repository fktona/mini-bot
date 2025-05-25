from fastapi.testclient import TestClient
from main import app
import pytest

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Selenium Bot API"}

def test_bot_execute_endpoint():
    test_request = {
        "url": "https://example.com",
        "action": "test_action"
    }
    response = client.post("/bot/execute", json=test_request)
    assert response.status_code == 200
    assert "status" in response.json()
    assert response.json()["status"] == "success"
    assert "message" in response.json()

def test_bot_execute_invalid_url():
    test_request = {
        "url": "invalid-url",
        "action": "test_action"
    }
    response = client.post("/bot/execute", json=test_request)
    assert response.status_code == 500 