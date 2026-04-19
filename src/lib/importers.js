// ─── Importers ─────────────────────────────────────────────────────────
// Two entry points for getting data into an assessment without typing:
//   1. parseLCGPAExcel(file)  — official LCGPA V2 Excel template → assessment
//   2. parseSupplierCSV(text) — supplier list CSV → array of supplier rows
//
// Both run fully in the browser (no server round-trip) using SheetJS, which
// is loaded dynamically on first use to keep the main bundle small.

import { SECTORS, ASSET_TYPES } from './sectors.js'

// ═══ Dynamic SheetJS loader ═══
// Uses the CDN copy so we don't have to bundle ~1MB of XLSX parser code.
// Same pattern as the old PDF.js loader in RegulationsAdmin.
let _xlsxLoader = null
function loadXLSX() {
  if (_xlsxLoader) return _xlsxLoader
  _xlsxLoader = new Promise((resolve, reject) => {
    if (typeof window.XLSX !== 'undefined') return resolve(window.XLSX)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    script.onerror = () => reject(new Error('Could not load Excel library. Check your internet connection.'))
    document.head.appendChild(script)
  })
  return _xlsxLoader
}

// ═══ LCGPA Excel V2 cell map ═══
// These cell addresses come from the official template OM-LRG-02 V.2.
// If the template version changes upstream, these addresses will need
// updating — prefer adding a version check over silently producing
// wrong results.

// Arabic sheet names in the official template
const SHEET_LABOR        = 'القسم 3. القوى العاملة'
const SHEET_GOODS        = 'القسم 4. السلع والخدمات'
const SHEET_CAPACITY     = 'القسم 6. تطوير القدرات'
const SHEET_DEPRECIATION = 'القسم 7. الإهلاك والإطفاء'

// Section 7: asset rows → our ASSET_TYPES ids.
// Matches the template's fixed row structure (see screenshot B16:B28).
// Rows marked LOCKED_LOCAL always score 100% regardless of local/foreign
// origin — for us that only applies to Buildings (row 16).
const DEP_ROW_MAP = [
  { row: 16, assetType: 'BUILDING',       label: 'Buildings & Land Improvements' },
  { row: 17, assetType: 'FURNITURE',      label: 'Furniture'                      },
  { row: 18, assetType: 'MACHINERY',      label: 'Machinery and Equipment'        },
  { row: 19, assetType: 'VEHICLES',       label: 'Vehicles'                       },
  { row: 20, assetType: 'INFRASTRUCTURE', label: 'Infrastructure'                 },
  { row: 21, assetType: 'PROPERTY',       label: 'Investment Properties'          },
  { row: 22, assetType: 'LEASE_TANGIBLE', label: 'Right-of-Use (Lease)'           },
  { row: 23, assetType: 'LEASE_SOFTWARE', label: 'Right-of-Use (Software)'        },
  { row: 24, assetType: 'OTHER',          label: 'Other'                          },
  { row: 25, assetType: 'OTHER',          label: 'Other'                          },
  { row: 26, assetType: 'OTHER',          label: 'Other'                          },
  { row: 27, assetType: 'OTHER',          label: 'Other'                          },
  { row: 28, assetType: 'OTHER',          label: 'Other'                          },
]

// Section 4 supplier rows: 14-93 (80 possible suppliers).
const GS_SUPPLIER_ROW_FIRST = 14
const GS_SUPPLIER_ROW_LAST  = 93
const GS_OTHER_COSTS_ROW    = 94
const GS_INVENTORY_ROW      = 95
// Row 96 "remaining" is auto-computed from C9 minus the rest, so we don't
// import it as a separate line item — our scoring.js handles that via
// the totalGSExpense field.

// Safely coerce whatever SheetJS returned (number, string, formula result,
// empty cell, etc.) into a finite number. Anything non-numeric → 0.
function toNum(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const cleaned = v.replace(/,/g, '').trim()
    const n = parseFloat(cleaned)
    return isFinite(n) ? n : 0
  }
  return 0
}

// Read a single cell value, unwrapping formula results.
function cell(sheet, addr) {
  const c = sheet[addr]
  if (!c) return null
  return c.v !== undefined ? c.v : c.w
}

// Sector names in the Excel are strings like "4_خدمات الأمن" or
// "38_منتجات مورد أجنبي". Extract the leading numeric ID, which lines up
// with our SECTORS array's `id` field.
function resolveSectorId(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const str = String(raw).trim()
  const match = str.match(/^(\d+)/)
  if (!match) return null
  const id = parseInt(match[1], 10)
  const sector = SECTORS.find(s => s.id === id)
  return sector ? sector.id : null
}

