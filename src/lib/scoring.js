import {
  LABOR_SAUDI_FACTOR,
  LABOR_FOREIGN_FACTOR,
  DEPRECIATION_LOCAL_FACTOR,
  DEPRECIATION_FOREIGN_FACTOR,
  RD_INCENTIVE_MAX,
  RD_REVENUE_THRESHOLD,
  LC_THRESHOLD,
  SECTORS,
} from './sectors.js'

export { LC_THRESHOLD }

export function computeScore(a) {
  // Section 3: Labor — Saudi at 100%, foreign at 37%
  const saudiComp = Math.max(0, a.labor?.saudiComp || 0) // edge case: no negatives
  const foreignComp = Math.max(0, a.labor?.foreignComp || 0)
  const laborSaudi = saudiComp * LABOR_SAUDI_FACTOR
  const laborForeign = foreignComp * LABOR_FOREIGN_FACTOR
  const laborLC = laborSaudi + laborForeign
  const laborTotal = saudiComp + foreignComp

  // Section 4: Goods & Services — scored by sector
  let gsTotal = 0, gsLC = 0
  ;(a.suppliers || []).forEach((s) => {
    const exp = Math.max(0, s.expense || 0) // edge case: no negative expenses
    // Edge case: if supplier has audited score, use it; otherwise use sector default
    // Audited score must be between 0 and 1
    const auditedValid = typeof s.auditedScore === 'number' && s.auditedScore > 0 && s.auditedScore <= 1
    const selectedScore = auditedValid ? s.auditedScore : Math.max(0, Math.min(1, s.sectorScore || 0))
    gsTotal += exp
    gsLC += exp * selectedScore
  })
  // Edge case: other costs and inventory movement can be negative (inventory drawdown)
  const otherCosts = a.otherCosts || 0
  const inventoryMovement = a.inventoryMovement || 0
  gsTotal += otherCosts + inventoryMovement

  // Section 5: Capacity Building
  const trainingLC = Math.max(0, a.training || 0)
  const supplierDevLC = Math.max(0, a.supplierDev || 0)
  const rdExpense = Math.max(0, a.rdExpense || 0)
  const totalRevenue = Math.max(0, a.totalRevenue || 0)
  // R&D incentive: up to 10% when R&D reaches 2% of revenue
  const rdRatio = totalRevenue > 0 ? rdExpense / totalRevenue : 0
  const rdIncentive = Math.min(rdRatio / RD_REVENUE_THRESHOLD, 1) * RD_INCENTIVE_MAX
  const capacityLC = trainingLC + supplierDevLC + rdExpense

  // Section 6: Depreciation & Amortization
  let depTotal = 0, depLC = 0
  ;(a.assets || []).forEach((asset) => {
    const amt = Math.max(0, asset.amount || 0)
    depTotal += amt
    depLC += amt * (asset.producedInKSA ? DEPRECIATION_LOCAL_FACTOR : DEPRECIATION_FOREIGN_FACTOR)
  })

  // Total LC Score calculation
  const totalLC = laborLC + gsLC + capacityLC + depLC
  const totalCost = laborTotal + gsTotal + capacityLC + depTotal
  // Edge case: prevent division by zero and negative scores
  const totalScore = totalCost > 0 ? Math.max(0, Math.min(1, totalLC / totalCost)) : 0

  const gap = Math.max(0, LC_THRESHOLD - totalScore)
  const meetsThreshold = totalScore >= LC_THRESHOLD

  const laborPct = totalCost > 0 ? laborLC / totalCost : 0
  const gsPct = totalCost > 0 ? gsLC / totalCost : 0
  const capacityPct = totalCost > 0 ? capacityLC / totalCost : 0
  const depPct = totalCost > 0 ? depLC / totalCost : 0

  // Saudization ratio for recommendations
  const saudiRatio = laborTotal > 0 ? saudiComp / laborTotal : 0

  return {
    laborSaudi, laborForeign, laborLC, laborTotal, saudiRatio,
    gsLC, gsTotal, otherCosts, inventoryMovement,
    trainingLC, supplierDevLC, rdExpense, rdRatio, rdIncentive, capacityLC,
    depLC, depTotal,
    totalLC, totalCost, totalScore,
    gap, meetsThreshold,
    laborPct, gsPct, capacityPct, depPct,
  }
}

