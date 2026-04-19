// ─── Sample assessment data ─────────────────────────────────────────────
// Three pre-built assessment cases that let new users see the LCGPA
// calculator in action before they have their own data ready. Each case
// comes with an educational "story" explaining why it scored the way it
// did — what's pulling the score up or down and what the company could do
// differently.
//
// Users can pick a sector for the supplier list to be themed around; if
// they don't pick one, we use a generic mix. Either way, the final score
// lands in the same range because the supplier mix is tuned to produce
// that outcome.

// ── Sector-specific supplier profiles ────────────────────────────────────
// For each LOW/MID/HIGH case we define how a company in a given industry
// would typically spend. Only the supplier list changes by sector — labor,
// depreciation, capacity stay the same so the final score stays in range.
//
// Each profile is an array of { name, sectorId, sectorScore, expense, origin }.
// Expenses are in SAR. Sector scores below match the V2 Appendix B values.

const LOW_SUPPLIERS = {
  // Generic (default) — mid-size company with heavy import reliance
  generic: [
    { name: 'Foreign Heavy Equipment Co',          sectorId: 38, sectorScore: 0.00, expense: 6_000_000, origin: 'Foreign' },
    { name: 'Al-Mustawrid Trading (importer)',     sectorId: 37, sectorScore: 0.05, expense: 4_500_000, origin: 'Local'   },
    { name: 'Foreign Engineering Consultants',     sectorId: 23, sectorScore: 0.00, expense: 2_500_000, origin: 'Foreign' },
    { name: 'Foreign Service Agent (IT)',          sectorId: 22, sectorScore: 0.05, expense: 1_200_000, origin: 'Local'   },
    { name: 'Local Cement Supplier',               sectorId: 32, sectorScore: 0.50, expense:   800_000, origin: 'Local'   },
    { name: 'Riyadh Office Rental',                sectorId:  1, sectorScore: 0.60, expense:   500_000, origin: 'Local'   },
  ],
  // Construction-flavored
  construction: [
    { name: 'Imported heavy machinery (Cat/Komatsu)', sectorId: 38, sectorScore: 0.00, expense: 5_500_000, origin: 'Foreign' },
    { name: 'Imported rebar distributor',             sectorId: 37, sectorScore: 0.05, expense: 4_000_000, origin: 'Local'   },
    { name: 'Foreign project management consultants', sectorId: 23, sectorScore: 0.00, expense: 2_800_000, origin: 'Foreign' },
    { name: 'Imported specialty materials agent',     sectorId: 22, sectorScore: 0.05, expense: 1_500_000, origin: 'Local'   },
    { name: 'Local cement (partial)',                 sectorId: 32, sectorScore: 0.50, expense:   900_000, origin: 'Local'   },
    { name: 'Site office rental',                     sectorId:  1, sectorScore: 0.60, expense:   800_000, origin: 'Local'   },
  ],
  // IT / software services
  it: [
    { name: 'Foreign cloud infrastructure',       sectorId: 23, sectorScore: 0.00, expense: 5_500_000, origin: 'Foreign' },
    { name: 'Software licenses (local reseller)', sectorId: 37, sectorScore: 0.05, expense: 4_500_000, origin: 'Local'   },
    { name: 'Foreign SaaS subscriptions',         sectorId: 23, sectorScore: 0.00, expense: 2_500_000, origin: 'Foreign' },
    { name: 'Imported hardware distributor',      sectorId: 37, sectorScore: 0.05, expense: 1_500_000, origin: 'Local'   },
    { name: 'Local IT professional services',     sectorId: 19, sectorScore: 0.41, expense:   700_000, origin: 'Local'   },
    { name: 'Office rental',                      sectorId:  1, sectorScore: 0.60, expense:   500_000, origin: 'Local'   },
  ],
  // Healthcare
  healthcare: [
    { name: 'Imported medical equipment',         sectorId: 38, sectorScore: 0.00, expense: 5_500_000, origin: 'Foreign' },
    { name: 'Imported pharmaceuticals (distributor)', sectorId: 37, sectorScore: 0.05, expense: 4_500_000, origin: 'Local' },
    { name: 'Foreign medical specialists',        sectorId: 23, sectorScore: 0.00, expense: 2_500_000, origin: 'Foreign' },
    { name: 'Imported consumables',               sectorId: 37, sectorScore: 0.05, expense: 1_500_000, origin: 'Local'   },
    { name: 'Local cleaning and catering',        sectorId: 20, sectorScore: 0.35, expense:   800_000, origin: 'Local'   },
    { name: 'Hospital building rental',           sectorId:  1, sectorScore: 0.60, expense:   700_000, origin: 'Local'   },
  ],
  // Manufacturing
  manufacturing: [
    { name: 'Imported raw materials',             sectorId: 38, sectorScore: 0.00, expense: 6_500_000, origin: 'Foreign' },
    { name: 'Imported machinery distributor',     sectorId: 37, sectorScore: 0.05, expense: 4_000_000, origin: 'Local'   },
    { name: 'Foreign technical consultants',      sectorId: 23, sectorScore: 0.00, expense: 2_200_000, origin: 'Foreign' },
    { name: 'Foreign logistics agent',            sectorId: 22, sectorScore: 0.05, expense: 1_200_000, origin: 'Local'   },
    { name: 'Local industrial services',          sectorId:  3, sectorScore: 0.36, expense:   900_000, origin: 'Local'   },
    { name: 'Factory rental',                     sectorId:  1, sectorScore: 0.60, expense:   700_000, origin: 'Local'   },
  ],
  // Professional services (legal, accounting, consulting)
  professional: [
    { name: 'Foreign advisory affiliate',         sectorId: 23, sectorScore: 0.00, expense: 4_500_000, origin: 'Foreign' },
    { name: 'Imported software licenses (agent)', sectorId: 37, sectorScore: 0.05, expense: 3_500_000, origin: 'Local'   },
    { name: 'Foreign research databases',         sectorId: 23, sectorScore: 0.00, expense: 2_000_000, origin: 'Foreign' },
    { name: 'Foreign-service agent fees',         sectorId: 22, sectorScore: 0.05, expense: 1_500_000, origin: 'Local'   },
    { name: 'Local co-counsel network',           sectorId:  5, sectorScore: 0.50, expense:   900_000, origin: 'Local'   },
    { name: 'Premium office rental',              sectorId:  1, sectorScore: 0.60, expense:   700_000, origin: 'Local'   },
  ],
}