// ═══ Main LCGPA Excel parser ═══
export async function parseLCGPAExcel(file) {
  if (!file) throw new Error('No file provided.')
  if (!file.name.match(/\.xlsx?$/i)) {
    throw new Error('Please upload an Excel file (.xlsx or .xls).')
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('File is too large (max 20MB).')
  }

  const XLSX = await loadXLSX()

  // Read the file
  const buf = await file.arrayBuffer()
  let wb
  try {
    wb = XLSX.read(buf, { type: 'array' })
  } catch (e) {
    throw new Error('Could not read this Excel file. It may be corrupted or password-protected.')
  }

  // Verify this is actually the LCGPA template by checking for the
  // expected sheets. The sheet names are in Arabic and they're the most
  // reliable signal.
  const sheetNames = wb.SheetNames || []
  const required = [SHEET_LABOR, SHEET_GOODS, SHEET_CAPACITY, SHEET_DEPRECIATION]
  const missing = required.filter(name => !sheetNames.includes(name))
  if (missing.length > 0) {
    throw new Error(
      `This does not look like the official LCGPA V2 template (OM-LRG-02). ` +
      `Missing required sheets. Please download the official template from LCGPA and try again.`
    )
  }

  // Collect warnings as we parse — things we noticed but didn't block on.
  const warnings = []

  // ── Section 3: Labor ──
  const s3 = wb.Sheets[SHEET_LABOR]
  const saudiComp   = toNum(cell(s3, 'C10'))
  const foreignComp = toNum(cell(s3, 'D10'))

  // ── Section 4: Goods & Services ──
  const s4 = wb.Sheets[SHEET_GOODS]
  const totalGSExpense = toNum(cell(s4, 'C9'))
  const otherCosts     = toNum(cell(s4, `L${GS_OTHER_COSTS_ROW}`))
  const inventoryMovement = toNum(cell(s4, `L${GS_INVENTORY_ROW}`))

  const suppliers = []
  let unmatchedSectorCount = 0
  for (let r = GS_SUPPLIER_ROW_FIRST; r <= GS_SUPPLIER_ROW_LAST; r++) {
    const name = cell(s4, `B${r}`)
    const expense = toNum(cell(s4, `L${r}`))
    // Skip empty rows — both name missing AND zero expense
    if (!name && expense === 0) continue
    // Skip rows with only a name but no expense — not useful data
    if (expense === 0) continue

    const sectorRaw = cell(s4, `H${r}`)
    const sectorId = resolveSectorId(sectorRaw)
    const auditedScore = toNum(cell(s4, `I${r}`))
    const originRaw = cell(s4, `F${r}`)
    // F column is "محلي أو أجنبي" (Local or Foreign) as free text
    const origin = typeof originRaw === 'string' && /أجنب|foreign/i.test(originRaw) ? 'Foreign' : 'Local'

    if (sectorId === null) {
      unmatchedSectorCount++
      // Skip suppliers we can't classify — we'd otherwise default them to
      // sector 1 which would silently distort the score.
      continue
    }
    const sector = SECTORS.find(s => s.id === sectorId)

    suppliers.push({
      name: String(name || `Supplier row ${r}`).slice(0, 200),
      sectorId,
      sectorScore: sector.score,
      auditedScore: auditedScore > 0 && auditedScore <= 1 ? auditedScore : 0,
      expense,
      origin,
    })
  }

  if (unmatchedSectorCount > 0) {
    warnings.push(`${unmatchedSectorCount} supplier row(s) were skipped because their sector could not be matched to the LCGPA Appendix B list. Check that each supplier's sector cell starts with a number like "4_" or "38_".`)
  }

  // ── Section 6: Capacity Building ──
  const s6 = wb.Sheets[SHEET_CAPACITY]
  const training     = toNum(cell(s6, 'C9'))
  const supplierDev  = toNum(cell(s6, 'C12'))
  const rdExpense    = toNum(cell(s6, 'C15'))
  const totalRevenue = toNum(cell(s6, 'C16'))

  // ── Section 7: Depreciation ──
  const s7 = wb.Sheets[SHEET_DEPRECIATION]
  const assets = []
  for (const { row, assetType, label } of DEP_ROW_MAP) {
    const localAmt   = toNum(cell(s7, `D${row}`))
    const foreignAmt = toNum(cell(s7, `E${row}`))
    // Only add rows where there's actually a value
    if (localAmt > 0) {
      assets.push({
        name: label,
        assetType,
        amount: localAmt,
        producedInKSA: true,
      })
    }
    if (foreignAmt > 0) {
      assets.push({
        name: `${label} (imported)`,
        assetType,
        amount: foreignAmt,
        producedInKSA: false,
      })
    }
  }

  return {
    assessment: {
      id: Date.now(),
      date: new Date().toISOString(),
      name: `Imported from ${file.name.replace(/\.xlsx?$/i, '')}`,
      importSource: 'lcgpa-excel-v2',
      importFileName: file.name,
      labor: { saudiComp, foreignComp },
      suppliers,
      totalGSExpense,
      otherCosts,
      inventoryMovement,
      training,
      supplierDev,
      rdExpense,
      totalRevenue,
      assets,
    },
    summary: {
      laborSaudi: saudiComp,
      laborForeign: foreignComp,
      supplierCount: suppliers.length,
      assetCount: assets.length,
      totalGSExpense,
      training,
      supplierDev,
      rdExpense,
    },
    warnings,
  }
}

