# Muhtawa — sample assessment cases

Adds three sample assessment cases to address the activation funnel
problem: new users land on an empty calculator, don't have their own
financials handy, and bounce before seeing the product work. Now they
can load a realistic pre-built case in one click, see a score in under
10 seconds, and understand *why* it scored that way.

## What's new

### A picker screen before the calculator

Clicking "+ New" on the dashboard no longer dumps users straight into a
blank calculator. It now goes to a picker with two options:

1. **Start with a blank assessment** (the existing flow, preserved)
2. **Try a sample case** — three pre-built scenarios, each with a
   sector dropdown to theme the supplier list to the user's industry

### Three sample cases

Every case is tuned to land in a specific score range regardless of
which industry is picked:

| Case                | Score range    | Industry flavors tested |
| ------------------- | -------------- | ----------------------- |
| Below Threshold     | 28.6% – 30.1%  | all below 40%           |
| Just at Threshold   | 42.5% – 46.4%  | all above 40%           |
| Well Above          | 62.9% – 66.9%  | all clearly high        |

Six sector flavors available: Generic, Construction, IT, Healthcare,
Manufacturing, Professional Services.

All 18 case × sector combinations have been run through the scoring
engine and verified against Excel-compatible formulas.

### An educational "story" banner

When a sample is loaded, a banner appears at the top of the calculator
explaining the score. Two-column layout:

- **Why this score** — four concrete drivers (what's pulling the
  score up or down), with up/down arrows and specific numbers from the
  assessment
- **Levers to pull** — three actionable changes the company could
  make to improve the score, with the LCGPA mechanism behind each

The banner is dismissible via a "Hide" button. Dismissal is stored in
the assessment itself (`storyDismissed: true`) so it won't reappear on
reload.

### Dashboard label

Sample assessments show their sample name (e.g. "Sample: At Threshold
(~43%)") on the dashboard list, making them easy to distinguish from
real assessments.

## Files changed

- **new**: `src/lib/samples.js` — sample data, supplier profiles per
  sector, and the educational story text
- **modified**: `src/App.jsx` — imports `samples.js`, adds
  `SamplePicker` and `SampleStoryBanner` components, routes "+ New"
  through the picker first

Scoring layer (`scoring.js`, `sectors.js`) is unchanged.

## Deploy

From Git Bash in your `muhtawa-project` repo root:

```bash
tar -xzf muhtawa-samples.tar.gz
git status
# Expected:
#   new file:   src/lib/samples.js
#   modified:   src/App.jsx

git add -A
git commit -m "Add sample assessment cases with educational explanations"
git push
```

No env vars, no DB migrations.

## Smoke tests

1. Sign in, go to dashboard, click **+ New**. You should land on the
   new sample picker (not directly in the calculator).
2. Click **Start with a blank assessment** — should work exactly as
   before. Back button works.
3. Back on the picker, change the sector dropdown to "Construction &
   Engineering", click **Case 1 — Below Threshold**. You should see:
   - A red-tinted sample banner at the top with headline "Why this
     company scored below 40%"
   - Four drivers in the left column
   - Three levers in the right column
   - A score around 29-30% in the top summary card
4. Click "Hide" on the banner — it disappears. Navigate away and come
   back — stays hidden.
5. Check the supplier list on the **Goods & Services** tab: should
   show construction-themed suppliers (imported heavy machinery,
   imported rebar distributor, etc.).
6. Try **Case 2** with the IT sector — should land around 42%.
7. Try **Case 3** with any sector — should land around 64%.
8. Go back to the dashboard. The sample assessment should appear in
   your list with its name (e.g. "Sample: High LC Score (~65%)")
   rather than just a date.

## Notes on copy / tuning

The `samples.js` file is plain JS and easy to edit if you want to:

- Change the sample names (currently "Sample: Low LC Score (~29%)"
  etc. — you may want to shorten these)
- Add more sector flavors
- Adjust the supplier lists, labor numbers, or asset values
- Rewrite the educational copy in Arabic if you want a bilingual
  version later

The scoring engine is not touched by any of this — the samples just
feed it realistic inputs.

## Known limitation

The sector picker changes *which suppliers* appear in the sample, but
the labor, capacity, and depreciation numbers stay the same across
sectors. This keeps the score in the target range consistently and
keeps the sample data manageable. If you want fully sector-specific
assessments (e.g. construction firms have much higher CAPEX and lower
R&D than IT firms), that's a bigger structural change — happy to
tackle it in a follow-up.