const MID_SUPPLIERS = {
  generic: [
    { name: 'Al Faisal Professional Services',       sectorId:  5, sectorScore: 0.50, expense: 1_500_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   400_000, origin: 'Local'   },
    { name: 'Najd IT Services',                      sectorId: 19, sectorScore: 0.41, expense:   600_000, origin: 'Local'   },
    { name: 'Saudi Electricity Company',             sectorId: 21, sectorScore: 0.61, expense:   300_000, origin: 'Local'   },
    { name: 'Imported software (local distributor)', sectorId: 37, sectorScore: 0.05, expense: 4_000_000, origin: 'Local'   },
    { name: 'Foreign cloud hosting',                 sectorId: 23, sectorScore: 0.00, expense: 3_000_000, origin: 'Foreign' },
    { name: 'Office rental Al Olaya',                sectorId:  1, sectorScore: 0.60, expense:   500_000, origin: 'Local'   },
    { name: 'Fleet leasing (with driver)',           sectorId: 17, sectorScore: 0.35, expense:   300_000, origin: 'Local'   },
  ],
  construction: [
    { name: 'KSA Steel Rebar',                     sectorId: 33, sectorScore: 0.60, expense: 1_500_000, origin: 'Local'   },
    { name: 'Saudi Cement Co',                     sectorId: 32, sectorScore: 0.50, expense: 1_200_000, origin: 'Local'   },
    { name: 'Local subcontractor (construction)',  sectorId:  8, sectorScore: 0.40, expense:   800_000, origin: 'Local'   },
    { name: 'Saudi Security Services',             sectorId:  4, sectorScore: 0.82, expense:   400_000, origin: 'Local'   },
    { name: 'Imported specialty equipment (agent)',sectorId: 37, sectorScore: 0.05, expense: 3_500_000, origin: 'Local'   },
    { name: 'Foreign design consultants',          sectorId: 23, sectorScore: 0.00, expense: 2_500_000, origin: 'Foreign' },
    { name: 'Equipment rental (with operator)',    sectorId: 17, sectorScore: 0.35, expense:   600_000, origin: 'Local'   },
    { name: 'Site office rental',                  sectorId:  1, sectorScore: 0.60, expense:   500_000, origin: 'Local'   },
  ],
  it: [
    { name: 'Local IT consultancy (Riyadh)',         sectorId: 19, sectorScore: 0.41, expense: 1_800_000, origin: 'Local'   },
    { name: 'Saudi data center colocation',          sectorId: 21, sectorScore: 0.61, expense:   600_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   300_000, origin: 'Local'   },
    { name: 'Foreign cloud hosting',                 sectorId: 23, sectorScore: 0.00, expense: 3_200_000, origin: 'Foreign' },
    { name: 'Imported software (local distributor)', sectorId: 37, sectorScore: 0.05, expense: 3_500_000, origin: 'Local'   },
    { name: 'Foreign SaaS subscriptions',            sectorId: 23, sectorScore: 0.00, expense:   900_000, origin: 'Foreign' },
    { name: 'Office rental Al Olaya',                sectorId:  1, sectorScore: 0.60, expense:   500_000, origin: 'Local'   },
    { name: 'Fleet leasing (with driver)',           sectorId: 17, sectorScore: 0.35, expense:   200_000, origin: 'Local'   },
  ],
  healthcare: [
    { name: 'Saudi Healthcare Services',             sectorId: 11, sectorScore: 0.38, expense: 1_500_000, origin: 'Local'   },
    { name: 'Local medical consumables (agent)',     sectorId: 37, sectorScore: 0.05, expense: 3_500_000, origin: 'Local'   },
    { name: 'Imported medical equipment',            sectorId: 38, sectorScore: 0.00, expense: 2_800_000, origin: 'Foreign' },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   500_000, origin: 'Local'   },
    { name: 'Local industrial services (cal./maint)',sectorId:  3, sectorScore: 0.36, expense:   700_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   400_000, origin: 'Local'   },
    { name: 'Catering services',                     sectorId:  2, sectorScore: 0.40, expense:   500_000, origin: 'Local'   },
    { name: 'Hospital building rental',              sectorId:  1, sectorScore: 0.60, expense:   600_000, origin: 'Local'   },
  ],
  manufacturing: [
    { name: 'Local packaging supplier',              sectorId: 35, sectorScore: 0.30, expense: 1_200_000, origin: 'Local'   },
    { name: 'Local industrial services',             sectorId:  3, sectorScore: 0.36, expense:   800_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   400_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   500_000, origin: 'Local'   },
    { name: 'Imported raw materials (local agent)',  sectorId: 37, sectorScore: 0.05, expense: 4_000_000, origin: 'Local'   },
    { name: 'Foreign machinery parts',               sectorId: 38, sectorScore: 0.00, expense: 2_500_000, origin: 'Foreign' },
    { name: 'Transport and logistics',               sectorId: 13, sectorScore: 0.45, expense:   600_000, origin: 'Local'   },
    { name: 'Factory rental',                        sectorId:  1, sectorScore: 0.60, expense:   500_000, origin: 'Local'   },
  ],
  professional: [
    { name: 'Local co-counsel / consultancy',        sectorId:  5, sectorScore: 0.50, expense: 1_800_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   350_000, origin: 'Local'   },
    { name: 'Saudi IT support',                      sectorId: 19, sectorScore: 0.41, expense:   500_000, origin: 'Local'   },
    { name: 'Foreign databases / research (agent)',  sectorId: 22, sectorScore: 0.05, expense: 1_500_000, origin: 'Local'   },
    { name: 'Foreign affiliate advisory',            sectorId: 23, sectorScore: 0.00, expense: 2_500_000, origin: 'Foreign' },
    { name: 'Imported software (local distributor)', sectorId: 37, sectorScore: 0.05, expense: 2_700_000, origin: 'Local'   },
    { name: 'Premium office rental',                 sectorId:  1, sectorScore: 0.60, expense:   900_000, origin: 'Local'   },
    { name: 'Fleet leasing',                         sectorId: 17, sectorScore: 0.35, expense:   300_000, origin: 'Local'   },
  ],
}

