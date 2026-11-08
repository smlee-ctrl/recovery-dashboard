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

The page was built as a Claude artifact. Logs, layout, imports and videos are saved through the artifact runtime (`window.claude`). Opened anywhere else, the dashboard and analysis still work, but new entries reset on reload. To keep data on your own host, replace `connect()`, `addLog()`, `savePrefs()` and `persistSource()` in `src/app.js` with localStorage or a backend.

## Project layout

```
index.html        built page (ready to deploy, e.g. GitHub Pages)
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
