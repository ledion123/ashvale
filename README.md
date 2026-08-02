# Ashvale Compliance Dashboard

Weekly safety-inspection compliance dashboard for construction sites, integrating with the SafetyCulture API. Flask backend + React (Vite) frontend, deployed on Vercel.

## Local development

Backend:
```
pip install -r requirements.txt
cp .env.example .env   # fill in real values, see below
python app.py          # http://localhost:5050
```

Frontend (builds straight into `static/`, served by Flask):
```
cd frontend
npm install
npm run dev             # dev server with hot reload
npm run build            # production build -> ../static/
```

## Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SAFETYCULTURE_API_TOKEN` | Yes | SafetyCulture API token. Without it every SafetyCulture-backed endpoint fails — check `GET /api/health` to confirm it's configured. |
| `APP_USER` / `APP_PASS` | No | HTTP Basic Auth gate for the whole app. If either is unset, auth is **disabled** (a warning is logged on startup when this happens). |

## Deployment checklist (Vercel)

**Setting `.env` locally is not enough — env vars must also be set in the Vercel project dashboard.** This bit us once already: a hardcoded fallback token was removed from `sc_client.py` for security, and the deployed app broke because `SAFETYCULTURE_API_TOKEN` had never been configured on Vercel itself.

Before/after every deploy:
1. Vercel project → **Settings → Environment Variables** → confirm `SAFETYCULTURE_API_TOKEN` is set for Production (and Preview, if used).
2. `curl https://<your-deployment>/api/health` → should return `{"status": "ok", "safetyculture_token_configured": true}`. A `503` here means the token isn't configured on Vercel.
3. If you use the Basic Auth gate, confirm `APP_USER`/`APP_PASS` are also set there.

## Architecture notes

- The dashboard cache (`_CACHE_FILE`) is a per-instance, best-effort file cache in `/tmp` — on Vercel's serverless model this is not shared across instances, so don't rely on it for correctness, only as a same-instance speedup.
- `search_templates()` in `app.py` is the shared helper for fanning out SafetyCulture template searches in parallel; it raises if *every* template search fails (surfacing a real error) but degrades gracefully with a `warnings` field on partial failures.