const HIGH_SUPPLIERS = {
  generic: [
    { name: 'Al Rashid Engineering (local)',         sectorId:  5, sectorScore: 0.50, expense: 1_800_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   500_000, origin: 'Local'   },
    { name: 'KSA Steel Rebar',                       sectorId: 33, sectorScore: 0.60, expense:   900_000, origin: 'Local'   },
    { name: 'Saudi Cement Co',                       sectorId: 32, sectorScore: 0.50, expense:   600_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   350_000, origin: 'Local'   },
    { name: 'KSA Chemicals Supplier',                sectorId: 26, sectorScore: 0.61, expense:   800_000, origin: 'Local'   },
    { name: 'Manpower supply (Saudi)',               sectorId: 18, sectorScore: 0.59, expense:   600_000, origin: 'Local'   },
    { name: 'Saudi training institute',              sectorId:  9, sectorScore: 0.66, expense:   300_000, origin: 'Local'   },
    { name: 'HQ office rental',                      sectorId:  1, sectorScore: 0.60, expense:   450_000, origin: 'Local'   },
    { name: 'Imported specialized equipment',        sectorId: 37, sectorScore: 0.05, expense: 3_500_000, origin: 'Local'   },
    { name: 'Foreign specialist consultants',        sectorId: 23, sectorScore: 0.00, expense: 2_000_000, origin: 'Foreign' },
  ],
  construction: [
    { name: 'KSA Steel Rebar',                       sectorId: 33, sectorScore: 0.60, expense: 2_000_000, origin: 'Local'   },
    { name: 'Saudi Cement Co',                       sectorId: 32, sectorScore: 0.50, expense: 1_500_000, origin: 'Local'   },
    { name: 'Local engineering consultancy',         sectorId:  5, sectorScore: 0.50, expense: 1_200_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   500_000, origin: 'Local'   },
    { name: 'Saudi subcontractor',                   sectorId:  8, sectorScore: 0.40, expense: 1_000_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   300_000, origin: 'Local'   },
    { name: 'Manpower supply (Saudi)',               sectorId: 18, sectorScore: 0.59, expense:   700_000, origin: 'Local'   },
    { name: 'Saudi training institute',              sectorId:  9, sectorScore: 0.66, expense:   300_000, origin: 'Local'   },
    { name: 'Site office rental',                    sectorId:  1, sectorScore: 0.60, expense:   500_000, origin: 'Local'   },
    { name: 'Imported specialty equipment',          sectorId: 37, sectorScore: 0.05, expense: 2_500_000, origin: 'Local'   },
    { name: 'Foreign specialist consultants',        sectorId: 23, sectorScore: 0.00, expense: 2_000_000, origin: 'Foreign' },
  ],
  it: [
    { name: 'Saudi IT consultancy (majority Saudi)', sectorId: 19, sectorScore: 0.41, expense: 2_500_000, origin: 'Local'   },
    { name: 'Saudi data center (local hosting)',     sectorId: 21, sectorScore: 0.61, expense:   900_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   400_000, origin: 'Local'   },
    { name: 'Local professional services',           sectorId:  5, sectorScore: 0.50, expense:   800_000, origin: 'Local'   },
    { name: 'Manpower supply (Saudi)',               sectorId: 18, sectorScore: 0.59, expense:   700_000, origin: 'Local'   },
    { name: 'Saudi training institute',              sectorId:  9, sectorScore: 0.66, expense:   400_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   250_000, origin: 'Local'   },
    { name: 'HQ office rental',                      sectorId:  1, sectorScore: 0.60, expense:   550_000, origin: 'Local'   },
    { name: 'Imported software (local distributor)', sectorId: 37, sectorScore: 0.05, expense: 3_000_000, origin: 'Local'   },
    { name: 'Foreign cloud hosting',                 sectorId: 23, sectorScore: 0.00, expense: 2_000_000, origin: 'Foreign' },
  ],
  healthcare: [
    { name: 'Saudi Healthcare Services (staffing)',  sectorId: 11, sectorScore: 0.38, expense: 2_000_000, origin: 'Local'   },
    { name: 'Local medical equipment service',       sectorId:  3, sectorScore: 0.36, expense: 1_200_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   500_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   500_000, origin: 'Local'   },
    { name: 'Manpower supply (Saudi)',               sectorId: 18, sectorScore: 0.59, expense:   700_000, origin: 'Local'   },
    { name: 'Local catering services',               sectorId:  2, sectorScore: 0.40, expense:   600_000, origin: 'Local'   },
    { name: 'KSA-manufactured consumables',          sectorId: 35, sectorScore: 0.30, expense:   800_000, origin: 'Local'   },
    { name: 'Saudi training institute',              sectorId:  9, sectorScore: 0.66, expense:   400_000, origin: 'Local'   },
    { name: 'Hospital building rental',              sectorId:  1, sectorScore: 0.60, expense:   700_000, origin: 'Local'   },
    { name: 'Imported medical equipment',            sectorId: 38, sectorScore: 0.00, expense: 2_500_000, origin: 'Foreign' },
    { name: 'Imported pharmaceuticals (distributor)',sectorId: 37, sectorScore: 0.05, expense: 2_600_000, origin: 'Local'   },
  ],
  manufacturing: [
    { name: 'KSA Chemicals Supplier',                sectorId: 26, sectorScore: 0.61, expense: 1_500_000, origin: 'Local'   },
    { name: 'Local industrial services',             sectorId:  3, sectorScore: 0.36, expense: 1_000_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   400_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   600_000, origin: 'Local'   },
    { name: 'Local packaging (KSA manufactured)',    sectorId: 35, sectorScore: 0.30, expense:   900_000, origin: 'Local'   },
    { name: 'Manpower supply (Saudi)',               sectorId: 18, sectorScore: 0.59, expense:   700_000, origin: 'Local'   },
    { name: 'Transport and logistics',               sectorId: 13, sectorScore: 0.45, expense:   700_000, origin: 'Local'   },
    { name: 'Saudi training institute',              sectorId:  9, sectorScore: 0.66, expense:   300_000, origin: 'Local'   },
    { name: 'Factory rental',                        sectorId:  1, sectorScore: 0.60, expense:   400_000, origin: 'Local'   },
    { name: 'Imported raw materials (agent)',        sectorId: 37, sectorScore: 0.05, expense: 3_000_000, origin: 'Local'   },
    { name: 'Foreign machinery parts',               sectorId: 38, sectorScore: 0.00, expense: 2_000_000, origin: 'Foreign' },
  ],
  professional: [
    { name: 'Local co-counsel / consultancy',        sectorId:  5, sectorScore: 0.50, expense: 2_200_000, origin: 'Local'   },
    { name: 'Saudi Security Services',               sectorId:  4, sectorScore: 0.82, expense:   400_000, origin: 'Local'   },
    { name: 'Local IT support (Saudi)',              sectorId: 19, sectorScore: 0.41, expense:   600_000, origin: 'Local'   },
    { name: 'Manpower supply (Saudi)',               sectorId: 18, sectorScore: 0.59, expense:   500_000, origin: 'Local'   },
    { name: 'Saudi training institute',              sectorId:  9, sectorScore: 0.66, expense:   350_000, origin: 'Local'   },
    { name: 'SEC (utilities)',                       sectorId: 21, sectorScore: 0.61, expense:   300_000, origin: 'Local'   },
    { name: 'KSA-manufactured office supplies',      sectorId: 35, sectorScore: 0.30, expense:   400_000, origin: 'Local'   },
    { name: 'Premium office rental',                 sectorId:  1, sectorScore: 0.60, expense:   900_000, origin: 'Local'   },
    { name: 'Foreign research databases (agent)',    sectorId: 22, sectorScore: 0.05, expense: 1_500_000, origin: 'Local'   },
    { name: 'Imported software (local distributor)', sectorId: 37, sectorScore: 0.05, expense: 2_800_000, origin: 'Local'   },
    { name: 'Foreign affiliate advisory',            sectorId: 23, sectorScore: 0.00, expense: 1_500_000, origin: 'Foreign' },
  ],
}