// ═══ Supplier CSV parser ═══
// The template is intentionally simple: one row per supplier, columns:
//   Name, SectorID, Origin, Expense, AuditedScore (optional)
//
// SectorID must be the numeric ID (1-38) from our SECTORS list. We match
// by ID not name because sector names are bilingual and messy — forcing
// users to pick from a numeric list via our downloadable template is the
// most reliable approach.

const CSV_TEMPLATE_HEADER = 'Name,SectorID,Origin,Expense,AuditedScore\n'
const CSV_TEMPLATE_EXAMPLE =
  'Acme Engineering,5,Local,1500000,\n' +
  'Saudi Security Co,4,Local,400000,\n' +
  'Imported Machinery Agent,37,Local,2500000,\n' +
  'Foreign Consulting,23,Foreign,800000,\n'

export function buildCSVTemplate() {
  // Build a reference list of all sectors at the bottom of the file (as
  // comments) so users know what numbers map to what. Prefix with # which
  // our parser will skip.
  const ref = SECTORS.map(s => `# ${s.id} = ${s.name} (${(s.score * 100).toFixed(0)}%)`).join('\n')
  return CSV_TEMPLATE_HEADER + CSV_TEMPLATE_EXAMPLE + '\n' + ref + '\n'
}

// Minimal but forgiving CSV parser. Handles quoted fields with commas,
// escaped double-quotes inside quoted fields, BOM, blank lines, comment
// lines starting with #.
function parseCSVRows(text) {
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } // escaped quote
        else inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(field); field = ''
        rows.push(row); row = []
      } else {
        field += ch
      }
    }
  }
  // Flush trailing field/row
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Remove completely empty rows and comment rows
  return rows.filter(r => r.length > 0 && !(r.length === 1 && r[0].trim() === '') && !r[0].trim().startsWith('#'))
}

export function parseSupplierCSV(text) {
  if (!text || typeof text !== 'string') throw new Error('Empty file.')
  const rows = parseCSVRows(text)
  if (rows.length === 0) throw new Error('CSV appears to be empty.')

  // First non-comment row must be the header. Normalise for forgiveness.
  const header = rows[0].map(c => String(c || '').trim().toLowerCase())
  const nameIdx    = header.indexOf('name')
  const sectorIdx  = header.indexOf('sectorid')
  const originIdx  = header.indexOf('origin')
  const expenseIdx = header.indexOf('expense')
  const auditedIdx = header.indexOf('auditedscore')

  const missing = []
  if (nameIdx === -1)    missing.push('Name')
  if (sectorIdx === -1)  missing.push('SectorID')
  if (originIdx === -1)  missing.push('Origin')
  if (expenseIdx === -1) missing.push('Expense')
  if (missing.length > 0) {
    throw new Error(`CSV is missing required columns: ${missing.join(', ')}. Download the template for the correct format.`)
  }

  const suppliers = []
  const warnings = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 1 // 1-indexed for user-facing messages

    const name = String(r[nameIdx] || '').trim()
    const sectorIdRaw = String(r[sectorIdx] || '').trim()
    const originRaw = String(r[originIdx] || '').trim().toLowerCase()
    const expenseRaw = String(r[expenseIdx] || '').trim()
    const auditedRaw = auditedIdx >= 0 ? String(r[auditedIdx] || '').trim() : ''

    // Skip rows that are clearly blank or example data
    if (!name && !sectorIdRaw && !expenseRaw) continue

    if (!name) {
      warnings.push(`Row ${rowNum}: missing supplier name — skipped.`)
      continue
    }
    const sectorId = parseInt(sectorIdRaw, 10)
    const sector = SECTORS.find(s => s.id === sectorId)
    if (!sector) {
      warnings.push(`Row ${rowNum} (${name}): sector ID "${sectorIdRaw}" is not recognised. Must be 1-38. Skipped.`)
      continue
    }
    const expense = toNum(expenseRaw)
    if (expense <= 0) {
      warnings.push(`Row ${rowNum} (${name}): expense must be a positive number. Skipped.`)
      continue
    }
    const origin = originRaw === 'foreign' ? 'Foreign' : 'Local'

    // Audited score: accept "0.85", "85", "85%" — coerce to 0..1
    let auditedScore = 0
    if (auditedRaw) {
      let a = toNum(auditedRaw.replace('%', ''))
      if (a > 1) a = a / 100
      if (a > 0 && a <= 1) auditedScore = a
    }

    suppliers.push({
      name: name.slice(0, 200),
      sectorId,
      sectorScore: sector.score,
      auditedScore,
      expense,
      origin,
    })
  }

  if (suppliers.length === 0) {
    throw new Error('No valid supplier rows found. Check that each row has a name, a sector ID (1-38), an origin, and a positive expense.')
  }

  return { suppliers, warnings }
}

// ═══ Download helpers ═══
// Used by the UI to trigger a download of the CSV template.
export function downloadCSVTemplate() {
  const content = buildCSVTemplate()
  // Prepend BOM so Excel recognises UTF-8 and Arabic text renders correctly
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'muhtawa-supplier-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
