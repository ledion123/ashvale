"""Self-check: PUWER Register photo-only entries suppress the cross-check.
Run: python test_puwer_photo_only.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

puwer_tid = next(tid for tid, tkey in appmod.TEMPLATES.items() if tkey == "PUWER_REGISTER")
excavator_tid = next(tid for tid, tkey in appmod.TEMPLATES.items() if tkey == "EXCAVATOR")


def fake_search_audits(template_id, modified_after, modified_before):
    if template_id == puwer_tid:
        return [{"audit_id": "puwer-1"}]
    if template_id == excavator_tid:
        return [{"audit_id": "exc-1"}]
    return []


def fake_fetch_audits_parallel(audit_ids, max_workers=50):
    details = {}
    if "puwer-1" in audit_ids:
        details["puwer-1"] = {
            "audit_data": {
                "site": {"name": "BG0216 Acre Road, Kingston upon Thames"},
                "date_completed": "2026-07-20T13:30:00Z",
                "authorship": {"author": "Some Inspector"},
            },
            "items": [
                {
                    "label": "0.75 Ton Excavator\n1.5 Ton Excavator",
                    "responses": {"selected": [{"label": "Safe"}]},
                    # No text response - a photo was attached instead.
                    "media": [{"media_id": "abc123", "href": "https://api.safetyculture.io/.../media/abc123"}],
                },
            ],
        }
    if "exc-1" in audit_ids:
        details["exc-1"] = {
            "audit_data": {
                "site": {"name": "BG0216 Acre Road, Kingston upon Thames"},
                "date_completed": "2026-07-20T09:00:00Z",
                "authorship": {"author": "Another Inspector"},
                "name": "20 Jul 2026 / ASH 900 / BG0216 Acre Road, Kingston upon Thames",
            },
            "items": [],
        }
    return details


appmod.sc.search_audits = fake_search_audits
appmod.sc.fetch_audits_parallel = fake_fetch_audits_parallel

data = appmod.build_dashboard_data("2026-07-20", "2026-07-26", force_refresh=True)
site = next(s for s in data["sites"] if "Acre Road" in s["name"])
exc = site["templates"]["EXCAVATOR"]

assert exc["puwer_photo_uploaded"] is True, exc
assert exc["puwer_cross_check"] is None, \
    f"cross-check should be suppressed when PUWER only has a photo, got: {exc['puwer_cross_check']}"
assert exc["machines_checked"] == ["ASH900"], exc

print("OK: photo-only PUWER Register entries are flagged and don't produce a false cross-check mismatch")