// Sectors the user can pick. Keep the list short — three is a ceiling
// even on mobile — and cover the industries most represented in KSA
// tender activity.
export const SAMPLE_SECTORS = [
  { id: 'generic',      label: 'Generic (mixed)'                  },
  { id: 'construction', label: 'Construction & Engineering'       },
  { id: 'it',           label: 'IT & Software Services'           },
  { id: 'healthcare',   label: 'Healthcare'                       },
  { id: 'manufacturing',label: 'Manufacturing'                    },
  { id: 'professional', label: 'Professional Services (legal, consulting, accounting)' },
]

// ── The three cases ───────────────────────────────────────────────────
// Each case has shared "backbone" data (labor, capacity, depreciation)
// that doesn't change between sectors, plus the sector-specific supplier
// list slot. The `story` fields power the educational banner shown after
// the sample is loaded.

function caseLow(sectorId = 'generic') {
  return {
    sampleCase: 'low',
    sampleSector: sectorId,
    name: 'Sample: Low LC Score (~29%)',
    labor: { saudiComp: 1_200_000, foreignComp: 8_800_000 },
    suppliers: (LOW_SUPPLIERS[sectorId] || LOW_SUPPLIERS.generic).map(s => ({ ...s })),
    totalGSExpense: 15_500_000,
    otherCosts: 0,
    inventoryMovement: 0,
    training: 30_000,
    supplierDev: 0,
    rdExpense: 0,
    totalRevenue: 0,
    assets: [
      { name: 'Headquarters',        assetType: 'BUILDING',  amount:   600_000, producedInKSA: true  },
      { name: 'Imported excavators', assetType: 'MACHINERY', amount: 2_000_000, producedInKSA: false },
      { name: 'Fleet vehicles',      assetType: 'VEHICLES',  amount:   600_000, producedInKSA: false },
    ],
  }
}

