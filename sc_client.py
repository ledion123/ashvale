import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://api.safetyculture.io"
TIMEOUT = 20


def _headers():
    token = os.environ.get("SAFETYCULTURE_API_TOKEN", "")
    return {"Authorization": f"Bearer {token}"}


def get_sites():
    """Fetch all sites, handling pagination."""
    sites = []
    url = f"{BASE}/feed/sites"
    params = {"limit": 100}
    while url:
        r = requests.get(url, headers=_headers(), params=params, timeout=TIMEOUT)
        r.raise_for_status()
        body = r.json()
        sites.extend(body.get("data", []))
        next_token = body.get("metadata", {}).get("next_page_token")
        if next_token:
            params = {"limit": 100, "page_token": next_token}
        else:
            url = None
    return {"sites": sites}


def search_audits(template_id, modified_after, modified_before, limit=200):
    params = {
        "template": template_id,
        "modified_after": modified_after,
        "modified_before": modified_before,
        "completed": "true",
        "limit": limit,
    }
    r = requests.get(f"{BASE}/audits/search", headers=_headers(), params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json().get("audits", [])


def get_audit(audit_id):
    r = requests.get(f"{BASE}/audits/{audit_id}", headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def fetch_audits_parallel(audit_ids, max_workers=10):
    """Fetch multiple audit details in parallel. Returns dict {audit_id: detail}."""
    results = {}

    def _fetch(aid):
        try:
            return aid, get_audit(aid)
        except Exception:
            return aid, None

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(_fetch, aid): aid for aid in audit_ids}
        for future in as_completed(futures):
            aid, detail = future.result()
            if detail:
                results[aid] = detail
    return results
