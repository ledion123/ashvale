"""Self-check: build_dashboard_data() lists every individual EXCAVATOR/DUMPER/
ROLLER/TELEHAND audit for the week (not just the most-recently-completed one),
sorted newest-first. Run: python test_individual_audits.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

excavator_tid = next(tid for tid, tkey in appmod.TEMPLATES.items() if tkey == "EXCAVATOR")


def fake_search_audits(template_id, modified_after, modified_before):
    if template_id == excavator_tid:
        return [{"audit_id": "exc-1"}, {"audit_id": "exc-2"}, {"audit_id": "exc-3"}]
    return []


def fake_fetch_audits_parallel(audit_ids, max_workers=50):
    details = {
        "exc-1": {
            "audit_data": {
                "site": {"name": "AB0023 Rabans Lane, Aylesbury"},
                "date_completed": "2026-08-03T06:30:16.024Z",
                "authorship": {"author": "Inspector A"},
                "name": "3 Aug 2026 / ASH 205 / AB0023 Rabans Lane, Aylesbury",
            },
            "items": [],
        },
        "exc-2": {
            "audit_data": {
                "site": {"name": "AB0023 Rabans Lane, Aylesbury"},
                "date_completed": "2026-08-03T11:16:07.509Z",
                "authorship": {"author": "Inspector B"},
                "name": "3 Aug 2026 / ASH 835 / AB0023 Rabans Lane, Aylesbury",
            },
            "items": [],
        },
        "exc-3": {
            "audit_data": {
                "site": {"name": "AB0023 Rabans Lane, Aylesbury"},
                "date_completed": "2026-08-03T06:33:36.009Z",
                "authorship": {"author": "Inspector A"},
                "name": "3 Aug 2026 / ASH 834 / AB0023 Rabans Lane, Aylesbury",
            },
            "items": [],
        },
    }
    return {aid: details[aid] for aid in audit_ids if aid in details}


appmod.sc.search_audits = fake_search_audits
appmod.sc.fetch_audits_parallel = fake_fetch_audits_parallel

data = appmod.build_dashboard_data("2026-08-03", "2026-08-09", force_refresh=True)
site = next(s for s in data["sites"] if "Rabans Lane" in s["name"])
exc = site["templates"]["EXCAVATOR"]

# All 3 individual audits present, not just the most-recently-completed one.
assert len(exc["individual_audits"]) == 3, exc["individual_audits"]
assert exc["machines_checked"] == ["ASH205", "ASH834", "ASH835"], exc["machines_checked"]

# Sorted newest-first, and the cell's own audit_id still points at the latest
# (unchanged single-audit behavior for the existing status/last_completed fields).
assert [a["machine_id"] for a in exc["individual_audits"]] == ["ASH835", "ASH834", "ASH205"], exc["individual_audits"]
assert exc["audit_id"] == "exc-2"

# A LOLER column (not individually-coverable) always gets an empty list, not an error.
assert site["templates"]["LOLER"]["individual_audits"] == []

print("OK: build_dashboard_data() lists every individual audit for the week, sorted newest-first")
