import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { computeScore, getRecommendations, fmt, pct, LC_THRESHOLD } from './scoring.js'
import { SECTORS } from './sectors.js'

export function exportAssessmentPDF(assessment, company, aiRecommendations) {
  const score = computeScore(assessment)
  const doc = new jsPDF()
  const w = doc.internal.pageSize.getWidth()
  let y = 20

  // Header
  doc.setFillColor(10, 15, 26)
  doc.rect(0, 0, w, 45, 'F')
  doc.setFontSize(22)
  doc.setTextColor(16, 185, 129)
  doc.text('Muhtawa', 20, 22)
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text('Saudi Local Content Compliance Report', 20, 30)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-SA', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, 37)

  y = 55

  // Company info
  if (company) {
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Company Information', 20, y)
    y += 8
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    doc.text(`Company: ${company.name || 'N/A'}`, 20, y); y += 6
    doc.text(`Sector: ${company.sector || 'N/A'}`, 20, y); y += 6
    doc.text(`CR Number: ${company.crNumber || 'N/A'}`, 20, y); y += 6
    doc.text(`Address: ${company.address || 'N/A'}`, 20, y); y += 12
  }

  // Score summary
  doc.setFillColor(score.totalScore >= LC_THRESHOLD ? 220 : 254, score.totalScore >= LC_THRESHOLD ? 252 : 226, score.totalScore >= LC_THRESHOLD ? 231 : 226)
  doc.roundedRect(20, y, w - 40, 30, 3, 3, 'F')
  doc.setFontSize(16)
  doc.setTextColor(score.totalScore >= LC_THRESHOLD ? 5 : 153, score.totalScore >= LC_THRESHOLD ? 150 : 27, score.totalScore >= LC_THRESHOLD ? 105 : 27)
  doc.text(`Local Content Score: ${pct(score.totalScore)}`, 30, y + 13)
  doc.setFontSize(10)
  doc.text(score.totalScore >= LC_THRESHOLD ? 'ABOVE 40% THRESHOLD — Eligible for government procurement' : `BELOW 40% THRESHOLD — Gap of ${pct(LC_THRESHOLD - score.totalScore)} to reach eligibility`, 30, y + 22)
  y += 40

  // Score breakdown table
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text('Score Breakdown', 20, y)
  y += 4

  doc.autoTable({
    startY: y,
    head: [['Category', 'Local Content (SAR)', 'Total Cost (SAR)', 'Contribution']],
    body: [
      ['Labor (Section 3)', fmt(score.laborLC), fmt(score.laborTotal), score.laborTotal > 0 ? pct(score.laborLC / score.laborTotal) : '0%'],
      ['Goods & Services (Section 4)', fmt(score.gsLC), fmt(score.gsTotal), score.gsTotal > 0 ? pct(score.gsLC / score.gsTotal) : '0%'],
      ['Capacity Building (Section 5)', fmt(score.capacityLC), fmt(score.capacityLC), '100%'],
      ['Depreciation (Section 6)', fmt(score.depLC), fmt(score.depTotal), score.depTotal > 0 ? pct(score.depLC / score.depTotal) : '0%'],
      ['TOTAL', fmt(score.totalLC), fmt(score.totalCost), pct(score.totalScore)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 20, right: 20 },
  })

  y = doc.lastAutoTable.finalY + 12

  // Suppliers detail
  if (assessment.suppliers && assessment.suppliers.length > 0) {
    if (y > 230) { doc.addPage(); y = 20 }
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Supplier Details (Section 4)', 20, y)
    y += 4

    doc.autoTable({
      startY: y,
      head: [['#', 'Supplier', 'Sector', 'Expense (SAR)', 'LC Score', 'LC (SAR)']],
      body: assessment.suppliers.map((s, i) => {
        const sec = SECTORS.find(x => x.id === s.sectorId)
        const usedScore = s.auditedScore > 0 ? s.auditedScore : (s.sectorScore || 0)
        return [
          i + 1,
          s.name || `Supplier ${i + 1}`,
          sec?.name || 'N/A',
          fmt(s.expense || 0),
          pct(usedScore),
          fmt((s.expense || 0) * usedScore),
        ]
      }),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20, right: 20 },
    })
    y = doc.lastAutoTable.finalY + 12
  }

  // Capacity building detail
  if (y > 240) { doc.addPage(); y = 20 }
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text('Capacity Building Detail (Section 5)', 20, y)
  y += 4

  doc.autoTable({
    startY: y,
    head: [['Category', 'Amount (SAR)']],
    body: [
      ['Saudi Training Expenses', fmt(assessment.training || 0)],
      ['KSA Supplier Development', fmt(assessment.supplierDev || 0)],
      ['R&D Expenses in KSA', fmt(assessment.rdExpense || 0)],
      ['Total Revenue (for R&D incentive)', fmt(assessment.totalRevenue || 0)],
      ['R&D Incentive Score', pct(score.rdIncentive)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 20, right: 20 },
  })
  y = doc.lastAutoTable.finalY + 12

  // Assets detail
  if (assessment.assets && assessment.assets.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Depreciation Detail (Section 6)', 20, y)
    y += 4

    doc.autoTable({
      startY: y,
      head: [['Asset', 'Depreciation (SAR)', 'Produced in KSA', 'LC Score', 'LC (SAR)']],
      body: assessment.assets.map(a => [
        a.name || 'Asset', fmt(a.amount || 0), a.producedInKSA ? 'Yes' : 'No',
        a.producedInKSA ? '100%' : '20%', fmt((a.amount || 0) * (a.producedInKSA ? 1 : 0.2)),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 20, right: 20 },
    })
    y = doc.lastAutoTable.finalY + 12
  }

  // Recommendations
  const recs = getRecommendations(score, assessment)
  if (recs.length > 0 || aiRecommendations) {
    if (y > 200) { doc.addPage(); y = 20 }
    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Compliance Recommendations', 20, y)
    y += 8

    if (aiRecommendations) {
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      const lines = doc.splitTextToSize(aiRecommendations, w - 40)
      doc.text(lines, 20, y)
      y += lines.length * 4.5
    }

    recs.forEach(rec => {
      if (y > 265) { doc.addPage(); y = 20 }
      const colors = { critical: [254, 226, 226], warning: [254, 243, 199], info: [219, 234, 254], success: [220, 252, 231] }
      const txtColors = { critical: [153, 27, 27], warning: [146, 64, 14], info: [30, 64, 175], success: [5, 150, 105] }
      const bg = colors[rec.type] || colors.info
      const tc = txtColors[rec.type] || txtColors.info
      const textLines = doc.splitTextToSize(rec.text, w - 50)
      const bh = 10 + textLines.length * 4.5
      doc.setFillColor(...bg)
      doc.roundedRect(20, y, w - 40, bh, 2, 2, 'F')
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...tc)
      doc.text(rec.title, 25, y + 6)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105)
      doc.text(textLines, 25, y + 12)
      y += bh + 4
    })
  }

  // Footer
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`Muhtawa — Local Content Compliance Report | Page ${i} of ${pages}`, 20, doc.internal.pageSize.getHeight() - 10)
    doc.text('Data sourced from LCGPA and EXPRO | Built by Talal Al Zayed', w - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' })
  }

  doc.save(`Muhtawa_LC_Report_${company?.name || 'Assessment'}_${new Date().toISOString().split('T')[0]}.pdf`)
}

