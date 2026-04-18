import {
  LABOR_SAUDI_FACTOR,
  LABOR_FOREIGN_FACTOR,
  DEPRECIATION_LOCAL_FACTOR,
  DEPRECIATION_FOREIGN_FACTOR,
  DEPRECIATION_BUILDING_FACTOR,
  RD_INCENTIVE_MAX,
  RD_REVENUE_THRESHOLD,
  LC_THRESHOLD,
  SECTORS,
  ASSET_TYPES,
  TEMPLATE_VERSION,
} from './sectors.js'

export { LC_THRESHOLD, TEMPLATE_VERSION }

// ─── computeScore ─────────────────────────────────────────────────────
// Mirrors the official LCGPA Template V2 (OM-LRG-02 V.2) formulas.
//
// Main LC % formula (Section 2, cell C18):
//   = min(1, (TotalLC / TotalCost) + R&D_Incentive)
//
// TotalLC   = Labor LC + G&S LC + Training + Supplier Dev + R&D + Depreciation LC
// TotalCost = Labor Total + G&S Total + Training + Supplier Dev + R&D + Depreciation Total
//
// R&D Incentive (up to 10%) is ADDED directly to the percentage, not
// through the LC/Cost ratio. This is a key change from V7.
export function computeScore(a) {
  // ── Section 3: Labor ────────────────────────────────────────────────
  // Saudi at 100%, foreign at 53.4% (V2 — was 37% in V7)
  const saudiComp = Math.max(0, a.labor?.saudiComp || 0)
  const foreignComp = Math.max(0, a.labor?.foreignComp || 0)
  const laborSaudi = saudiComp * LABOR_SAUDI_FACTOR
  const laborForeign = foreignComp * LABOR_FOREIGN_FACTOR
  const laborLC = laborSaudi + laborForeign
  const laborTotal = saudiComp + foreignComp

  // ── Section 4: Goods & Services ─────────────────────────────────────
  // Mirrors Section 4 columns K, L, M (Excel):
  //   K = approved LC % = IF(audited > 0, audited, sector)
  //   M = expense × K
  // Plus three buckets at the bottom of the table:
  //   Row 94 "Other disallowable costs"  → 0% LC (K94 = 0)
  //   Row 95 "Inventory movement"        → weighted average LC
  //   Row 96 "Remaining G&S"             → weighted average LC
  // Weighted avg = SUMPRODUCT(listed expense, listed approved%) / SUM(listed expense)
  let listedSupplierExpense = 0
  let listedSupplierLC = 0
  ;(a.suppliers || []).forEach((s) => {
    const exp = Math.max(0, s.expense || 0)
    // Audited score takes precedence only if strictly > 0 and <= 1
    // (matches Excel: K = IF(I <= 0, J, I))
    const auditedValid =
      typeof s.auditedScore === 'number' &&
      s.auditedScore > 0 &&
      s.auditedScore <= 1
    const selectedScore = auditedValid
      ? s.auditedScore
      : Math.max(0, Math.min(1, s.sectorScore || 0))
    listedSupplierExpense += exp
    listedSupplierLC += exp * selectedScore
  })

  const weightedAvgLC =
    listedSupplierExpense > 0 ? listedSupplierLC / listedSupplierExpense : 0

  // Other disallowable costs: unallocated operating costs, scored at 0%.
  // Inventory movement: +/- adjustment, scored at weighted avg (V2 change).
  const otherCosts = Math.max(0, a.otherCosts || 0)
  const inventoryMovement = a.inventoryMovement || 0

  // Total G&S expense as declared by the entity (from its financials).
  // This matches Section 4 cell C9. If the user provides it and it exceeds
  // the sum of listed items, the difference is treated as "Remaining G&S"
  // and gets the weighted-average LC score.
  const declaredTotalGS = Math.max(0, a.totalGSExpense || 0)
  const listedPlusBuckets = listedSupplierExpense + otherCosts + inventoryMovement
  const remainingGS =
    declaredTotalGS > listedPlusBuckets ? declaredTotalGS - listedPlusBuckets : 0

  // Contributions
  const gsOtherLC = otherCosts * 0 // explicit zero for clarity
  const gsInventoryLC = inventoryMovement * weightedAvgLC
  const gsRemainingLC = remainingGS * weightedAvgLC
  const gsLC = listedSupplierLC + gsOtherLC + gsInventoryLC + gsRemainingLC

  // Total G&S cost: use declared total if provided, otherwise fall back to
  // the sum of what was entered. This drives the denominator in LC/Cost.
  const gsTotal =
    declaredTotalGS > 0 ? declaredTotalGS : listedPlusBuckets

  // ── Section 6: Capacity Building ────────────────────────────────────
  // Training, supplier development, and R&D all count at 100% LC on the
  // input value. R&D also triggers a separate incentive % (see below).
  const trainingLC = Math.max(0, a.training || 0)
  const supplierDevLC = Math.max(0, a.supplierDev || 0)
  const rdExpense = Math.max(0, a.rdExpense || 0)
  const totalRevenue = Math.max(0, a.totalRevenue || 0)
  const rdRatio = totalRevenue > 0 ? rdExpense / totalRevenue : 0
  // Incentive: 10% × (R&D/Revenue ÷ 2%), capped at 10%.
  // Matches Excel Section 6 cell C17:
  //   = IF(C15/C16 >= 2%, 10%, 10% × ((C15/C16)/2%))
  const rdIncentive = Math.min(rdRatio / RD_REVENUE_THRESHOLD, 1) * RD_INCENTIVE_MAX
  const capacityLC = trainingLC + supplierDevLC + rdExpense

  // ── Section 7: Depreciation & Amortization ──────────────────────────
  // Buildings & Land Improvements in KSA always count at 100%.
  // All other assets: local 100%, foreign 30% (V2 — was 20% in V7).
  // Assessment structure for backward compatibility: assets have
  // `producedInKSA` (bool) and optionally `assetType` (string). If
  // assetType === 'BUILDING', always full credit.
  let depTotal = 0
  let depLC = 0
  ;(a.assets || []).forEach((asset) => {
    const amt = Math.max(0, asset.amount || 0)
    const typeDef = ASSET_TYPES.find((t) => t.id === asset.assetType)
    const isAlwaysLocal = !!(typeDef && typeDef.alwaysLocal)
    let factor
    if (isAlwaysLocal) {
      factor = DEPRECIATION_BUILDING_FACTOR // 100% regardless of origin
    } else if (asset.producedInKSA) {
      factor = DEPRECIATION_LOCAL_FACTOR // 100%
    } else {
      factor = DEPRECIATION_FOREIGN_FACTOR // 30% (V2)
    }
    depTotal += amt
    depLC += amt * factor
  })

  // ── Total LC ratio + R&D incentive (Section 2, cell C18) ────────────
  const totalLC = laborLC + gsLC + capacityLC + depLC
  const totalCost = laborTotal + gsTotal + capacityLC + depTotal
  const rawLcRatio = totalCost > 0 ? Math.max(0, totalLC / totalCost) : 0
  // IMPORTANT: R&D incentive is added to the LC ratio per V2 formula.
  // Capped at 100%. This is a change from the previous app behaviour
  // which reported the incentive separately.
  const totalScore = Math.min(1, rawLcRatio + rdIncentive)

  const gap = Math.max(0, LC_THRESHOLD - totalScore)
  const meetsThreshold = totalScore >= LC_THRESHOLD

  // Contribution % of total cost (for the summary cards)
  const laborPct = totalCost > 0 ? laborLC / totalCost : 0
  const gsPct = totalCost > 0 ? gsLC / totalCost : 0
  const capacityPct = totalCost > 0 ? capacityLC / totalCost : 0
  const depPct = totalCost > 0 ? depLC / totalCost : 0

  // Saudization ratio for recommendations
  const saudiRatio = laborTotal > 0 ? saudiComp / laborTotal : 0

  return {
    // Labor
    laborSaudi, laborForeign, laborLC, laborTotal, saudiRatio,
    // G&S
    gsLC, gsTotal,
    listedSupplierExpense, listedSupplierLC,
    weightedAvgLC, otherCosts, inventoryMovement,
    declaredTotalGS, remainingGS,
    gsInventoryLC, gsRemainingLC,
    // Capacity
    trainingLC, supplierDevLC, rdExpense, rdRatio, rdIncentive, capacityLC,
    // Depreciation
    depLC, depTotal,
    // Totals
    totalLC, totalCost,
    rawLcRatio,           // LC/Cost ratio alone, before incentive
    totalScore,           // Final LCGPA score = ratio + incentive, capped at 100%
    gap, meetsThreshold,
    // Contribution shares
    laborPct, gsPct, capacityPct, depPct,
  }
}