function caseMid(sectorId = 'generic') {
  return {
    sampleCase: 'mid',
    sampleSector: sectorId,
    name: 'Sample: At Threshold (~43%)',
    labor: { saudiComp: 2_000_000, foreignComp: 8_000_000 },
    suppliers: (MID_SUPPLIERS[sectorId] || MID_SUPPLIERS.generic).map(s => ({ ...s })),
    totalGSExpense: 11_000_000,
    otherCosts: 400_000,
    inventoryMovement: 0,
    training: 80_000,
    supplierDev: 30_000,
    rdExpense: 60_000,
    totalRevenue: 20_000_000,
    assets: [
      { name: 'Office building (owned)',    assetType: 'BUILDING',  amount:   800_000, producedInKSA: true  },
      { name: 'Office furniture',           assetType: 'FURNITURE', amount:   100_000, producedInKSA: true  },
      { name: 'IT equipment (imported)',    assetType: 'MACHINERY', amount: 1_200_000, producedInKSA: false },
      { name: 'Company vehicles',           assetType: 'VEHICLES',  amount:   600_000, producedInKSA: false },
    ],
  }
}

function caseHigh(sectorId = 'generic') {
  return {
    sampleCase: 'high',
    sampleSector: sectorId,
    name: 'Sample: High LC Score (~65%)',
    labor: { saudiComp: 5_500_000, foreignComp: 7_500_000 },
    suppliers: (HIGH_SUPPLIERS[sectorId] || HIGH_SUPPLIERS.generic).map(s => ({ ...s })),
    totalGSExpense: 12_500_000,
    otherCosts: 700_000,
    inventoryMovement: 0,
    training: 400_000,
    supplierDev: 250_000,
    rdExpense: 500_000,
    totalRevenue: 30_000_000,
    assets: [
      { name: 'Main office building',       assetType: 'BUILDING',  amount: 1_500_000, producedInKSA: true  },
      { name: 'KSA-manufactured equipment', assetType: 'MACHINERY', amount:   500_000, producedInKSA: true  },
      { name: 'Imported equipment',         assetType: 'MACHINERY', amount: 1_200_000, producedInKSA: false },
      { name: 'Office furniture (local)',   assetType: 'FURNITURE', amount:   150_000, producedInKSA: true  },
      { name: 'Vehicles',                   assetType: 'VEHICLES',  amount:   600_000, producedInKSA: false },
    ],
  }
}

