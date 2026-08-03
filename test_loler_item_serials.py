"""Self-check for extract_loler_item_serials in app.py. Run: python test_loler_item_serials.py"""
import os

os.environ.setdefault("SAFETYCULTURE_API_TOKEN", "dummy")

import app as appmod

# Bare comma-separated numbers under a "4 leg chain" item (real AB0023 data).
# The alphanumeric token "195949a" is skipped, not guessed at — the implied-prefix
# fallback only fires on whole-numeric tokens, same noise-avoidance rule as PUWER.
assert appmod.extract_loler_item_serials("4 leg chain sling", "195949a,132329,90743") == {
    "SL132329", "SL90743",
}

# Bare newline-separated numbers under "Machine Forks"
assert appmod.extract_loler_item_serials("Machine Forks", "16\n32\n40") == {
    "FK16", "FK32", "FK40",
}

# Shackle keyword variants all map to SH
assert appmod.extract_loler_item_serials("Swivel Hook Shackle", "8717") == {"SH8717"}
assert appmod.extract_loler_item_serials("Bow Shackle", "22") == {"SH22"}

# Block Grabs / Tipping Skip
assert appmod.extract_loler_item_serials("Block Grabs", "19") == {"BG19"}
assert appmod.extract_loler_item_serials("Tipping Skip", "5") == {"TS5"}

# Explicit prefix in text is honoured even without a keyword match on the label
# (e.g. Concrete Pouring Bucket / Lifting Straps / Harness — deliberately unmapped)
assert appmod.extract_loler_item_serials("Concrete Pouring Bucket", "SL101 spare") == {"SL101"}
assert appmod.extract_loler_item_serials(None, "checked SL101 ok, also FK999 spare") == {
    "SL101", "FK999",
}

# But a bare number under an unmapped label is not guessed at
assert appmod.extract_loler_item_serials("Lifting Straps", "802") == set()

# Free-text noise must not fabricate a serial
assert appmod.extract_loler_item_serials("4 leg chain sling", "Hire") == set()

print("OK: extract_loler_item_serials parses real LOLER item text and skips free-text noise")