// ─── LCGPA-referenced recommendations ──────────────────────────────
export function getRecommendations(score, a) {
  const recs = []

  // Overall status
  if (score.meetsThreshold) {
    recs.push({
      type: 'success',
      title: 'Threshold Met',
      ref: 'LCGPA Executive Regulations, Article 11',
      text: `Your LC score of ${pct(score.totalScore)} meets the ${pct(LC_THRESHOLD)} minimum required for government procurement eligibility. Continue strengthening local content to improve your competitive position in tender evaluations.`
    })
  } else {
    const gapSAR = score.totalCost > 0 ? score.gap * score.totalCost : 0
    recs.push({
      type: 'critical',
      title: 'Below Minimum Threshold',
      ref: 'LCGPA Executive Regulations, Article 11',
      text: `Your score is ${pct(score.gap)} below the ${pct(LC_THRESHOLD)} threshold. You need approximately SAR ${fmt(gapSAR)} in additional local content contribution to become eligible for government procurement.`
    })
  }

  // Section 3: Labor analysis
  if (score.laborTotal > 0 && score.saudiRatio < 0.5) {
    const targetSaudi = score.laborTotal * 0.6
    const additionalNeeded = Math.max(0, targetSaudi - (a.labor?.saudiComp || 0))
    recs.push({
      type: 'warning',
      title: 'Low Saudization in Compensation',
      ref: 'Template Section 3 — Labor Compensation',
      text: `Saudi employee compensation is ${pct(score.saudiRatio)} of total labor cost. Saudi compensation counts at 100% LC versus 37% for foreign employees (per LCGPA Template footnote 3). Increasing Saudi compensation by SAR ${fmt(additionalNeeded)} to reach a 60/40 split would add approximately ${pct(additionalNeeded * 0.63 / (score.totalCost || 1))} to your overall score.`
    })
  }

  if (score.laborTotal === 0 && score.totalCost > 0) {
    recs.push({
      type: 'info',
      title: 'No Labor Data Entered',
      ref: 'Template Section 3 — Labor Compensation',
      text: 'Labor compensation (Saudi and foreign salaries, wages, bonuses, GOSI contributions, and allowances) is typically the largest scoring category. Enter your previous financial year labor data for an accurate score.'
    })
  }

  // Section 4: Goods & Services analysis
  const foreignSuppliers = (a.suppliers || []).filter(s => {
    const sector = SECTORS.find(sec => sec.id === s.sectorId)
    return sector && (sector.origin === 'Foreign' || sector.score <= 0.05)
  })
  if (foreignSuppliers.length > 0) {
    const foreignSpend = foreignSuppliers.reduce((sum, s) => sum + Math.max(0, s.expense || 0), 0)
    const potentialGain = foreignSpend * 0.3
    recs.push({
      type: 'warning',
      title: 'Foreign or Low-LC Supplier Spend',
      ref: 'Template Section 4.2 — Goods and Services, Appendix B',
      text: `SAR ${fmt(foreignSpend)} is spent with foreign suppliers or agents/distributors (LC score 0-5%). Switching to local suppliers in equivalent sectors could add up to ${pct(potentialGain / (score.totalCost || 1))} to your score. Prioritize switching suppliers in high-spend categories first. Per LCGPA guidelines, you must list at least 70% or top 40 suppliers.`
    })
  }

  // High-LC company opportunity
  const hasHighLC = (a.suppliers || []).some(s => s.sectorId === 38)
  if (!hasHighLC && score.gsTotal > 0) {
    recs.push({
      type: 'info',
      title: 'High-LC Company Procurement',
      ref: 'Appendix B, Sector 38 — KSA High LC Companies',
      text: 'Procurement from Aramco, SABIC, SEC, Maaden, STC, Zain, Mobily, SAR, SADARA, Marafiq, NWC, or SWCC carries a 50% LC score. If any of your suppliers fall into this category, reclassify them to Sector 38 for accurate scoring.'
    })
  }

  // Section 5: Capacity Building
  if (score.rdIncentive < RD_INCENTIVE_MAX && (a.totalRevenue || 0) > 0) {
    const targetRD = (a.totalRevenue || 0) * RD_REVENUE_THRESHOLD
    const currentRD = a.rdExpense || 0
    const needed = Math.max(0, targetRD - currentRD)
    recs.push({
      type: 'info',
      title: 'R&D Incentive Score Available',
      ref: 'Template Section 5.3 — R&D, Footnote 3',
      text: `Your R&D spend is ${pct(score.rdRatio)} of revenue (${pct(RD_REVENUE_THRESHOLD)} required for full incentive). Investing an additional SAR ${fmt(needed)} in KSA-based R&D activities earns up to 10% bonus incentive score. This incentive is calculated separately from the main LC score.`
    })
  }

  if (score.trainingLC === 0 && score.totalCost > 0) {
    recs.push({
      type: 'info',
      title: 'No Saudi Training Expenses',
      ref: 'Template Section 5.1 — Training of Saudis',
      text: 'Training expenses for Saudi employees (including trainee costs and scholarships) count at 100% toward local content. Note per LCGPA: training expenses must not be double-counted with labor compensation in Section 3.'
    })
  }

  if (score.supplierDevLC === 0 && score.gsTotal > 0) {
    recs.push({
      type: 'info',
      title: 'No Supplier Development Expenses',
      ref: 'Template Section 5.2 — Supplier Development',
      text: 'Expenses on developing KSA-registered suppliers (training, capability enhancement) count at 100% toward LC. This is a direct way to increase your score while strengthening your local supply chain.'
    })
  }

  // Section 6: Depreciation
  const foreignAssets = (a.assets || []).filter(ast => !ast.producedInKSA)
  if (foreignAssets.length > 0) {
    const foreignDep = foreignAssets.reduce((sum, ast) => sum + Math.max(0, ast.amount || 0), 0)
    const potentialGain = foreignDep * 0.8 // switching from 20% to 100%
    recs.push({
      type: 'info',
      title: 'Foreign Asset Depreciation',
      ref: 'Template Section 6.2 — Productive Asset Classes',
      text: `SAR ${fmt(foreignDep)} in depreciation is from foreign-produced assets (scored at 20%). KSA-produced assets score at 100%. Future capital purchases from KSA manufacturers could add ${pct(potentialGain / (score.totalCost || 1))} to your score. Note: building and land improvements in KSA are always scored at 100% regardless of origin.`
    })
  }

  return recs
}

