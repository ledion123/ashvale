import io
import re
import requests
import pdfplumber
from datetime import datetime
from flask import Flask, request, send_file, jsonify
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment

app = Flask(__name__, static_folder="static", static_url_path="/static")

TOKEN   = "scapi_Nf7mSyq59RHTFKowB4IwfB1jrAUMLHOcP9Q1IVZTNxnr56rlQBIprIrT8E7cwsQcYQeEXvblPcAI1CfSYz2JpDK-8Uh4jzk1ihDKYUmU60bLbqzZp2vr-QudExowN_vj1VESr35mw4SUQMXNoLil-rtxzFeuoKaScvAsWyclZ4w"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

TEMPLATES = {
    "template_7dbbb416041a44459216a2a0ba02bb10": "LOLER",
    "template_9de384b691994b498011b166402163d3": "TELEHAND",
    "template_ce94e9eade8f4a7aaa3c894cdf4b3934": "ROLLER",
    "template_785b009c0581405a86b870ecd52cfa79": "EXCAVATOR",
    "template_4d4487f16b27468ab069be1262b05376": "DUMPER",
    "template_0a8a57e828e746f782b2659da47f398d": "PUWER_REGISTER",
    "template_dbd9e89576dd43898fdd2f89e091dead": "SITE SUP",
    "template_6d565926a30944f2927a7760c343f4ee": "HAVS",
    "template_277834af991b482c945030f0f936f5a9": "TOOLBOX",
}
PUWER_ALL = {"PUWER_REGISTER"}

# 0-based column indexes in Sheet2
COL_COMPLIANCE = {
    "PUWER":     2,
    "LOLER":     3,
    "SITE SUP":  4,
    "EXCAVATOR": 5,
    "DUMPER":    6,
    "ROLLER":    7,
    "TELEHAND":  8,
    "HAVS":      9,
    "TOOLBOX":   10,
}
NOTES_COL = 14   # 1-based

# Serial prefix → machine type
PREFIX_TYPE = {
    "ROR": "ROLLER",
    "TL":  "TELEHAND",
    "SL":  "LOLER",
    "SH":  "LOLER",
    "FK":  "LOLER",
    "BG":  "LOLER",
    "TS":  "LOLER",
}
# ASH serials need description keyword to determine type
ASH_KEYWORDS = {
    "EXCAVATOR": "EXCAVATOR",
    "DIGGER":    "EXCAVATOR",
    "JCB":       "EXCAVATOR",
    "DUMPER":    "DUMPER",
    "ROLLER":    "ROLLER",
    "TELEHANDLER": "TELEHAND",
    "TELEHAND":  "TELEHAND",
}

SERIAL_TOKEN_RE = re.compile(r'\b(ASH|ROR|TL|SL|SH|FK|BG|TS)\s*([\dA-Z][\dA-Z/]*)', re.IGNORECASE)
JOB_CODE_RE     = re.compile(r'\[([A-Z]{2,4}\d{2,})\]')

GREEN  = PatternFill("solid", fgColor="27AE60")
RED    = PatternFill("solid", fgColor="C0392B")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT   = Alignment(horizontal="left",   vertical="center", wrap_text=True)
W_FONT = Font(bold=True, color="FFFFFF", size=10)


# ── Helpers ───────────────────────────────────────────────

def normalize_job(code):
    code = str(code).strip().upper()
    m = re.match(r'^([A-Z]+)(\d+)$', code)
    return (m.group(1) + str(int(m.group(2)))) if m else code

def norm_name(s):
    s = re.sub(r'[^a-z0-9 ]', ' ', s.lower())
    return ' '.join(s.split())

def extract_serials(text):
    serials = set()
    for m in SERIAL_TOKEN_RE.finditer(text):
        prefix = m.group(1).upper()
        for part in m.group(2).split('/'):
            part = part.strip().rstrip('(').strip()
            if part and any(c.isdigit() for c in part):
                serials.add(prefix + part.upper())
    return serials


# ── PDF parsing ───────────────────────────────────────────

def parse_pdf(pdf_bytes):
    """
    Returns {norm_job_code: {machine_type: set_of_serials}}
    Also returns name_to_job {norm_site_name: norm_job_code}
    """
    site_machines = {}   # norm_job → {machine_type: set()}
    name_to_job   = {}   # norm_site_name → norm_job

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue

                jm = JOB_CODE_RE.search(line)
                if not jm:
                    continue

                raw_job   = jm.group(1).upper()
                norm_job  = normalize_job(raw_job)
                site_name = line[:jm.start()].strip()

                if norm_job not in site_machines:
                    site_machines[norm_job] = {}
                    if site_name:
                        name_to_job[norm_name(site_name)] = norm_job

                line_upper = line.upper()
                serials    = extract_serials(line)

                for serial in serials:
                    prefix = re.match(r'^([A-Z]+)', serial)
                    if not prefix:
                        continue
                    pfx = prefix.group(1)

                    if pfx in PREFIX_TYPE:
                        mtype = PREFIX_TYPE[pfx]
                    elif pfx == "ASH":
                        mtype = None
                        for kw, mt in ASH_KEYWORDS.items():
                            if kw in line_upper:
                                mtype = mt
                                break
                        if not mtype:
                            mtype = "EXCAVATOR"  # default ASH to excavator
                    else:
                        continue

                    site_machines[norm_job].setdefault(mtype, set()).add(serial)

    return site_machines, name_to_job


