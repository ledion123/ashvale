"""Self-check for check_loler_coverage in app.py. Run: python test_loler_check.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

loler_tid = next(tid for tid, tkey in appmod.TEMPLATES.items() if tkey == "LOLER")

appmod.parse_pdf = lambda pdf_bytes: (
    {
        "AB20": {"LOLER": {"SL101", "FK12"}},
        "CD99": {"LOLER": {"SH55"}},
    },
    {},
)


def fake_search_audits(template_id, modified_after, modified_before):
    assert template_id == loler_tid
    return [{"audit_id": "audit-1"}]


def fake_fetch_audits_parallel(audit_ids, max_workers=20):
    return {
        "audit-1": {
            "audit_data": {
                "site": {"name": "AB20 Test Site"},
                "date_completed": "2026-07-29T10:00:00Z",
                "authorship": {"author": "Inspector Bob"},
            },
            "items": [
                {"responses": {"text": "checked SL101 ok, also FK999 spare"}, "note": ""},
            ],
        }
    }


appmod.sc.search_audits = fake_search_audits
appmod.sc.fetch_audits_parallel = fake_fetch_audits_parallel

results = appmod.check_loler_coverage("2026-07-27", "2026-08-01", b"unused")
by_job = {r["job_code"]: r for r in results}

ab20 = by_job["AB20"]
assert ab20["status"] == "done"
assert ab20["found_in_check"] == ["FK999", "SL101"], ab20
assert ab20["missing"] == ["FK12"], ab20
assert ab20["unknown"] == ["FK999"], ab20
assert ab20["notes"] == "Not inspected: FK12; Not in register: FK999", ab20

cd99 = by_job["CD99"]
assert cd99["status"] == "missing"
assert cd99["missing"] == ["SH55"], cd99
assert cd99["notes"] == "No LOLER inspection found this week"

print("OK: check_loler_coverage flags missing/unknown serials and no-audit sites correctly")
