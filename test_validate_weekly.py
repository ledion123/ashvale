"""Self-check for parse_weekly_excel in app.py. Run: python test_validate_weekly.py"""
import io
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import openpyxl
import app as appmod

wb = openpyxl.Workbook()
ws = wb.active
ws.append(["SITE", "JOB NO", "PUWER", "LOLER", "SITE SUP", "EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND", "HAVS", "TOOLBOX", "SUPERVISOR"])
ws.append(["Test Site", "AC23", "N", "", "", "N", "", "", "", "", "", "Jane Doe"])
ws.append(["No Requirements Site", "AC24", "", "", "", "", "", "", "", "", "", "Jane Doe"])
buf = io.BytesIO()
wb.save(buf)

sites = appmod.parse_weekly_excel(buf.getvalue())

assert len(sites) == 1, f"expected 1 site with requirements, got {len(sites)}"
site = sites[0]
assert site["site_name"] == "Test Site"
assert site["job_code"] == "AC23"
assert site["supervisor"] == "Jane Doe"
assert set(site["required_inspections"]) == {"PUWER", "EXCAVATOR"}, site["required_inspections"]

print("OK: parse_weekly_excel extracts required sites correctly")

# ── End-to-end: hit the actual /api/validate-weekly route, with the
#    SafetyCulture network calls stubbed out (no real API token here). ──

wb2 = openpyxl.Workbook()
ws2 = wb2.active
ws2.append(["SITE", "JOB NO", "PUWER", "LOLER", "SITE SUP", "EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND", "HAVS", "TOOLBOX", "SUPERVISOR"])
ws2.append(["Covered Site", "AC23", "N", "", "", "N", "", "", "", "", "", "Jane Doe"])
ws2.append(["Uninspected Site", "AC99", "", "", "", "", "", "", "", "N", "", "Jane Doe"])
buf2 = io.BytesIO()
wb2.save(buf2)
buf2.seek(0)

puwer_template_id = next(tid for tid, tkey in appmod.TEMPLATES.items() if tkey == "PUWER_REGISTER")


def fake_search_audits(template_id, modified_after, modified_before):
    if template_id == puwer_template_id:
        return [{"audit_id": "audit-1"}]
    return []


def fake_fetch_audits_parallel(audit_ids, max_workers=50):
    return {
        "audit-1": {
            "audit_data": {
                "site": {"name": "AC23 Covered Site"},
                "date_completed": "2026-07-29T10:00:00Z",
                "authorship": {"author": "Inspector Bob"},
            },
            "items": [],
        }
    }


appmod.sc.search_audits = fake_search_audits
appmod.sc.fetch_audits_parallel = fake_fetch_audits_parallel
appmod._write_cache = lambda *a, **k: None  # skip disk cache during test
appmod._read_cache = lambda *a, **k: None

client = appmod.app.test_client()
resp = client.post(
    "/api/validate-weekly",
    data={
        "excel": (buf2, "weekly.xlsx"),
        "from_date": "2026-07-28",
        "to_date": "2026-08-03",
    },
    content_type="multipart/form-data",
)
assert resp.status_code == 200, resp.get_data(as_text=True)
body = resp.get_json()
by_site = {s["site"]: s for s in body["sites"]}

covered = by_site["Covered Site"]
assert covered["missing_inspections"] == [], covered
assert covered["inspections"]["PUWER"]["status"] == "done"
assert covered["inspections"]["EXCAVATOR"]["inspector"] == "Inspector Bob"

uninspected = by_site["Uninspected Site"]
assert uninspected["missing_inspections"] == ["HAVS"], uninspected
assert uninspected["notes"] == "Missing: HAVS"

print("OK: /api/validate-weekly matches done vs missing inspections correctly")