// ─── FIELD TOOLTIPS — LCGPA references for each input ──────────────
export const TOOLTIPS = {
  saudiComp: {
    label: 'Saudi Employee Compensation',
    help: 'Total salaries, wages, bonuses, allowances (transport, housing), leave, end-of-service benefits, and GOSI contributions for Saudi employees and those treated as Saudi. Excludes trainee rewards (counted in Section 5).',
    ref: 'Section 3, Footnotes 1-3',
    factor: '100% LC contribution',
  },
  foreignComp: {
    label: 'Foreign Employee Compensation',
    help: 'Same compensation components as Saudi employees, but for foreign (non-Saudi) workforce in KSA operations for the previous financial year.',
    ref: 'Section 3, Footnotes 1-2',
    factor: '37% LC contribution',
  },
  supplierName: {
    label: 'Supplier Name',
    help: 'Full legal name of the supplier entity. List at least 70% of total G&S expenses or top 40 suppliers in descending order by expense.',
    ref: 'Section 4.2, Footnote 4',
  },
  supplierSector: {
    label: 'Supplier Sector',
    help: 'Select the sector matching the primary goods or services procured from this supplier. If the supplier has a known audited LC score, that takes precedence over the sector default.',
    ref: 'Section 4.2, Footnote 6; Appendix B',
  },
  supplierExpense: {
    label: 'Total Expense',
    help: 'Total purchases from this supplier or material consumed in the previous financial year. Use consumption data if available; use purchasing data with inventory adjustment only if consumption data is unavailable.',
    ref: 'Section 4.2, Footnotes 7-8',
  },
  otherCosts: {
    label: 'Other Disallowable Costs',
    help: 'Unallocated operating costs that cannot be attributed to specific suppliers. These are included in total G&S expense but receive 0% LC score.',
    ref: 'Section 4.2',
  },
  inventoryMovement: {
    label: 'Inventory Movement',
    help: 'Only apply if consumption data is unavailable and purchasing data is used. Positive value = inventory increase, negative = inventory decrease.',
    ref: 'Section 4.2, Footnote 8',
  },
  training: {
    label: 'Saudi Training Expenses',
    help: 'Expenses on training Saudi employees for the previous financial year, including trainee costs and scholarships. Must not be double-counted with labor compensation in Section 3.',
    ref: 'Section 5.1, Footnote 1',
  },
  supplierDev: {
    label: 'Supplier Development Expenses',
    help: 'Expenses on developing suppliers with KSA registration or license, through training and capability enhancement. Must not be double-counted with other sections.',
    ref: 'Section 5.2, Footnote 2',
  },
  rdExpense: {
    label: 'R&D Expenses in KSA',
    help: 'Operating expenses for research and development activities conducted in the Kingdom. An incentive score of up to 10% is awarded when R&D reaches 2% of total revenue. Must not overlap with other sections.',
    ref: 'Section 5.3, Footnote 3',
  },
  totalRevenue: {
    label: 'Total Entity Revenue',
    help: 'Total revenue of the entity for the previous financial year. Used to calculate the R&D incentive score ratio.',
    ref: 'Section 5.3',
  },
  assetName: {
    label: 'Asset Class',
    help: 'Productive asset category: Building & Land Improvements, Furniture & Fixtures, Machinery & Equipment, Vehicles, or Other. Buildings in KSA are always 100% LC.',
    ref: 'Section 6.2',
  },
  assetAmount: {
    label: 'Depreciation / Amortization',
    help: 'Annual depreciation or amortization amount for this asset class for the previous financial year.',
    ref: 'Section 6.1',
  },
  assetKSA: {
    label: 'Produced in KSA',
    help: 'Whether the asset was manufactured in Saudi Arabia. KSA-produced assets are scored at 100%, foreign at 20%. Building and land improvements in KSA are always 100% regardless.',
    ref: 'Section 6.2, Footnote',
  },
}

export const fmt = (n) => new Intl.NumberFormat('en-SA').format(Math.round(n))
export const pct = (n) => `${(n * 100).toFixed(1)}%`
