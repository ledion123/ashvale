import io
import os
import re
import requests
import pdfplumber
from datetime import datetime, timedelta, timezone
from flask import Flask, request, send_file, jsonify, send_from_directory
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment

from dotenv import load_dotenv
load_dotenv()

import sc_client as sc

app = Flask(__name__, static_folder="static", static_url_path="/static")

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

# PUWER_REGISTER completion marks all five machine-type columns
PUWER_COLUMNS = ("PUWER", "EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND")

DISPLAY_COLUMNS = ["EXCAVATOR", "LOLER", "DUMPER", "ROLLER", "TELEHAND", "PUWER", "SITE SUP", "HAVS", "TOOLBOX"]

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
NOTES_COL = 14

PREFIX_TYPE = {
    "ROR": "ROLLER",
    "TL":  "TELEHAND",
    "SL":  "LOLER",
    "SH":  "LOLER",
    "FK":  "LOLER",
    "BG":  "LOLER",
    "TS":  "LOLER",
}
ASH_KEYWORDS = {
    "EXCAVATOR":   "EXCAVATOR",
    "DIGGER":      "EXCAVATOR",
    "JCB":         "EXCAVATOR",
    "DUMPER":      "DUMPER",
    "ROLLER":      "ROLLER",
    "TELEHANDLER": "TELEHAND",
    "TELEHAND":    "TELEHAND",
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

def current_week_range():
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    return str(monday), str(today)

def to_iso(date_str, end=False):
    t = "T23:59:59Z" if end else "T00:00:00Z"
    return f"{date_str}{t}"


# ── PDF parsing ───────────────────────────────────────────

def parse_pdf(pdf_bytes):
    site_machines = {}
    name_to_job   = {}

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
                        mtype = next((mt for kw, mt in ASH_KEYWORDS.items() if kw in line_upper), "EXCAVATOR")
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


# ── Excel report generation (unchanged) ──────────────────

def generate_report(from_date, to_date, excel_bytes, pdf_bytes=None):
    modified_after  = datetime.strptime(from_date, "%Y-%m-%d").strftime("%Y-%m-%dT00:00:00Z")
    modified_before = datetime.strptime(to_date,   "%Y-%m-%d").strftime("%Y-%m-%dT23:59:59Z")

    pdf_machines = {}
    pdf_name_map = {}
    if pdf_bytes:
        pdf_machines, pdf_name_map = parse_pdf(pdf_bytes)

    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    ws = wb["Sheet2"] if "Sheet2" in wb.sheetnames else wb.active
    job_lookup, name_lookup, header_row = build_lookup(ws)
    row_to_normjob = {rn: nj for nj, rn in job_lookup.items()}

    matched   = {}
    row_notes = {}

    from concurrent.futures import ThreadPoolExecutor

    audit_to_tkey = {}

    def _search(tid_tkey):
        tid, tkey = tid_tkey
        try:
            return tkey, sc.search_audits(tid, modified_after, modified_before)
        except Exception:
            return tkey, []

    with ThreadPoolExecutor(max_workers=9) as ex:
        for tkey, audits in ex.map(_search, TEMPLATES.items()):
            for a in audits:
                audit_to_tkey[a["audit_id"]] = tkey

    details = sc.fetch_audits_parallel(list(audit_to_tkey.keys()), max_workers=50)

    for audit_id, d in details.items():
        tkey    = audit_to_tkey[audit_id]
        ad      = d.get("audit_data", {})
        items   = d.get("items", [])
        sc_site = ad.get("site", {}).get("name", "").strip()

        row_num = find_row(sc_site, job_lookup, name_lookup)
        if row_num is None:
            continue

        matched.setdefault(row_num, set())
        row_notes.setdefault(row_num, [])
        display = "PUWER" if tkey == "PUWER_REGISTER" else tkey

        if tkey == "PUWER_REGISTER":
            for col_key in PUWER_COLUMNS:
                mark_cell(ws, row_num, COL_COMPLIANCE[col_key], True)
                matched[row_num].add(col_key)
        elif tkey in COL_COMPLIANCE:
            mark_cell(ws, row_num, COL_COMPLIANCE[tkey], True)
            matched[row_num].add(tkey)

        if tkey in ("LOLER", "EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND") or tkey == "PUWER_REGISTER":
            all_text = ""
            for item in items:
                responses = item.get("responses", {})
                all_text += " " + (responses.get("text") or "")
                all_text += " " + (item.get("note") or "")
            found_serials = extract_serials(all_text)

            if pdf_bytes:
                norm_job   = row_to_normjob.get(row_num, "")
                registered = set()
                if norm_job and norm_job in pdf_machines:
                    if tkey == "PUWER_REGISTER":
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
                        append_note(row_notes, row_num, f"Not inspected ({display}): {', '.join(sorted(missing))}")
                    if unknown:
                        append_note(row_notes, row_num, f"Not in register ({display}): {', '.join(sorted(unknown))}")
            else:
                if not found_serials:
                    append_note(row_notes, row_num, f"No serial no. on {display}")

        for item in items:
            selected = item.get("responses", {}).get("selected", [])
            status   = selected[0].get("label", "").strip() if selected else ""
            if status == "At Risk":
                label = (item.get("label") or "").strip()
                append_note(row_notes, row_num, f"At Risk: {label[:40]} ({display})")

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
            if site_machines_here is not None and col_key in ("EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND", "LOLER"):
                if col_key not in site_machines_here:
                    cell = ws.cell(row=row_num, column=col_idx + 1)
                    orig = str(cell.value).strip().upper() if cell.value else ""
                    if orig == "N/A":
                        cell.value = ""
                        cell.fill  = PatternFill()
                    continue
            mark_cell(ws, row_num, col_idx, False)

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


# ── Dashboard cache (file-based, 1-hour TTL) ─────────────

import json as _json
import tempfile

_CACHE_FILE = os.path.join(tempfile.gettempdir(), "ashvale_dashboard_cache.json")
_CACHE_TTL  = 3600  # seconds

def _read_cache(cache_key):
    try:
        with open(_CACHE_FILE) as f:
            store = _json.load(f)
        entry = store.get(cache_key)
        if entry and (datetime.now(timezone.utc).timestamp() - entry["ts"]) < _CACHE_TTL:
            return entry["data"]
    except Exception:
        pass
    return None

def _write_cache(cache_key, data):
    try:
        try:
            with open(_CACHE_FILE) as f:
                store = _json.load(f)
        except Exception:
            store = {}
        store[cache_key] = {"ts": datetime.now(timezone.utc).timestamp(), "data": data}
        with open(_CACHE_FILE, "w") as f:
            _json.dump(store, f)
    except Exception:
        pass


# ── Dashboard data builder ────────────────────────────────

def build_dashboard_data(from_date, to_date, force_refresh=False):
    """
    Fetch completed inspections for the selected week.
    Results are cached for 1 hour to keep subsequent loads instant.
    """
    cache_key = f"{from_date}:{to_date}"
    if not force_refresh:
        cached = _read_cache(cache_key)
        if cached:
            return cached

    modified_after  = to_iso(from_date)
    modified_before = to_iso(to_date, end=True)

    week_start = datetime.strptime(from_date, "%Y-%m-%d").date()

    # Search all templates in parallel, then fetch audit details in parallel
    from concurrent.futures import ThreadPoolExecutor

    audit_to_tkey = {}

    def _search(tid_tkey):
        tid, tkey = tid_tkey
        try:
            return tkey, sc.search_audits(tid, modified_after, modified_before)
        except Exception:
            return tkey, []

    with ThreadPoolExecutor(max_workers=9) as ex:
        for tkey, audits in ex.map(_search, TEMPLATES.items()):
            for a in audits:
                audit_to_tkey[a["audit_id"]] = tkey

    # Fetch all audit details in parallel (50 workers for speed)
    details = sc.fetch_audits_parallel(list(audit_to_tkey.keys()), max_workers=50)

    SERIAL_CHECK_TKEYS = {"LOLER", "EXCAVATOR", "DUMPER", "ROLLER", "TELEHAND", "PUWER_REGISTER"}

    # group_key -> col_key -> {status, last_completed, audit_id, inspector}
    # group_key is normalised job code when available (e.g. "AC23"), else full site name
    site_data    = {}
    site_serials = {}

    def _group_key(sc_name):
        first = sc_name.split()[0] if sc_name else ""
        if re.match(r'^[A-Z]{1,4}\d{2,}$', first, re.I):
            return normalize_job(first), sc_name, normalize_job(first)
        return sc_name, sc_name, ""

    for audit_id, detail in details.items():
        tkey = audit_to_tkey[audit_id]
        ad   = detail.get("audit_data", {})
        site_name = ad.get("site", {}).get("name", "").strip()
        if not site_name:
            continue

        gkey, display, job = _group_key(site_name)

        date_completed = ad.get("date_completed") or ad.get("date_modified", "")
        authorship = ad.get("authorship", {})
        inspector = authorship.get("author", "") if isinstance(authorship, dict) else ""

        # Determine which display columns this inspection covers
        if tkey == "PUWER_REGISTER":
            col_keys = list(PUWER_COLUMNS)
        else:
            col_keys = [tkey]

        if gkey not in site_data:
            site_data[gkey] = {"_display_name": display, "_job_code": job}

        for col_key in col_keys:
            existing = site_data[gkey].get(col_key)
            # Keep only the most recent inspection per site/column
            if not existing or (date_completed and date_completed > existing["last_completed"]):
                site_data[gkey][col_key] = {
                    "last_completed": date_completed,
                    "audit_id": audit_id,
                    "inspector": inspector,
                }

        # Extract serial numbers from all item text/notes for machine-type inspections
        if tkey in SERIAL_CHECK_TKEYS:
            all_text = " ".join(
                (item.get("responses", {}).get("text") or "") + " " + (item.get("note") or "")
                for item in detail.get("items", [])
            )
            serials = extract_serials(all_text)
            site_serials.setdefault(gkey, {})
            # PUWER_REGISTER covers all machine types — store under "PUWER" only.
            # Individual machine audits (EXCAVATOR, LOLER, etc.) store under their own key.
            serial_col = "PUWER" if tkey == "PUWER_REGISTER" else tkey
            site_serials[gkey].setdefault(serial_col, set())
            site_serials[gkey][serial_col].update(serials)

    # Build output
    sites_list = []
    for gkey, cols in sorted(site_data.items()):
        site_name = cols["_display_name"]
        job_code  = cols["_job_code"]

        templates_status = {}
        for col_key in DISPLAY_COLUMNS:
            info = cols.get(col_key)
            if info and info["last_completed"]:
                try:
                    dc = datetime.fromisoformat(info["last_completed"].replace("Z", "+00:00")).date()
                except Exception:
                    dc = None

                if dc and dc >= week_start:
                    status = "ok"
                elif dc:
                    status = "overdue"
                else:
                    status = "missing"

                templates_status[col_key] = {
                    "status": status,
                    "last_completed": info["last_completed"],
                    "audit_id": info["audit_id"],
                    "inspector": info["inspector"],
                    "found_serials": sorted(site_serials.get(gkey, {}).get(col_key, set())),
                }
            else:
                templates_status[col_key] = {
                    "status": "missing",
                    "last_completed": None,
                    "audit_id": None,
                    "inspector": None,
                    "found_serials": [],
                }
        sites_list.append({"name": site_name, "job_code": job_code, "templates": templates_status})

    total     = len(sites_list)
    compliant = sum(1 for s in sites_list if all(t["status"] == "ok" for t in s["templates"].values()))

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "week_start": from_date,
        "week_end": to_date,
        "sites": sites_list,
        "summary": {"total": total, "compliant": compliant, "has_gaps": total - compliant},
    }
    _write_cache(cache_key, result)
    return result


