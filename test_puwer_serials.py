"""Self-check for extract_puwer_item_serials in app.py. Run: python test_puwer_serials.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

# Bare comma-separated numbers under the Excavator item (real BH004/BG218 data)
assert appmod.extract_puwer_item_serials("EXCAVATOR", "1415,1422,1423,1427,823,828,830,62") == {
    "ASH1415", "ASH1422", "ASH1423", "ASH1427", "ASH823", "ASH828", "ASH830", "ASH62",
}

# Bare newline-separated numbers (real DAN004 data)
assert appmod.extract_puwer_item_serials("EXCAVATOR", "802\n61\n43\n40\n1502\n1428") == {
    "ASH802", "ASH61", "ASH43", "ASH40", "ASH1502", "ASH1428",
}

# Explicit "Ash NNN" prefix mixed with newlines (real AB0023 data)
assert appmod.extract_puwer_item_serials("EXCAVATOR", "Ash 205\nAsh 1420\nAsh 1429") == {
    "ASH205", "ASH1420", "ASH1429",
}

# Roller uses the ROR implied prefix, not ASH
assert appmod.extract_puwer_item_serials("ROLLER", "18") == {"ROR18"}
assert appmod.extract_puwer_item_serials("ROLLER", "ROR 17\nROR 07") == {"ROR17", "ROR07"}

# Free-text noise (real BG222 data: "Hire", "Na", "Ashvale") must not fabricate a serial
assert appmod.extract_puwer_item_serials("EXCAVATOR", "Hire") == set()
assert appmod.extract_puwer_item_serials("EXCAVATOR", "Na") == set()
assert appmod.extract_puwer_item_serials("DUMPER", "Ashvale") == set()

# No implied prefix for a type not in PUWER_IMPLIED_PREFIX (e.g. generic "PUWER" itself)
assert appmod.extract_puwer_item_serials("PUWER", "802") == set()

print("OK: extract_puwer_item_serials parses real PUWER Register text and skips free-text noise")
