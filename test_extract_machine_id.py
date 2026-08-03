"""Self-check for extract_machine_id in app.py. Run: python test_extract_machine_id.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

# Real 3-part title format: DATE / SERIAL / SITE NAME
assert appmod.extract_machine_id("20 Jul 2026 / ASH 1419 / BG218 The Queens Drive, Mill End") == "ASH1419"
assert appmod.extract_machine_id("20 Jul 2026 / ROR 18 / BH004 Loverose Way, Wixams") == "ROR18"
assert appmod.extract_machine_id("13 Jul 2026 / ASH 816 / AB0022 Berryfields, Paradise Orchard") == "ASH816"

# Safety: the site-name segment must NEVER be scanned, even when the job code
# (e.g. "BG218") collides with a recognised serial prefix (BG -> LOLER).
assert appmod.extract_machine_id("20 Jul 2026 / BG218 The Queens Drive, Mill End") is None, \
    "2-part title (no middle segment) must not misread the job code as a serial"

# No parseable serial in the middle segment (e.g. a hired machine with no asset number)
assert appmod.extract_machine_id("20 Jul 2026 / HIRED ROLLER / LP10 Denny End Road, Waterbeach") is None

# TELEHAND/LOLER-style titles (no middle segment at all)
assert appmod.extract_machine_id("20 Jul 2026 / DAN003 Linmere, Houghton Regis") is None

print("OK: extract_machine_id parses real title formats and never scans the site-name segment")