export function exportMISPDF(form, teamQuestions, readinessScore) {
  const doc = new jsPDF()
  const w = doc.internal.pageSize.getWidth()
  let y = 20

  doc.setFillColor(10, 15, 26)
  doc.rect(0, 0, w, 45, 'F')
  doc.setFontSize(22)
  doc.setTextColor(16, 185, 129)
  doc.text('Muhtawa', 20, 22)
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text('Made in Saudi Assessment Report', 20, 30)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-SA', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, 37)

  y = 55

  // Company
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text('Company & Product', 20, y); y += 8
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`Company (EN): ${form.companyNameEn || 'N/A'}`, 20, y); y += 6
  doc.text(`Company (AR): ${form.companyNameAr || 'N/A'}`, 20, y); y += 6
  doc.text(`Saudi Ownership: ${form.saudiOwnership || 0}% | Foreign: ${form.foreignOwnership || 0}% | Government: ${form.govOwnership || 0}%`, 20, y); y += 6
  doc.text(`Product: ${form.productCategory || 'N/A'} — ${form.productSubCategory || 'N/A'}`, 20, y); y += 6
  doc.text(`Revenue Model: ${form.revenueModel || 'N/A'} | Business Model: ${form.businessModel || 'N/A'}`, 20, y); y += 14

  // Score
  doc.setFillColor(readinessScore >= 0.6 ? 220 : 254, readinessScore >= 0.6 ? 252 : 226, readinessScore >= 0.6 ? 231 : 226)
  doc.roundedRect(20, y, w - 40, 20, 3, 3, 'F')
  doc.setFontSize(14)
  doc.setTextColor(readinessScore >= 0.6 ? 5 : 153, readinessScore >= 0.6 ? 150 : 27, readinessScore >= 0.6 ? 105 : 27)
  doc.text(`Readiness Score: ${Math.round(readinessScore * 100)}% — ${readinessScore >= 0.6 ? 'Strong Candidate' : readinessScore >= 0.3 ? 'Needs Improvement' : 'Significant Gaps'}`, 30, y + 13)
  y += 30

  // Assessment detail
  doc.autoTable({
    startY: y,
    head: [['Requirement', 'Status', 'Action']],
    body: teamQuestions.map(q => [
      q.label.replace('?', ''),
      form[q.key] === true ? 'Yes' : form[q.key] === false ? 'No' : 'Not answered',
      form[q.key] === false ? 'Action required' : form[q.key] === true ? 'Complete' : 'Pending',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 20, right: 20 },
  })

  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Muhtawa — Made in Saudi Assessment | Built by Talal Al Zayed', 20, doc.internal.pageSize.getHeight() - 10)

  doc.save(`Muhtawa_MIS_Report_${form.companyNameEn || 'Assessment'}_${new Date().toISOString().split('T')[0]}.pdf`)
}
