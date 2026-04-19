# Muhtawa — Excel and CSV import

Addresses the "I have my data but don't want to retype it" activation
problem. Two new ways to get data into the calculator without typing:

1. **Upload the official LCGPA V2 Excel** and have it parsed automatically
2. **Import a supplier list from CSV** using a downloadable template

Both run fully in the browser — no server, no API cost, no uploaded-file
storage.

## What's new

### Excel import

A new **"Import from LCGPA Excel"** button on the new-assessment picker
screen (same screen as the sample cases). The flow:

1. User clicks the button, picks an `.xlsx` file
2. We verify the file has the expected Arabic sheet names from the
   official template (OM-LRG-02 V.2). Wrong file → clear error.
3. We extract Section 3 (labor), Section 4 (goods & services, up to 80
   supplier rows, other costs, inventory), Section 6 (capacity
   building), Section 7 (depreciation by asset class)
4. We show a **review screen** with the extracted numbers and the
   computed LC score before dropping into the calculator

The review screen is deliberate — imports aren't a black box. Users
see exactly what we pulled out of their file, including the resulting
score, before committing. They can cancel and pick a different file.

SheetJS is loaded from CDN on first use (~1MB) rather than bundled, so
users who never import pay no cost.

### CSV supplier import

On the Goods & Services tab of the calculator, next to the "+ Add
Supplier" button, there's now an **"↑ Import CSV"** button and a
**"Download CSV template"** link. The CSV format is intentionally
simple:

```
Name,SectorID,Origin,Expense,AuditedScore
Al Faisal Consulting,5,Local,1500000,
Saudi Security Co,4,Local,400000,
Imported Machinery Agent,37,Local,2500000,
Foreign Consulting,23,Foreign,800000,0.85
```

Five columns. `SectorID` is the numeric ID 1-38 from Appendix B.
`AuditedScore` is optional; accepts `0.85` or `85` or `85%`.

The downloaded template includes all 38 sector IDs as reference
comments at the bottom (prefixed with `#`) so users don't have to
leave the file to look up a sector.

CSV rows are **appended** to existing suppliers, not replaced —
safer default. Bad rows (missing name, unknown sector, negative
expense) are skipped with row-numbered warnings shown inline.

### Verified against Excel

The Excel parser was tested by round-tripping: filled in the official
template with known values, parsed it with our new code, scored the
result — **matches Excel's native computation to 14 decimal places**
(0.825737976782753).

## Files changed

- **new**: `src/lib/importers.js` — Excel parser, CSV parser, CSV
  template builder
- **modified**: `src/App.jsx`
  - New imports from `importers.js`
  - New `importResult` state, `import-review` route, `ImportReview`
    component
  - SamplePicker updated to include the Excel upload option at the
    top (labeled "Fastest")
  - Calculator's goods tab: `+ Add Supplier` and `↑ Import CSV`
    buttons side-by-side, with a "Download CSV template" link under
    them and an inline message banner for import results/warnings

## Deploy

From Git Bash in your `muhtawa-project` repo root:

```bash
tar -xzf muhtawa-import.tar.gz
git status
git add -A
git commit -m "Add LCGPA Excel + supplier CSV import"
git push
```

No env vars, no DB migrations. SheetJS loads from `cdnjs.cloudflare.com`
on demand.

## Smoke tests

### Excel import
1. Dashboard → **+ New** → picker screen shows a new option at the top:
   **"Import from LCGPA Excel"** in green with a "Fastest" tag.
2. Click it, pick a filled-in LCGPA V2 template. You should land on a
   **Review screen** showing:
   - File name
   - Computed LC score as a big number
   - Four summary cards: Labor, G&S, Capacity, Depreciation
   - First 8 suppliers with their sector and expense
   - **Open in Calculator →** button at the bottom
3. Click **Open in Calculator**. You should see all the numbers already
   filled in across the Labor / Goods & Services / Capacity /
   Depreciation tabs.
4. Try uploading a non-LCGPA Excel (e.g. any random spreadsheet). You
   should see a clear error: "This does not look like the official
   LCGPA V2 template…".

### CSV import
1. Open the Calculator on any assessment (new or existing).
2. Goods & Services tab, scroll to the "+ Add Supplier" button.
3. Click **"Download CSV template"** underneath. A file called
   `muhtawa-supplier-template.csv` downloads.
4. Open it in Excel. The header row is `Name,SectorID,Origin,Expense,AuditedScore`.
   Below are 4 example rows, then all 38 sectors listed as comments.
5. Fill in a few of your own supplier rows (delete the examples first
   if you want). Save as CSV. Upload via **"↑ Import CSV"**.
6. You should see a green success message showing how many suppliers
   were added. They appear in the supplier list above.
7. Try a CSV with a bad sector ID (e.g. `999`). Should import the good
   rows and show a yellow warning for the skipped row.

## Known limits

- Excel parser only accepts the **official LCGPA V2 template** with
  original Arabic sheet names. Users who have modified their sheet
  names or built their own format will see the "not the official
  template" error. This is intentional — trying to fuzzy-match arbitrary
  spreadsheets would produce silent wrong scores.
- The Excel import sets `Origin` to "Foreign" if the F column contains
  Arabic "أجنبي" or English "foreign", otherwise "Local". If users have
  written something creative in that column it'll default to "Local".
- The CSV parser requires the specific five column headers. It's
  forgiving about BOM, quote escaping, and extra whitespace, but not
  about missing columns.
- Uploaded files are parsed in the browser and never sent to a server.
  This means no storage cost but also no history of uploads — the user
  needs the original file if they want to re-import.

## Still deferred

- **Tier 2 — AI-powered arbitrary file analysis** (upload any PDF or
  Excel; Claude Vision extracts the structure). This needs an API
  endpoint with the same auth/rate-limiting treatment we did for
  `/api/chat`, a review/correction UI, and careful prompt work to
  produce reliable extraction. It's worth doing but needs a dedicated
  session.
- **Arabic UI** (pending your green light on scope — likely a
  multi-session effort to do well).