// ─── LCGPA V2-referenced recommendations ───────────────────────────────
export function getRecommendations(score, a) {
  const recs = []

  // Overall status
  if (score.meetsThreshold) {
    recs.push({
      type: 'success',
      title: 'Threshold Met',
      ref: 'LCGPA Executive Regulations, Article 11',
      text: `Your LC score of ${pct(score.totalScore)} meets the ${pct(LC_THRESHOLD)} minimum required for government procurement eligibility. Continue strengthening local content to improve your competitive position in tender evaluations.`,
    })
  } else {
    const gapSAR = score.totalCost > 0 ? score.gap * score.totalCost : 0
    recs.push({
      type: 'critical',
      title: 'Below Minimum Threshold',
      ref: 'LCGPA Executive Regulations, Article 11',
      text: `Your score is ${pct(score.gap)} below the ${pct(LC_THRESHOLD)} threshold. You need approximately SAR ${fmt(gapSAR)} in additional local content contribution to become eligible for government procurement.`,
    })
  }

  // ── Section 3: Labor ────────────────────────────────────────────────
  // Saudi at 100%, foreign at 53.4%. If Saudi share is below 50%,
  // suggest a shift toward a 60/40 split.
  // Corrected math: to reach X% Saudi share of the new total (by adding
  // only to Saudi comp, foreign unchanged):
  //   additional = (X·Total − Saudi) / (1 − X)
  if (score.laborTotal > 0 && score.saudiRatio < 0.5) {
    const target = 0.6
    const currentSaudi = a.labor?.saudiComp || 0
    const additionalNeeded = Math.max(
      0,
      (target * score.laborTotal - currentSaudi) / (1 - target)
    )
    // Additional LC contribution from adding Saudi comp (100% vs 53.4%
    // for the foreign comp it replaces in the ratio):
    const scoreGain = additionalNeeded > 0 && score.totalCost > 0
      ? (additionalNeeded * (LABOR_SAUDI_FACTOR - 0)) / (score.totalCost + additionalNeeded)
      : 0
    recs.push({
      type: 'warning',
      title: 'Low Saudization in Compensation',
      ref: 'Template V2, Section 3 — Labor Compensation',
      text: `Saudi employee compensation is ${pct(score.saudiRatio)} of total labor cost. Saudi compensation counts at 100% LC versus 53.4% for foreign employees. Adding SAR ${fmt(additionalNeeded)} in Saudi compensation would bring your Saudi share to 60% and add approximately ${pct(scoreGain)} to your overall score.`,
    })
  }

  if (score.laborTotal === 0 && score.totalCost > 0) {
    recs.push({
      type: 'info',
      title: 'No Labor Data Entered',
      ref: 'Template V2, Section 3 — Labor Compensation',
      text: 'Labor compensation (Saudi and foreign salaries, wages, bonuses, GOSI contributions, allowances) is typically the largest scoring category. Enter your previous financial year labor data for an accurate score.',
    })
  }

  // ── Section 4: Goods & Services ─────────────────────────────────────
  // Flag foreign and low-LC supplier spend. Foreign goods (id 38),
  // foreign services (id 23), foreign agents (id 22), and local
  // agents/distributors (id 37) all score at 5% or below.
  const lowLCIds = new Set([22, 23, 37, 38])
  const foreignSuppliers = (a.suppliers || []).filter((s) => {
    const sector = SECTORS.find((sec) => sec.id === s.sectorId)
    if (!sector) return false
    return lowLCIds.has(sector.id) || sector.origin === 'Foreign' || sector.score <= 0.05
  })
  if (foreignSuppliers.length > 0) {
    const foreignSpend = foreignSuppliers.reduce(
      (sum, s) => sum + Math.max(0, s.expense || 0),
      0
    )
    const potentialGain = foreignSpend * 0.3
    recs.push({
      type: 'warning',
      title: 'Foreign or Low-LC Supplier Spend',
      ref: 'Template V2, Section 4.2 — Goods and Services; Appendix B',
      text: `SAR ${fmt(foreignSpend)} is spent with foreign suppliers, foreign-service agents, or local agents/distributors (LC score 0-5%). Switching to local manufacturers or service providers in equivalent sectors could add up to ${pct(potentialGain / (score.totalCost || 1))} to your score. Per LCGPA guidelines, list at least 70% of G&S expense or top 40 suppliers.`,
    })
  }

  // Utility Services is a new sector in V2 at 61% LC — encourage using it
  // where applicable (SEC, NWC, SWCC, etc.)
  const hasUtility = (a.suppliers || []).some((s) => s.sectorId === 21)
  if (!hasUtility && score.gsTotal > 0) {
    recs.push({
      type: 'info',
      title: 'Utility Services Sector (New in V2)',
      ref: 'Template V2, Appendix B, Sector 21',
      text: 'Procurement from local utility providers (electricity, water supply, sewerage) counts at 61% LC — one of the highest rates. If any of your suppliers fall into this category (SEC, NWC, SWCC, Marafiq, etc.), classify them as "KSA Utility Services" for accurate scoring.',
    })
  }

  // Coverage: if user provided a total G&S expense, check supplier coverage
  if (score.declaredTotalGS > 0 && score.listedSupplierExpense > 0) {
    const coverage = score.listedSupplierExpense / score.declaredTotalGS
    if (coverage < 0.7) {
      recs.push({
        type: 'warning',
        title: 'Supplier Coverage Below 70%',
        ref: 'Template V2, Section 4.2, Footnote 3',
        text: `Listed suppliers cover ${pct(coverage)} of total G&S expense. LCGPA requires at least 70% coverage or the top 40 suppliers in descending order. The remaining SAR ${fmt(score.remainingGS)} is currently scored at the weighted-average LC of your listed suppliers (${pct(score.weightedAvgLC)}).`,
      })
    }
  }

  // ── Section 6: Capacity Building ────────────────────────────────────
  if (score.rdIncentive < RD_INCENTIVE_MAX && (a.totalRevenue || 0) > 0) {
    const targetRD = (a.totalRevenue || 0) * RD_REVENUE_THRESHOLD
    const currentRD = a.rdExpense || 0
    const needed = Math.max(0, targetRD - currentRD)
    recs.push({
      type: 'info',
      title: 'R&D Incentive Score Available',
      ref: 'Template V2, Section 6.3 — R&D',
      text: `Your R&D spend is ${pct(score.rdRatio)} of revenue (${pct(RD_REVENUE_THRESHOLD)} required for full incentive). Currently earning ${pct(score.rdIncentive)} bonus. Investing an additional SAR ${fmt(needed)} in KSA-based R&D would earn the full 10% bonus, added directly to your LC score.`,
    })
  }

  if (score.trainingLC === 0 && score.totalCost > 0) {
    recs.push({
      type: 'info',
      title: 'No Saudi Training Expenses',
      ref: 'Template V2, Section 6.1 — Training of Saudis',
      text: 'Training expenses for Saudi employees (including trainee costs and scholarships) count at 100% toward local content. Note: training expenses must not be double-counted with labor compensation in Section 3.',
    })
  }

  if (score.supplierDevLC === 0 && score.gsTotal > 0) {
    recs.push({
      type: 'info',
      title: 'No Supplier Development Expenses',
      ref: 'Template V2, Section 6.2 — Supplier Development',
      text: 'Expenses on developing KSA-registered suppliers (training, capability enhancement) count at 100% toward LC. This is a direct way to increase your score while strengthening your local supply chain.',
    })
  }

  // ── Section 7: Depreciation ─────────────────────────────────────────
  // Under V2: KSA 100%, foreign 30% (up from 20%). Buildings & land
  // improvements in KSA are always 100%.
  const foreignAssets = (a.assets || []).filter((ast) => {
    const typeDef = ASSET_TYPES.find((t) => t.id === ast.assetType)
    const isAlwaysLocal = !!(typeDef && typeDef.alwaysLocal)
    return !isAlwaysLocal && !ast.producedInKSA
  })
  if (foreignAssets.length > 0) {
    const foreignDep = foreignAssets.reduce(
      (sum, ast) => sum + Math.max(0, ast.amount || 0),
      0
    )
    // Potential gain from switching foreign → KSA = (1.0 − 0.30) × amount
    const potentialGain = foreignDep * (DEPRECIATION_LOCAL_FACTOR - DEPRECIATION_FOREIGN_FACTOR)
    recs.push({
      type: 'info',
      title: 'Foreign Asset Depreciation',
      ref: 'Template V2, Section 7.2 — Productive Asset Classes',
      text: `SAR ${fmt(foreignDep)} in depreciation is from foreign-produced assets (scored at 30% under V2, up from 20%). KSA-produced assets score at 100%. Future capital purchases from KSA manufacturers could add ${pct(potentialGain / (score.totalCost || 1))} to your score. Buildings and land improvements in KSA are always 100% regardless of origin.`,
    })
  }

  return recs
}

