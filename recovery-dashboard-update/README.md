# Recovery Dashboard

A WHOOP-based recovery dashboard concept by SeungMin Lee: Oura-style readiness, sleep and strain scores, a muscle fatigue body map, an estimated stress and brain view, and food, workout and sleep logging.

## Features

- **Readiness, sleep, strain and stress widgets**: liquid-glass tiles you can press and hold to drag, and resize from the right edge
- **Under-recovery analysis**: when readiness drops below 67, lists the likely causes (HRV, resting HR, sleep debt, strain, temperature)
- **Muscle readiness map**: front and back anatomy with 18 muscle groups, fatigue modelled from logged lifts, synapse animation, and a hover thermal lens
- **Stress and brain view**: estimated from heart rate variability, resting heart rate, breathing and sleep. WHOOP does not measure brain activity, so these are estimates.
- **Logging**: food (full macros), workouts (lifts with load / RPE / reps, coach selection, set videos) and sleep (feel + notes)
- **Imports**: WHOOP CSV/ZIP export and Apple Health `export.xml`

## Run it

It's a single static page with no build step required.

```bash
open index.html          # macOS
# or serve it
python3 -m http.server 8000
```

Liquid-glass refraction renders fully in Chromium browsers (Chrome, Edge, Arc). Safari and Firefox get a frosted fallback.

## Saving data

The same page runs in two places:

- **Inside Claude** (as an artifact): saves through Claude, and Google Calendar can connect live through the Claude connector.
- **On Vercel**: saves to Supabase. People sign in with Google; each person's logs, layout, imports and set videos are private to them through row-level security. Google Calendar imports `.ics` files here.

## Deploy (Vercel + Supabase)

1. In Supabase, run `supabase/migrations/20261108000000_recovery_dashboard.sql` (SQL editor, or `supabase db push`). It creates the `rd_docs` table and a private `videos` bucket.
2. In Supabase → Authentication → Providers, turn on **Google** with a Google OAuth client. Add your Vercel URL under Authentication → URL Configuration (Site URL and Redirect URLs).
3. Put the project URL and publishable (anon) key in `config.js`.
4. Import the repo in Vercel as a static site (no build command, output = repo root). Every push to `main` redeploys.

## Project layout

```
index.html        built page (deployed by Vercel)
config.js         Supabase URL + publishable key for the Vercel build
supabase/         database migration
src/head.html     <head> and all CSS
src/body.html     markup
src/app.js        app logic
data/whoop.json   embedded sample WHOOP history
build.sh          rebuilds index.html from src/ and data/
```

After editing anything in `src/` or `data/`, run `./build.sh`.

## Credits

- Stacked bars and the thermal lens are adapted from [Bencho](https://bencho.dev) components (MIT, see `THIRD_PARTY_LICENSES.md`)
- [d3](https://d3js.org) (ISC) and [JSZip](https://stuk.github.io/jszip/) (MIT) loaded from cdnjs
- Muscle anatomy is an original drawing inspired by the layout of muscle-map.com
- Concept project, not affiliated with or endorsed by WHOOP, Oura or Apple
