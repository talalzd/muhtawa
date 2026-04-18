# Muhtawa — LCGPA Template V2 scoring update

Updates the scoring engine to match the official LCGPA 2025 measurement template
(OM-LRG-02, V.2). Verified bit-exact against the Excel spreadsheet using the
LibreOffice formula engine — every total and sub-total matches to 14 decimal
places.

## What changed

### Weight changes (constants)

| Factor                                       | V7 (old) | V2 (new) |
| -------------------------------------------- | -------- | -------- |
| Labor — Saudi                                | 100%     | 100%     |
| Labor — Foreign                              | **37%**  | **53.4%**|
| Depreciation — KSA-produced assets           | 100%     | 100%     |
| Depreciation — Foreign-produced assets       | **20%**  | **30%**  |
| Buildings & Land Improvements in KSA         | 100%     | 100% (always, now explicit) |

### Main formula changes

Final LC % now correctly **adds** the R&D incentive to the LC/Cost ratio,
capped at 100%. Previously the incentive was computed and displayed but
never actually contributed to the score. The corrected formula matches
Excel Section 2, cell C18:

```
Final LC % = min(1, (TotalLC / TotalCost) + R&D_Incentive)
```

### Goods & Services formula changes

- **Inventory movement** (previously 0% LC) now uses the **weighted average**
  LC score of listed suppliers. Matches Excel cell K95.
- **NEW: Remaining G&S** — if you enter a total G&S expense greater than the
  sum of listed suppliers + other costs + inventory, the difference is
  auto-scored at the weighted average LC. Matches Excel cells L96/K96/M96.
- Other disallowable costs still score at 0%.

### Sector list (Appendix B)

**38 sectors** instead of 39, with many weight increases:

| Sector                           | V7    | V2    |
| -------------------------------- | ----- | ----- |
| Industrial Services              | 30%   | **36%** |
| Security Services                | 70%   | **82%** |
| Real Estate Services             | 40%   | **48%** |
| Construction Services            | 35%   | **40%** |
| Healthcare Services              | 29%   | **38%** |
| Transport & Logistics            | 40%   | **45%** |
| Cars/Trucks/Equipment Rental     | 25%   | **35%** |
| Manpower Supply                  | 45%   | **59%** |
| IT & Telecom Services            | 30%   | **41%** |
| Other Services                   | 20%   | **35%** |
| Chemicals, Oil & Gas             | 50%   | **61%** |
| Chemical Blending                | 10%   | **29%** |
| Machinery & Equipment            | 20%   | **25%** |
| Mining Products                  | 34%   | **45%** |
| Other Local Products             | 22%   | **30%** |

**Removed:**
- `KSA High LC Companies` (Aramco, SABIC, SEC, etc. at 50%) — these now fall
  under their operating sector (e.g. Aramco → Chemicals/Oil & Gas at 61%).

**Added:**
- `KSA Utility Services` (61%) — electricity, water, sewerage. Applies to
  SEC, NWC, SWCC, Marafiq, etc.

**Merged:**
- `KSA Facility Rental` merged with `KSA Accommodation` (same 60% rate).

**Renumbered:** sector IDs are now 1-38 (match official Excel numbering
exactly). Existing assessments saved under old IDs still render their score
correctly because the **sectorScore** is saved alongside the ID on each
supplier; only the sector *label* may change when you next edit that
supplier.

### UI changes

- Added **Total G&S Expense** input at the top of the Goods & Services tab.
  Triggers the "remaining" auto-calculation and shows supplier-coverage %.
- Added **Asset Class** dropdown in Depreciation. Buildings & Land
  Improvements always score 100% (the "Made in KSA?" select is disabled in
  that case).
- Updated all tab headings to V2 section numbers
  (e.g. "Section 7: Depreciation" was "Section 6").
- "LCGPA Template V7" subtitle is now "LCGPA Template V.2".
- AI Advisor context now describes V2 rules.

### Bug fixes also shipped

- **Labor Saudization recommendation math** (the #5 issue from last session).
  Correctly computes how much Saudi comp to add to reach a 60% share
  (previously assumed total stayed fixed). Formula:
  `additional = (0.6·Total − Saudi) / 0.4`

### Not touched

- `auditedScore` edge case (#9) — verified it matches Excel's
  `K = IF(I <= 0, J, I)` exactly, so left as-is.
- `parse-pdf.js` — stays removed per your earlier instruction.

## Verification

The `test-scoring.mjs` script feeds a sample assessment through both the
JavaScript engine and the actual Excel template (via LibreOffice):

```
  Labor LC:       Excel=   1,267,000   JS=     1,267,000
  G&S LC:         Excel=     427,000   JS=       427,000
  Depreciation:   Excel=     560,000   JS=       560,000
  Total LC:       Excel=   2,369,000   JS=     2,369,000
  Total Cost:     Excel=   3,015,000   JS=     3,015,000
  Final Score:    Excel=      82.6%    JS=        82.6%
```

Final score matches to 14 decimal places: `0.825737976782753`.

Plus 12 edge-case tests (empty assessment, backward compat, negative
inventory, R&D caps, building asset override, audited-score fallback, etc.)
— all passing.

## Deploy

From Git Bash in your `muhtawa-project` repo root:

```bash
tar -xzf muhtawa-v2-scoring.tar.gz
git status
git diff src/lib/sectors.js | head -40
git diff src/lib/scoring.js | head -40

git add -A
git commit -m "LCGPA Template V2: update weights, formulas, sectors to match official Excel"
git push
```

Vercel will auto-deploy. No env vars or DB migrations needed for this change
(unlike the security update).

## Smoke tests after deploy

1. Open the Calculator. The subtitle should read "LCGPA Template V.2".
2. Labor tab: Foreign comp line should say "53.4% → SAR …" (was 37%).
3. Goods tab: a "Total G&S Expense" input now appears at the top. Enter a
   value bigger than your listed suppliers and confirm the supplier-coverage
   text + remaining SAR line appears.
4. Depreciation tab: there's now an "Asset Class" dropdown. Pick "Buildings
   & Land Improvements" and watch the "Made in KSA?" select go disabled with
   100% locked in.
5. Capacity tab: R&D incentive now shows "(added to final score)" after the
   %, and the final score card on top reflects the bonus.
6. Open an existing assessment. It should load and compute without error —
   existing supplier data retains its original score because `sectorScore`
   is saved per-supplier.

## Migration note for users with old assessments

If any supplier in an old assessment was classified as *KSA High LC
Companies* (former sector 38, at 50%), that supplier will now display as
"Foreign Goods" (new sector 38, at 0%) if you re-open and edit it. You'll
need to reclassify those suppliers — typically Aramco, SABIC, SEC should
become Chemicals & Oil & Gas (26) or Utility Services (21). Consider
adding a note in the release announcement.