# ── API Routes ────────────────────────────────────────────

@app.route("/api/sites")
def api_sites():
    try:
        data = sc.get_sites()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dashboard")
def api_dashboard():
    from_date = request.args.get("from")
    to_date   = request.args.get("to")
    if not from_date or not to_date:
        from_date, to_date = current_week_range()
    else:
        try:
            datetime.strptime(from_date, "%Y-%m-%d")
            datetime.strptime(to_date, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Dates must be in YYYY-MM-DD format"}), 400
    try:
        return jsonify(build_dashboard_data(from_date, to_date))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sync", methods=["POST"])
def api_sync():
    data = request.get_json(silent=True) or {}
    from_date = data.get("from")
    to_date   = data.get("to")
    if not from_date or not to_date:
        from_date, to_date = current_week_range()
    try:
        return jsonify(build_dashboard_data(from_date, to_date, force_refresh=True))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inspections")
def api_inspections():
    site_filter     = request.args.get("site", "").lower()
    template_filter = request.args.get("template", "")
    from_date       = request.args.get("from")
    to_date         = request.args.get("to")

    if not from_date or not to_date:
        from_date, to_date = current_week_range()

    try:
        modified_after  = to_iso(from_date)
        modified_before = to_iso(to_date, end=True)

        audit_to_tkey = {}
        for tid, tkey in TEMPLATES.items():
            if template_filter and tkey != template_filter:
                continue
            try:
                for a in sc.search_audits(tid, modified_after, modified_before):
                    audit_to_tkey[a["audit_id"]] = tkey
            except Exception:
                pass

        details = sc.fetch_audits_parallel(list(audit_to_tkey.keys()))
        results = []
        for audit_id, detail in details.items():
            tkey = audit_to_tkey[audit_id]
            ad   = detail.get("audit_data", {})
            site_name = ad.get("site", {}).get("name", "").strip()
            if site_filter and site_filter not in site_name.lower():
                continue
            authorship = ad.get("authorship", {})
            results.append({
                "audit_id":       audit_id,
                "template":       tkey,
                "site":           site_name,
                "date_completed": ad.get("date_completed") or ad.get("date_modified", ""),
                "inspector":      authorship.get("author", "") if isinstance(authorship, dict) else "",
                "score":          ad.get("score", ""),
            })

        results.sort(key=lambda x: x["date_completed"] or "", reverse=True)
        return jsonify({"inspections": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inspections/<audit_id>")
def api_inspection_detail(audit_id):
    try:
        detail = sc.get_audit(audit_id)
        return jsonify(detail)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Plant register & active sites parsing ────────────────

@app.route("/api/parse-register", methods=["POST"])
def api_parse_register():
    f = request.files.get("pdf")
    if not f:
        return jsonify({"error": "No PDF uploaded"}), 400
    try:
        site_machines, name_to_job = parse_pdf(f.read())
        register = {
            job: {mtype: sorted(serials) for mtype, serials in mtypes.items()}
            for job, mtypes in site_machines.items()
        }
        return jsonify({"register": register, "name_to_job": name_to_job})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/parse-sites", methods=["POST"])
def api_parse_sites():
    f = request.files.get("excel")
    if not f:
        return jsonify({"error": "No Excel uploaded"}), 400
    try:
        wb = openpyxl.load_workbook(io.BytesIO(f.read()))
        ws = wb.active

        # Locate header row and column indexes
        header_row = 1
        site_col = job_col = sup_col = None
        for row in ws.iter_rows(min_row=1, max_row=10):
            for cell in row:
                val = str(cell.value or "").strip().upper()
                if val == "SITE":
                    header_row = cell.row
                    site_col   = cell.column - 1
                elif val in ("JOB", "JOB CODE", "CODE"):
                    job_col = cell.column - 1
                elif "SUPER" in val or val in ("SSV", "SS", "SUPERVISOR"):
                    sup_col = cell.column - 1
            if site_col is not None:
                break

        if site_col is None:
            return jsonify({"error": "Could not find a 'Site' column in the first 10 rows of the Excel file"}), 400

        sites = []
        for row in ws.iter_rows(min_row=header_row + 1):
            def cv(idx):
                return str(row[idx].value or "").strip() if idx is not None and idx < len(row) else ""
            name = cv(site_col)
            if not name:
                continue
            job  = normalize_job(cv(job_col)) if job_col is not None else ""
            sup  = cv(sup_col) if sup_col is not None else ""
            sites.append({"name": name, "job_code": job, "supervisor": sup})

        return jsonify({"sites": sites})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Excel report route (unchanged) ───────────────────────

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

    try:
        excel_bytes = excel_file.read()
        pdf_bytes   = pdf_file.read() if pdf_file and pdf_file.filename else None

        out = generate_report(from_date, to_date, excel_bytes, pdf_bytes)
        filename = f"Ashvale_Summary_{from_date}_to_{to_date}.xlsx"
        return send_file(out, as_attachment=True, download_name=filename,
                         mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Serve React app (catch-all for client-side routing) ──

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    static_dir = app.static_folder
    if path and os.path.exists(os.path.join(static_dir, path)):
        return send_from_directory(static_dir, path)
    return send_from_directory(static_dir, "index.html")


if __name__ == "__main__":
    os.makedirs("static", exist_ok=True)
    print("Open: http://localhost:5050")
    app.run(port=5050, debug=False)
