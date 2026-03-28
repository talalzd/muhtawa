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
  const saudiComp = a.labor?.saudiComp || 0
  const foreignComp = a.labor?.foreignComp || 0
  const laborSaudi = saudiComp * LABOR_SAUDI_FACTOR
  const laborForeign = foreignComp * LABOR_FOREIGN_FACTOR
  const laborLC = laborSaudi + laborForeign
  const laborTotal = saudiComp + foreignComp

  let gsTotal = 0, gsLC = 0
  ;(a.suppliers || []).forEach((s) => {
    const exp = s.expense || 0
    const selectedScore = s.auditedScore > 0 ? s.auditedScore : (s.sectorScore || 0)
    gsTotal += exp
    gsLC += exp * selectedScore
  })
  gsTotal += (a.otherCosts || 0) + (a.inventoryMovement || 0)

  const trainingLC = a.training || 0
  const supplierDevLC = a.supplierDev || 0
  const rdExpense = a.rdExpense || 0
  const totalRevenue = a.totalRevenue || 0
  const rdRatio = totalRevenue > 0 ? rdExpense / totalRevenue : 0
  const rdIncentive = Math.min(rdRatio / RD_REVENUE_THRESHOLD, 1) * RD_INCENTIVE_MAX
  const capacityLC = trainingLC + supplierDevLC + rdExpense

  let depTotal = 0, depLC = 0
  ;(a.assets || []).forEach((asset) => {
    const amt = asset.amount || 0
    depTotal += amt
    depLC += amt * (asset.producedInKSA ? DEPRECIATION_LOCAL_FACTOR : DEPRECIATION_FOREIGN_FACTOR)
  })

  const totalLC = laborLC + gsLC + capacityLC + depLC
  const totalCost = laborTotal + gsTotal + capacityLC + depTotal
  const totalScore = totalCost > 0 ? totalLC / totalCost : 0

  const gap = LC_THRESHOLD - totalScore
  const meetsThreshold = totalScore >= LC_THRESHOLD

  const laborPct = totalCost > 0 ? laborLC / totalCost : 0
  const gsPct = totalCost > 0 ? gsLC / totalCost : 0
  const capacityPct = totalCost > 0 ? capacityLC / totalCost : 0
  const depPct = totalCost > 0 ? depLC / totalCost : 0

  return {
    laborSaudi, laborForeign, laborLC, laborTotal,
    gsLC, gsTotal,
    trainingLC, supplierDevLC, rdExpense, rdRatio, rdIncentive, capacityLC,
    depLC, depTotal,
    totalLC, totalCost, totalScore,
    gap, meetsThreshold,
    laborPct, gsPct, capacityPct, depPct,
  }
}

export function getRecommendations(score, a) {
  const recs = []

  if (score.meetsThreshold) {
    recs.push({ type: 'success', title: 'Threshold Met', text: `Your LC score of ${pct(score.totalScore)} exceeds the ${pct(LC_THRESHOLD)} minimum. Focus on maintaining and increasing it.` })
  } else {
    const gapSAR = score.gap * score.totalCost
    recs.push({ type: 'critical', title: 'Below Threshold', text: `You need to increase your LC contribution by approximately SAR ${fmt(gapSAR)} to reach ${pct(LC_THRESHOLD)}.` })
  }

  const saudiRatio = score.laborTotal > 0 ? (a.labor?.saudiComp || 0) / score.laborTotal : 0
  if (saudiRatio < 0.5 && score.laborTotal > 0) {
    const targetSaudi = score.laborTotal * 0.6
    const additionalNeeded = targetSaudi - (a.labor?.saudiComp || 0)
    recs.push({ type: 'warning', title: 'Increase Saudization', text: `Saudi labor is only ${pct(saudiRatio)} of total compensation. Increasing Saudi compensation by SAR ${fmt(Math.max(0, additionalNeeded))} would significantly boost your score.` })
  }

  const foreignSuppliers = (a.suppliers || []).filter(s => {
    const sector = SECTORS.find(sec => sec.id === s.sectorId)
    return sector && (sector.origin === 'Foreign' || sector.score < 0.1)
  })
  if (foreignSuppliers.length > 0) {
    const foreignSpend = foreignSuppliers.reduce((sum, s) => sum + (s.expense || 0), 0)
    recs.push({ type: 'warning', title: 'Switch to Local Suppliers', text: `You have SAR ${fmt(foreignSpend)} in foreign or low-LC suppliers. Switching to local alternatives could increase your score by up to ${pct(foreignSpend * 0.3 / (score.totalCost || 1))}.` })
  }

  if (score.rdIncentive < RD_INCENTIVE_MAX && (a.totalRevenue || 0) > 0) {
    const targetRD = (a.totalRevenue || 0) * RD_REVENUE_THRESHOLD
    recs.push({ type: 'info', title: 'R&D Incentive Available', text: `Investing SAR ${fmt(targetRD)} in KSA R&D (2% of revenue) earns a 10% incentive score bonus.` })
  }

  if (score.trainingLC === 0 && score.totalCost > 0) {
    recs.push({ type: 'info', title: 'Saudi Training', text: 'No training expenses reported. Investment in Saudi employee training directly increases your LC score under Section 5.' })
  }

  return recs
}

export const fmt = (n) => new Intl.NumberFormat('en-SA').format(Math.round(n))
export const pct = (n) => `${(n * 100).toFixed(1)}%`
