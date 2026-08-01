"""Self-check for the HTTP Basic Auth gate in app.py. Run: python test_auth.py"""
import base64
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

client = appmod.app.test_client()


def basic_auth_header(user, pw):
    creds = base64.b64encode(f"{user}:{pw}".encode()).decode()
    return {"Authorization": f"Basic {creds}"}


# No APP_USER/APP_PASS set -> auth gate is a no-op
appmod.APP_USER = None
appmod.APP_PASS = None
assert client.get("/").status_code == 200, "expected open access when auth is unconfigured"

# APP_USER/APP_PASS set -> unauthenticated requests are rejected
appmod.APP_USER = "alice"
appmod.APP_PASS = "secret"
assert client.get("/").status_code == 401, "expected 401 with no credentials"
assert client.get("/", headers=basic_auth_header("alice", "wrong")).status_code == 401, "expected 401 with wrong password"
assert client.get("/", headers=basic_auth_header("alice", "secret")).status_code == 200, "expected 200 with correct credentials"

print("OK: auth gate behaves correctly")