// ── Sample cases list — shown in the picker ──────────────────────────
// Each entry has enough metadata to render a card on the picker screen.
// The `build(sectorId)` function returns the assessment object ready to
// drop into the calculator.
export const SAMPLE_CASES = [
  {
    id: 'low',
    title: 'Case 1 — Below Threshold',
    subtitle: 'Typical LC score: ~29%',
    summary: 'A company heavily dependent on foreign suppliers and expatriate staff. Most CAPEX is imported. No R&D or supplier development program. Result: falls below the 40% government procurement threshold.',
    color: 'danger',
    icon: '⚠',
    build: caseLow,
  },
  {
    id: 'mid',
    title: 'Case 2 — Just at Threshold',
    subtitle: 'Typical LC score: ~43%',
    summary: 'A company with a balanced but still import-heavy supply chain. Moderate Saudization. Some R&D and training, but not enough to earn the full incentive. Sits right above the 40% threshold — vulnerable to falling below it.',
    color: 'warning',
    icon: '◐',
    build: caseMid,
  },
  {
    id: 'high',
    title: 'Case 3 — Well Above Threshold',
    subtitle: 'Typical LC score: ~65%',
    summary: 'A company that has invested in Saudization, local suppliers, supplier development, and a meaningful R&D budget (earning the full 10% incentive). Comfortably above the 40% threshold and competitive in tender scoring.',
    color: 'success',
    icon: '✓',
    build: caseHigh,
  },
]