# ── Excel template helpers ────────────────────────────────

def build_lookup(ws):
    job_lookup  = {}
    name_lookup = {}
    header_row  = 1
    for row in ws.iter_rows(min_row=1, max_row=5, max_col=2):
        if row[0].value and str(row[0].value).strip().upper() == "SITE":
            header_row = row[0].row
            break
    for row in ws.iter_rows(min_row=header_row + 1, max_col=2):
        site_val = str(row[0].value).strip() if row[0].value else ""
        job_val  = str(row[1].value).strip() if row[1].value else ""
        if not site_val:
            continue
        rn = row[0].row
        if job_val:
            job_lookup[normalize_job(job_val)] = rn
        name_lookup[site_val.lower()] = rn
    return job_lookup, name_lookup, header_row


def find_row(sc_site, job_lookup, name_lookup):
    parts  = sc_site.strip().split()
    sc_job = parts[0].upper() if parts and re.match(r'^[A-Z]{1,4}\d{2,}$', parts[0], re.I) else ""
    if sc_job and normalize_job(sc_job) in job_lookup:
        return job_lookup[normalize_job(sc_job)]
    if sc_site.lower() in name_lookup:
        return name_lookup[sc_site.lower()]
    sc_words = set(sc_site.lower().split()) - {sc_job.lower()}
    best_row, best = None, 0
    for name, rn in name_lookup.items():
        c = len(sc_words & set(name.split()))
        if c > best:
            best, best_row = c, rn
    return best_row if best >= 2 else None


def mark_cell(ws, row_num, col_idx, done=True):
    cell = ws.cell(row=row_num, column=col_idx + 1)
    orig = str(cell.value).strip().upper() if cell.value else ""
    if orig == "N/A":
        cell.value = ""
        cell.fill  = PatternFill()
        return
    cell.value     = "Y" if done else "N"
    cell.fill      = GREEN if done else RED
    cell.font      = W_FONT
    cell.alignment = CENTER


def append_note(notes_dict, row_num, msg):
    notes_dict.setdefault(row_num, [])
    if msg not in notes_dict[row_num]:
        notes_dict[row_num].append(msg)


# ── Main report generation ────────────────────────────────

