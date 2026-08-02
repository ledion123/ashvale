"""Self-check for parse_pdf in app.py. Run: python test_parse_pdf.py"""
import io
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod


def build_pdf(lines):
    """Hand-build a minimal single-page PDF with one text line per string in `lines`.
    No PDF-writing library is installed in this project, so this constructs
    the raw PDF object structure directly (same technique used for manual
    testing earlier this session)."""
    parts = [b"BT /F1 12 Tf 72 750 Td"]
    for i, line in enumerate(lines):
        if i > 0:
            parts.append(b"0 -20 Td")
        parts.append(b"(%s) Tj" % line.encode("latin-1"))
    parts.append(b"ET")
    content = b" ".join(parts)

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
    ]

    pdf = b"%PDF-1.4\n"
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n%s\nendobj\n" % (i, obj)

    xref_offset = len(pdf)
    pdf += b"xref\n0 %d\n" % (len(objects) + 1)
    pdf += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        pdf += b"%010d 00000 n \n" % off
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (len(objects) + 1, xref_offset)
    return pdf


pdf_bytes = build_pdf([
    "AB0020 Cromwell Place, Wixams [AB20] ROR101 TL55 SL999",
    "BC001 Silwood Park, Ascot [BC01] FK12",
    "This line has no job code and should be ignored",
])

site_machines, name_to_job = appmod.parse_pdf(pdf_bytes)

assert site_machines["AB20"]["ROLLER"] == {"ROR101"}, site_machines
assert site_machines["AB20"]["TELEHAND"] == {"TL55"}, site_machines
assert site_machines["AB20"]["LOLER"] == {"SL999"}, site_machines
assert site_machines["BC1"]["LOLER"] == {"FK12"}, site_machines
assert len(site_machines) == 2, "line with no job code should not create an entry"

assert name_to_job["ab0020 cromwell place wixams"] == "AB20"
assert name_to_job["bc001 silwood park ascot"] == "BC1"

print("OK: parse_pdf extracts job codes and serials-by-machine-type correctly, ignores lines with no job code")