// ─── FIELD TOOLTIPS — LCGPA V2 references ──────────────────────────────
export const TOOLTIPS = {
  saudiComp: {
    label: 'Saudi Employee Compensation',
    help: 'Total salaries, wages, bonuses, allowances (transport, housing), leave, end-of-service benefits, and GOSI contributions for Saudi employees and those treated as Saudi. Excludes trainee rewards (counted in Section 6).',
    ref: 'V2 Section 3, Footnotes 1-3',
    factor: '100% LC contribution',
  },
  foreignComp: {
    label: 'Foreign Employee Compensation',
    help: 'Same compensation components as Saudi employees, but for foreign (non-Saudi) workforce in KSA operations for the previous financial year.',
    ref: 'V2 Section 3, Footnotes 1-2',
    factor: '53.4% LC contribution (V2 — was 37% in V7)',
  },
  totalGSExpense: {
    label: 'Total G&S Expense',
    help: 'Total operating and general expenses on goods and services for the previous financial year, per the audited financial statements. The app will auto-calculate any "remaining" amount not attributable to listed suppliers and score it at the weighted-average LC % of those suppliers.',
    ref: 'V2 Section 4.1, cell C9',
  },
  supplierName: {
    label: 'Supplier Name',
    help: 'Full legal name of the supplier entity. List at least 70% of total G&S expenses or top 40 suppliers in descending order by expense.',
    ref: 'V2 Section 4.2, Footnote 3',
  },
  supplierSector: {
    label: 'Supplier Sector',
    help: 'Select the sector matching the primary goods or services procured from this supplier. If the supplier has a known audited LC score, that takes precedence over the sector default.',
    ref: 'V2 Section 4.2, Footnote 6; Appendix B',
  },
  supplierExpense: {
    label: 'Total Expense',
    help: 'Total purchases from this supplier or material consumed in the previous financial year. Use consumption data if available; use purchasing data with inventory adjustment only if consumption data is unavailable.',
    ref: 'V2 Section 4.2, Footnote 7',
  },
  otherCosts: {
    label: 'Other Disallowable Costs',
    help: 'Unallocated operating costs that cannot be attributed to specific suppliers. These are included in total G&S expense but receive 0% LC score.',
    ref: 'V2 Section 4.2',
  },
  inventoryMovement: {
    label: 'Inventory Movement',
    help: 'Only apply if consumption data is unavailable and purchasing data is used. Positive = inventory increase, negative = decrease. Under V2, this is scored at the weighted-average LC of your listed suppliers (not 0% as in V7).',
    ref: 'V2 Section 4.2, Footnote 8',
  },
  training: {
    label: 'Saudi Training Expenses',
    help: 'Expenses on training Saudi employees for the previous financial year, including trainee costs and scholarships. Must not be double-counted with labor compensation in Section 3.',
    ref: 'V2 Section 6.1, Footnote 1',
  },
  supplierDev: {
    label: 'Supplier Development Expenses',
    help: 'Expenses on developing suppliers with KSA registration or license, through training and capability enhancement. Must not be double-counted with other sections.',
    ref: 'V2 Section 6.2, Footnote 2',
  },
  rdExpense: {
    label: 'R&D Expenses in KSA',
    help: 'Operating expenses for research and development activities conducted in the Kingdom. A bonus incentive of up to 10% is earned when R&D reaches 2% of total revenue. This incentive is added directly to the final LC % (V2).',
    ref: 'V2 Section 6.3, Footnote 3',
  },
  totalRevenue: {
    label: 'Total Entity Revenue',
    help: 'Total revenue of the entity for the previous financial year. Used to calculate the R&D incentive score ratio.',
    ref: 'V2 Section 6.3',
  },
  assetName: {
    label: 'Asset Description',
    help: 'Short description of the asset being depreciated.',
    ref: 'V2 Section 7.2',
  },
  assetType: {
    label: 'Asset Class',
    help: 'Productive asset category per V2 Section 7.2. Buildings & Land Improvements in KSA always count at 100%, regardless of origin.',
    ref: 'V2 Section 7.2',
  },
  assetAmount: {
    label: 'Depreciation / Amortization',
    help: 'Annual depreciation or amortization amount for this asset for the previous financial year.',
    ref: 'V2 Section 7.1',
  },
  assetKSA: {
    label: 'Produced in KSA',
    help: 'Whether the asset was manufactured in Saudi Arabia. KSA-produced: 100%. Foreign-produced: 30% (V2 — was 20% in V7). Buildings & Land Improvements in KSA always count at 100% regardless.',
    ref: 'V2 Section 7.2, Footnote 1',
  },
}

export const fmt = (n) => new Intl.NumberFormat('en-SA').format(Math.round(n))
export const pct = (n) => `${(n * 100).toFixed(1)}%`
