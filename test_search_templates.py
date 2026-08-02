"""Self-check for search_templates in app.py. Run: python test_search_templates.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod


def fake_search_all_fail(template_id, modified_after, modified_before):
    raise RuntimeError(f"boom for {template_id}")


def fake_search_partial_fail(template_id, modified_after, modified_before):
    if template_id == "tid_bad":
        raise RuntimeError("upstream 500")
    return [{"audit_id": f"audit-{template_id}"}]


templates = {"tid_a": "A", "tid_bad": "B", "tid_c": "C"}

# All templates failing -> raise, so a bad/expired token surfaces loudly
# instead of a silent all-"missing" 200.
appmod.sc.search_audits = fake_search_all_fail
try:
    appmod.search_templates(templates, "2026-01-01T00:00:00Z", "2026-01-08T00:00:00Z")
    assert False, "expected RuntimeError when every template search fails"
except RuntimeError as e:
    assert "tid_" in str(e) or "boom" in str(e), str(e)

# Partial failure -> degrade gracefully, report the failure, keep the rest.
appmod.sc.search_audits = fake_search_partial_fail
audit_to_tkey, errors = appmod.search_templates(templates, "2026-01-01T00:00:00Z", "2026-01-08T00:00:00Z")
assert audit_to_tkey == {"audit-tid_a": "A", "audit-tid_c": "C"}, audit_to_tkey
assert len(errors) == 1 and errors[0]["template"] == "B", errors

print("OK: search_templates raises on total failure and degrades gracefully on partial failure")
