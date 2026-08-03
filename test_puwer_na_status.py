"""Self-check: a PUWER Register category answered "N/A" (site has none of that
equipment) shows status "n/a", not a false "ok" green tick, and doesn't count
against the site's compliance. A newer/older audit's verdict correctly wins
by date, same as every other field. Run: python test_puwer_na_status.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

TID = {tkey: tid for tid, tkey in appmod.TEMPLATES.items()}
SITE = "AB0023 Rabans Lane, Aylesbury"


def puwer_audit(date_completed, telehand_answer):
    return {
        "audit_data": {"site": {"name": SITE}, "date_completed": date_completed, "authorship": {"author": "A"}},
        "items": [
            {"label": "0.75 Ton Excavator", "responses": {"selected": [{"label": "Safe"}], "text": "205"}},
            {"label": "3 Ton Dumper", "responses": {"selected": [{"label": "Safe"}], "text": "943"}},
            {"label": "Ride on Roller", "responses": {"selected": [{"label": "Safe"}], "text": "ROR 17"}},
            {"label": "14m Telehandler\n10m Telehandler", "responses": {"selected": [{"label": telehand_answer}]}},
        ],
    }


def simple_audit(date_completed):
    return {"audit_data": {"site": {"name": SITE}, "date_completed": date_completed, "authorship": {"author": "A"}}, "items": []}


# --- Case 1: N/A telehandler, every other column genuinely covered -> whole
# site is still "compliant" because n/a doesn't count as a gap ---
def fake_search_1(template_id, modified_after, modified_before):
    if template_id == TID["PUWER_REGISTER"]:
        return [{"audit_id": "puwer-1"}]
    if template_id in (TID["LOLER"], TID["SITE SUP"], TID["HAVS"], TID["TOOLBOX"]):
        return [{"audit_id": f"other-{template_id}"}]
    return []


def fake_fetch_1(audit_ids, max_workers=50):
    details = {"puwer-1": puwer_audit("2026-08-03T06:32:24Z", "N/A")}
    for aid in audit_ids:
        if aid.startswith("other-"):
            details[aid] = simple_audit("2026-08-03T06:00:00Z")
    return {aid: details[aid] for aid in audit_ids if aid in details}


appmod.sc.search_audits = fake_search_1
appmod.sc.fetch_audits_parallel = fake_fetch_1
data = appmod.build_dashboard_data("2026-08-03", "2026-08-09", force_refresh=True)
site = next(s for s in data["sites"] if "Rabans Lane" in s["name"])

telehand = site["templates"]["TELEHAND"]
assert telehand["status"] == "n/a", telehand
assert telehand["register_only"] is False, telehand
assert site["templates"]["EXCAVATOR"]["status"] == "ok"  # unaffected category still reads normally
assert data["summary"]["compliant"] == 1, data["summary"]  # n/a doesn't count as a gap

# --- Case 2: a newer PUWER Register later confirms a real telehandler -> "n/a" is superseded ---
def fake_search_2(template_id, modified_after, modified_before):
    return [{"audit_id": "puwer-1"}, {"audit_id": "puwer-2"}] if template_id == TID["PUWER_REGISTER"] else []


def fake_fetch_2(audit_ids, max_workers=50):
    details = {
        "puwer-1": puwer_audit("2026-08-03T06:32:24Z", "N/A"),
        "puwer-2": puwer_audit("2026-08-04T09:00:00Z", "Safe"),
    }
    return {aid: details[aid] for aid in audit_ids if aid in details}


appmod.sc.search_audits = fake_search_2
appmod.sc.fetch_audits_parallel = fake_fetch_2
data2 = appmod.build_dashboard_data("2026-08-03", "2026-08-09", force_refresh=True)
site2 = next(s for s in data2["sites"] if "Rabans Lane" in s["name"])
assert site2["templates"]["TELEHAND"]["status"] == "ok", site2["templates"]["TELEHAND"]

print("OK: PUWER Register N/A answers produce status 'n/a' (not a false 'ok'), don't count as a compliance gap, and the freshest audit's verdict wins")
