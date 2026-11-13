# Astronaut Self-Assessment Panel

Prototype for the **NASA Space Apps Challenge 2026** challenge *"Software for Astronauts on Space Missions"* (health monitoring).

> **Prototype, not a medical device.** Nothing in this app is a diagnosis or treatment advice.

## What it does (implemented)

- Daily check-in for 7 indicators: resting heart rate, systolic/diastolic pressure, blood glucose, body temperature, sleep duration, mood (1–5 self-rating).
- Compares recent readings with the user's **own baseline** (first 7 readings) and shows one of four statuses: *Usual*, *Watch*, *Attention*, *No data*.
- **Missing data is never shown as "fine"**: indicators without enough data are grey and counted separately.
- Clickable body map + region list (keyboard accessible), trend charts with baseline band, "why it matters" and "how to measure" notes.
- Two clearly separated data sources: **Simulated demo** (fictional, labelled) and **My users** (stored only in the browser's localStorage).
- **Users:** add a user, select them, enter their values (up to 12 users; entries are per user).
- **Compare users:** latest value and status per person plus an overlay chart. Each status compares a person with their *own* baseline; differences between people are not a health judgment.
- **Real data (NASA OSDR):** study OSD-575 (SpaceX Inspiration4, four crew members, serum metabolic panel: glucose, potassium, sodium, albumin) shown descriptively. Values copied unchanged from the published file; the reference ranges are the laboratory's, as printed in the file. Four people only: no statistics, no prediction, no conclusions.
- Plain static site: no backend, no dependencies, works offline.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Tests

```bash
node tests/core.test.js       # no dependencies
node tests/i18n.test.js       # translation completeness
node tests/store.test.js      # users and entries
node tests/osdr.test.js       # real-data module
```

Covers baseline/deviation logic, edge cases (too few readings, zero variance, missing values), input validation and the simulated scenario.

## Languages
English, Türkçe, Italiano, Español (selector in the header; choice saved in this browser; default from browser language).
Translations are machine-assisted drafts and have **not** been reviewed by native-speaking or medical translators.

## How measurements get into the app, and how they are taken in space
**This prototype does not connect to any device.** Values are typed in by hand ("My entries") or come from fictional simulated data.

Sourced facts about spaceflight measurement (public NASA/CSA/JAXA material):
- ISS blood-pressure/ECG kit measures ECG, heart rate and blood pressure: https://ntrs.nasa.gov/api/citations/20190000238
- Medical Diagnostics Pack (BP cuffs, stethoscope, tonometer): https://ntrs.nasa.gov/api/citations/20110011351
- Crew take blood pressure with cuffs; data is downlinked to flight surgeons: NASA ISS blog, 2026-07-08
- CSA Bio-Monitor smart shirt (ECG/heart rate, blood pressure, respiration, SpO2, skin temperature, activity): https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp
- Sleep: wrist accelerometer (Actiwatch) plus daily subjective sleep logs: https://ntrs.nasa.gov/api/citations/20090014820
- Ultrasound with remote guidance from the ground (ADUM): https://iss.jaxa.jp (ultrasound page)
- Communication delay limits remote guidance on far missions, motivating autonomous tools: https://ntrs.nasa.gov/citations/20240004905

**Not verified:** in-flight glucose meter and thermometer specifics; there is no objective mood instrument (mood is self-report here).
Possible future step (proposal, not implemented): import of readings from a wearable/device file.

## Scientific status and limitations (please read)

| Item | Status |
|---|---|
| Challenge requirements | Taken from the official challenge page text (Intermediate, Human Exploration / Software / Space Exploration). |
| Status levels | **Statistical deviation from the user's own baseline** (|z| ≥ 2 = Watch, ≥ 3 = Attention). These cut-offs are configurable conventions, **not clinical thresholds**. |
| Input limits | Only reject physically impossible typing errors; they are not normal ranges. |
| Explanatory texts (`js/i18n.js`, keys `info.*`, `region.*`, `msg.*`) | **Draft. Not yet verified against NASA HRP sources.** Marked in the UI. |
| Indicator → hazard mapping | **Proposed mapping, unverified.** |
| Real data (`js/osdr.js`) | **Real, copied from NASA OSDR OSD-575** (checked 2026-11-10). Study text lists post-flight R+1/R+45/R+82; the file also has R+194. Three of four crew show glucose far below the lab range at R+45; the dataset does not explain this and the app does not interpret it. |
| Demo data (`js/demo.js`) | **Entirely fictional**, arbitrary parameters, makes no claim about real physiology. |
| No clinical reference ranges | None are used yet. If added, each needs population, units and a cited source, and must be labelled as terrestrial if it is not spaceflight-specific. |
| Not covered | Bone/muscle and immune indicators (shown as "no data"), radiation, environment, camera input, ML. |
| Guidance | The app only suggests *discussing a large change with the flight surgeon*. It gives no medication or treatment advice. |

## Structure

```
index.html          page
css/style.css       styles
js/core.js          pure logic: validation, baseline, status (tested)
js/demo.js          simulated data generator (fictional)
js/i18n.js          UI texts: English (source), Türkçe, Italiano, Español
js/content.js       region -> indicator / hazard structure
js/store.js         users and their entries (tested)
js/osdr.js          OSD-575 real data + descriptive helpers (tested)
js/charts.js        multi-series SVG chart
js/views.js         compare-users and real-data views
js/app.js           UI wiring
tests/core.test.js  unit tests (logic)
tests/i18n.test.js  unit tests (translations)
tests/store.test.js unit tests (users)
tests/osdr.test.js  unit tests (real data)
```

## Next steps

1. Verify and cite explanatory texts and hazard mapping from NASA HRP resources.
2. Decide which reference ranges (if any) to add, with sources.
3. Add measurement reminders and a bone/muscle or immune-related input if a sourced indicator is chosen.
