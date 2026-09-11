"""Backend smoke tests for Aura-Guard Compliance Auditor after Phase 2.5 refactor."""
import os
import requests
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://audit-integrity-demo.preview.emergentagent.com").rstrip("/")


def test_root_endpoint():
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["service"] == "aura-guard-compliance-auditor"
    assert data["status"] == "ok"
    assert "message" in data
    assert "note" in data


def test_health_endpoint():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    # Timestamp is ISO-parsable
    datetime.fromisoformat(data["timestamp"])


def test_cors_permissive():
    r = requests.options(
        f"{BASE_URL}/api/health",
        headers={
            "Origin": "https://audit-integrity-demo.preview.emergentagent.com",
            "Access-Control-Request-Method": "GET",
        },
        timeout=15,
    )
    # Either 200 or 204 acceptable; header must be present
    assert r.status_code in (200, 204)
    assert "access-control-allow-origin" in {k.lower() for k in r.headers.keys()}