def generate_report(from_date, to_date, excel_bytes, pdf_bytes=None):
    modified_after  = datetime.strptime(from_date, "%Y-%m-%d").strftime("%Y-%m-%dT00:00:00Z")
    modified_before = datetime.strptime(to_date,   "%Y-%m-%d").strftime("%Y-%m-%dT23:59:59Z")

    # Parse PDF if provided
    pdf_machines = {}   # norm_job → {machine_type: set_of_serials}
    pdf_name_map = {}   # norm_site_name → norm_job
    if pdf_bytes:
        pdf_machines, pdf_name_map = parse_pdf(pdf_bytes)

    # Load Excel template
    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    ws = wb["Sheet2"] if "Sheet2" in wb.sheetnames else wb.active
    job_lookup, name_lookup, header_row = build_lookup(ws)

    # Build reverse lookup: row_num → norm_job (from Excel job column)
    row_to_normjob = {rn: nj for nj, rn in job_lookup.items()}

    # matched[row_num] = set of tkeys done
    # row_notes[row_num] = list of notes
    matched   = {}
    row_notes = {}

    for tid, tkey in TEMPLATES.items():
        r = requests.get("https://api.safetyculture.io/audits/search", headers=HEADERS, params={
            "template": tid,
            "modified_after": modified_after,
            "modified_before": modified_before,
            "completed": "true",
            "limit": 100
        })
        audits = r.json().get("audits", [])

        for a in audits:
            r2    = requests.get(f"https://api.safetyculture.io/audits/{a['audit_id']}", headers=HEADERS)
            d     = r2.json()
            ad    = d.get("audit_data", {})
            items = d.get("items", [])
            sc_site = ad.get("site", {}).get("name", "").strip()

            row_num = find_row(sc_site, job_lookup, name_lookup)
            if row_num is None:
                continue

            matched.setdefault(row_num, set())
            row_notes.setdefault(row_num, [])
            display = "PUWER" if tkey in PUWER_ALL else tkey

            # Mark compliance columns
            if tkey in PUWER_ALL:
                for col_key in ("PUWER", "EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND"):
                    mark_cell(ws, row_num, COL_COMPLIANCE[col_key], True)
                    matched[row_num].add(col_key)
            elif tkey in COL_COMPLIANCE:
                mark_cell(ws, row_num, COL_COMPLIANCE[tkey], True)
                matched[row_num].add(tkey)

            # Check serial numbers for LOLER/PUWER machine inspections
            if tkey in ("LOLER", "EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND") or tkey in PUWER_ALL:
                # Collect all text from inspection items
                all_text = ""
                for item in items:
                    responses = item.get("responses", {})
                    all_text += " " + (responses.get("text") or "")
                    all_text += " " + (item.get("note") or "")

                found_serials = extract_serials(all_text)

                if pdf_bytes:
                    # Get registered serials for this site + machine type
                    norm_job   = row_to_normjob.get(row_num, "")
                    registered = set()
                    if norm_job and norm_job in pdf_machines:
                        if tkey in PUWER_ALL:
                            for mt in ("EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND"):
                                registered |= pdf_machines[norm_job].get(mt, set())
                        else:
                            registered = pdf_machines[norm_job].get(tkey, set())

                    if not found_serials:
                        append_note(row_notes, row_num, f"No serial no. on {display}")
                    else:
                        missing = registered - found_serials
                        unknown = found_serials - registered
                        if missing:
                            append_note(row_notes, row_num,
                                f"Not inspected ({display}): {', '.join(sorted(missing))}")
                        if unknown:
                            append_note(row_notes, row_num,
                                f"Not in register ({display}): {', '.join(sorted(unknown))}")
                else:
                    # No PDF — just flag missing serial numbers
                    if not found_serials:
                        append_note(row_notes, row_num, f"No serial no. on {display}")

            # At Risk items always noted
            for item in items:
                selected = item.get("responses", {}).get("selected", [])
                status   = selected[0].get("label", "").strip() if selected else ""
                if status == "At Risk":
                    label = (item.get("label") or "").strip()
                    append_note(row_notes, row_num, f"At Risk: {label[:40]} ({display})")

    # Mark unmatched cells — but only blank cells (skip N/A handled in mark_cell)
    # If PDF provided, only mark N for machine types that actually exist at this site
    for row in ws.iter_rows(min_row=header_row + 1):
        if not row[0].value:
            continue
        row_num  = row[0].row
        done     = matched.get(row_num, set())
        norm_job = row_to_normjob.get(row_num, "")
        site_machines_here = pdf_machines.get(norm_job, {}) if pdf_bytes else None

        for col_key, col_idx in COL_COMPLIANCE.items():
            if col_key in done:
                continue
            # If PDF loaded and machine type not present at this site → leave blank
            if site_machines_here is not None and col_key in ("EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND", "LOLER"):
                if col_key not in site_machines_here:
                    # Clear any existing value but leave blank
                    cell = ws.cell(row=row_num, column=col_idx + 1)
                    orig = str(cell.value).strip().upper() if cell.value else ""
                    if orig == "N/A":
                        cell.value = ""
                        cell.fill  = PatternFill()
                    continue
            mark_cell(ws, row_num, col_idx, False)

    # Write notes (append to existing)
    for row_num, notes in row_notes.items():
        if not notes:
            continue
        cell     = ws.cell(row=row_num, column=NOTES_COL)
        existing = str(cell.value).strip() if cell.value else ""
        new_part = "; ".join(n for n in notes if n not in existing)
        if new_part:
            cell.value = (existing + "; " + new_part).strip("; ") if existing else new_part

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out


# ── Routes ────────────────────────────────────────────────

@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    from_date  = request.form.get("fromDate")
    to_date    = request.form.get("toDate")
    excel_file = request.files.get("siteFile")
    pdf_file   = request.files.get("pdfFile")

    if not from_date or not to_date:
        return jsonify({"error": "Missing dates"}), 400
    if not excel_file or not excel_file.filename:
        return jsonify({"error": "Please upload your weekly Excel template"}), 400

    excel_bytes = excel_file.read()
    pdf_bytes   = pdf_file.read() if pdf_file and pdf_file.filename else None

    out = generate_report(from_date, to_date, excel_bytes, pdf_bytes)
    filename = f"Ashvale_Summary_{from_date}_to_{to_date}.xlsx"
    return send_file(out, as_attachment=True, download_name=filename,
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


if __name__ == "__main__":
    import os
    os.makedirs("static", exist_ok=True)
    print("Starting Ashvale Report Server...")
    print("Open your browser at: http://localhost:5050")
    app.run(port=5050, debug=False)