// ── Educational "story" explanations ─────────────────────────────────
// Shown in a banner at the top of the calculator after a sample loads.
// Each story is a structured breakdown: headline, key drivers (what's
// pulling the score where it is), and levers (what the company could
// change). The Calculator component renders these into a readable panel.

export const SAMPLE_STORIES = {
  low: {
    headline: 'Why this company scored below 40%',
    verdict: 'Not eligible for government procurement under LCGPA Article 11.',
    drivers: [
      { icon: '⬇', title: 'Only 12% Saudi workforce (by compensation)',
        detail: 'Foreign labor scores at 53.4% vs. 100% for Saudi. With SAR 8.8M of foreign comp against SAR 1.2M Saudi, labor contributes far less to LC than it could.' },
      { icon: '⬇', title: 'Foreign and low-LC supplier spend dominates G&S',
        detail: 'SAR 14.2M of SAR 15.5M G&S goes to foreign suppliers (0%), foreign-service agents (5%), or local distributors of imported goods (5%). Weighted LC across G&S is under 7%.' },
      { icon: '⬇', title: 'Imported machinery and vehicles at 30%',
        detail: 'Only SAR 600K of SAR 3.2M depreciation comes from KSA-produced assets. Foreign assets now score 30% under V2 (up from 20%), so this area got slightly less punishing — but it still drags the score down.' },
      { icon: '⬇', title: 'No R&D, no supplier development',
        detail: 'Missing the R&D incentive (up to +10% to final score) and the supplier development contribution entirely.' },
    ],
    levers: [
      'Replace foreign-distributor spend with local manufacturers wherever technically feasible — even 5% → 40% sector scores add up fast.',
      'Increase Saudi hires at senior/specialist levels to shift the labor mix meaningfully (not just headcount but compensation weight).',
      'Even a modest R&D program (~2% of revenue) locks in a +10% final-score bonus, regardless of cost ratios.',
    ],
  },
  mid: {
    headline: 'Why this company scored right at threshold',
    verdict: 'Eligible for government procurement — but vulnerable to dropping below 40%.',
    drivers: [
      { icon: '⬇', title: '20% Saudi labor is still a drag',
        detail: 'Saudi comp is SAR 2M of SAR 10M. Moving toward 50/50 would add roughly 10 percentage points to the labor contribution alone.' },
      { icon: '⬇', title: 'Over SAR 7M of G&S spend is at 0-5% LC',
        detail: 'Imported software via local distributors (5%) and foreign cloud hosting (0%) together make up two-thirds of the G&S book.' },
      { icon: '⬆', title: 'Office building is KSA-owned',
        detail: 'Buildings & land improvements in KSA always score 100% regardless of construction origin — a reliable LC anchor.' },
      { icon: '⬆', title: 'Small R&D budget earns partial incentive',
        detail: 'R&D at 0.3% of revenue earns +1.5% bonus. Scaling to 2% of revenue would more than double the bonus to +10%.' },
    ],
    levers: [
      'Reclassify any SEC, NWC, SWCC, or Marafiq spend under the new "Utility Services" sector (61% LC) instead of generic services.',
      'Every SAR spent with local IT consultancies (41%) instead of foreign cloud (0%) adds meaningful LC — don\'t sleep on this category.',
      'Bump R&D spend to 2% of revenue (SAR 400K on SAR 20M) to lock in the full 10% incentive and push comfortably past 50%.',
    ],
  },
  high: {
    headline: 'Why this company scored well above threshold',
    verdict: 'Comfortably eligible — strong competitive position in LCGPA tender scoring.',
    drivers: [
      { icon: '⬆', title: '42% Saudi workforce provides a solid labor base',
        detail: 'SAR 5.5M of Saudi comp contributes at 100%; foreign SAR 7.5M at 53.4%. Together labor alone adds 10M+ to LC.' },
      { icon: '⬆', title: 'Majority of G&S flows through local, mid-to-high-LC sectors',
        detail: 'Professional Services (50%), Security (82%), Steel Rebar (60%), Cement (50%), Utilities (61%), Chemicals (61%) — a healthy mix that averages well above 30%.' },
      { icon: '⬆', title: 'R&D at 2% of revenue earns the full 10% incentive',
        detail: 'SAR 500K R&D on SAR 30M revenue hits the 2% threshold exactly. This adds +8.3% directly to the final score (not via the LC/Cost ratio).' },
      { icon: '⬇', title: 'Still room to grow: foreign imports and agents',
        detail: 'SAR 5.5M remains in local distributor (5%) and foreign consultant (0%) categories — the single biggest remaining opportunity.' },
    ],
    levers: [
      'Continue the supplier-development program — direct spend on developing KSA suppliers counts at 100% LC.',
      'Replace the foreign specialist consultants with local engineering firms where scope allows — every SAR shifted gains 50 percentage points of LC.',
      'Track audited supplier LC scores: if your top local suppliers get audited and come back above their sector default, use their audited score instead (automatic in the calculator).',
    ],
  },
}
