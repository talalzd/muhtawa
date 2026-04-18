// ─── LCGPA Template V2 (OM-LRG-02 V.2) ──────────────────────────────────
// Updated from V7 to V2 based on the official 2025 measurement template.
// Key changes from previous version:
//   - Foreign labor factor: 0.37 → 0.534
//   - Foreign asset depreciation factor: 0.20 → 0.30
//   - Buildings & Land Improvements in KSA always count at 100%
//   - 38 sectors (was 39) — "High LC Companies" sector removed, "Utility
//     Services" added
//   - Many sector weight increases (Industrial, Security, Healthcare, IT,
//     Chemicals, Mining, etc.)
//   - R&D incentive (up to 10%) is now added directly to the LC ratio
//     rather than reported separately

export const SECTORS = [
  // ── Services (1-23) ───────────────────────────────────────────────────
  { id: 1,  code: "1_SERVICES",  name: "KSA Accommodation & Facility Rental",      type: "Services", origin: "Local",   score: 0.60, isic: "55, 68102",              desc: "Short-term accommodation (hotels), office buildings, compounds, warehouses rental" },
  { id: 2,  code: "2_SERVICES",  name: "KSA Food and Beverage Services",           type: "Services", origin: "Local",   score: 0.40, isic: "56",                     desc: "Food and beverage services (restaurants, catering). Excludes pre-packaged F&B products." },
  { id: 3,  code: "3_SERVICES",  name: "KSA Industrial Services",                  type: "Services", origin: "Local",   score: 0.36, isic: "25921, 33, 35-38 exc. 351-352, 381103, 383, 712", desc: "Preventive maintenance, inspection, calibration, painting, waste collection and treatment" },
  { id: 4,  code: "4_SERVICES",  name: "KSA Security Services",                    type: "Services", origin: "Local",   score: 0.82, isic: "80, 811001",             desc: "Guard, patrol, armored car, building protection, fire/theft alarm system services" },
  { id: 5,  code: "5_SERVICES",  name: "KSA Professional Services",                type: "Services", origin: "Local",   score: 0.50, isic: "69-74 exc. 712",         desc: "Engineering, accounting, legal, management consultancy, advertising, marketing" },
  { id: 6,  code: "6_SERVICES",  name: "KSA Rep of Foreign Professional Services", type: "Services", origin: "Local",   score: 0.20, isic: "69-74 exc. 712",         desc: "Local representative of foreign professional service provider" },
  { id: 7,  code: "7_SERVICES",  name: "KSA Real Estate Services",                 type: "Services", origin: "Local",   score: 0.48, isic: "68 exc. 68102",          desc: "Real estate services, buying/selling land. Excludes property rental." },
  { id: 8,  code: "8_SERVICES",  name: "KSA Construction Services",                type: "Services", origin: "Local",   score: 0.40, isic: "41-43",                  desc: "Construction of buildings, roads, railways; specialized construction activities" },
  { id: 9,  code: "9_SERVICES",  name: "KSA Education Services",                   type: "Services", origin: "Local",   score: 0.66, isic: "75, 85",                 desc: "Education activities, professional training, language education" },
  { id: 10, code: "10_SERVICES", name: "KSA Financial and Insurance Services",     type: "Services", origin: "Local",   score: 0.75, isic: "64-66",                  desc: "Banking, funds management, insurance and pension services" },
  { id: 11, code: "11_SERVICES", name: "KSA Healthcare Services",                  type: "Services", origin: "Local",   score: 0.38, isic: "86-88",                  desc: "Healthcare services. Excludes medical supplies and pharmaceuticals." },
  { id: 12, code: "12_SERVICES", name: "KSA Public Administration Services",       type: "Services", origin: "Local",   score: 0.69, isic: "84",                     desc: "Ministries, public administration, state affairs, foreign affairs, defence" },
  { id: 13, code: "13_SERVICES", name: "KSA Transport and Logistics Services",     type: "Services", origin: "Local",   score: 0.45, isic: "49-53 exc. 49225, 79-7911", desc: "Shipping, cargo, Saudi-based airlines. Foreign airlines booked through local agents classed separately." },
  { id: 14, code: "14_SERVICES", name: "KSA Onshore Drilling Services",            type: "Services", origin: "Local",   score: 0.30, isic: "06, 091",                 desc: "Onshore drilling services" },
  { id: 15, code: "15_SERVICES", name: "KSA Offshore Drilling Services",           type: "Services", origin: "Local",   score: 0.20, isic: "06, 091",                 desc: "Offshore drilling services" },
  { id: 16, code: "16_SERVICES", name: "KSA Mining Services",                      type: "Services", origin: "Local",   score: 0.30, isic: "09",                     desc: "Mining support services" },
  { id: 17, code: "17_SERVICES", name: "KSA Cars, Trucks & Equipment Rental",      type: "Services", origin: "Local",   score: 0.35, isic: "49225, 773-7730, 771",   desc: "Rental of cars, trucks, equipment including power generation equipment (with driver)" },
  { id: 18, code: "18_SERVICES", name: "KSA Manpower Supply Services",             type: "Services", origin: "Local",   score: 0.59, isic: "78",                     desc: "Manpower / labor force supply services" },
  { id: 19, code: "19_SERVICES", name: "KSA IT and Telecom Services",              type: "Services", origin: "Local",   score: 0.41, isic: "582, 61-63",             desc: "IT services, programming, broadcasting, telecommunications, computer programming, information services" },
  { id: 20, code: "20_SERVICES", name: "KSA Other Services",                       type: "Services", origin: "Local",   score: 0.35, isic: "39, 58-60 exc. 582, 772, 7912-7990, 81-8110, 812-8299, 90-99", desc: "Services not classified elsewhere — recreation, household, other" },
  { id: 21, code: "21_SERVICES", name: "KSA Utility Services",                     type: "Services", origin: "Local",   score: 0.61, isic: "351, 36, 37",             desc: "Electricity supply, water supply, sewerage services (NEW in V2)" },
  { id: 22, code: "22_SERVICES", name: "Foreign Service Agent",                    type: "Services", origin: "Local",   score: 0.05, isic: "N/A",                    desc: "Obtaining any service from a foreign provider through a Saudi agent" },
  { id: 23, code: "23_SERVICES", name: "Foreign Services",                         type: "Services", origin: "Foreign", score: 0.00, isic: "N/A",                    desc: "Services obtained from providers outside KSA" },

  // ── Goods (24-38) ─────────────────────────────────────────────────────
  { id: 24, code: "24_GOODS",    name: "KSA Agriculture, Forestry, Fishing Products", type: "Goods", origin: "Local",   score: 0.57, isic: "01-03",                  desc: "Locally produced raw materials from farming, forestry, livestock, fishing" },
  { id: 25, code: "25_GOODS",    name: "KSA Food and Beverage Products",           type: "Goods",    origin: "Local",   score: 0.35, isic: "10-12",                  desc: "Locally manufactured food, beverage and tobacco products" },
  { id: 26, code: "26_GOODS",    name: "KSA Chemicals and Oil & Gas Products",     type: "Goods",    origin: "Local",   score: 0.61, isic: "19-20, 22, 352",         desc: "Locally produced chemicals, plastics, oil & gas products (e.g., rubber)" },
  { id: 27, code: "27_GOODS",    name: "KSA Other Chemical Products",              type: "Goods",    origin: "Local",   score: 0.29, isic: "20",                     desc: "Locally manufactured chemicals using imported raw materials (includes paints)" },
  { id: 28, code: "28_GOODS",    name: "KSA Machinery and Equipment Products",     type: "Goods",    origin: "Local",   score: 0.25, isic: "265-268, 28 exc. 2813-2814, 29-30", desc: "Locally manufactured machinery and equipment" },
  { id: 29, code: "29_GOODS",    name: "KSA Electrical Materials Products",        type: "Goods",    origin: "Local",   score: 0.40, isic: "27, 2814",               desc: "Locally produced electrical materials: switchgear, junction boxes, trays, fixtures" },
  { id: 30, code: "30_GOODS",    name: "KSA Mining Products",                      type: "Goods",    origin: "Local",   score: 0.45, isic: "05, 07-08",              desc: "Locally extracted mining products: metal ores, sand, coal" },
  { id: 31, code: "31_GOODS",    name: "KSA Static Equipment Products",            type: "Goods",    origin: "Local",   score: 0.30, isic: "24-25 exc. 25114-25921, 2813", desc: "Locally manufactured static equipment: tanks, pressure vessels, valves (excl. control), steel structures" },
  { id: 32, code: "32_GOODS",    name: "KSA Cement and Gypsum Products",           type: "Goods",    origin: "Local",   score: 0.50, isic: "2394-2395",              desc: "Locally manufactured cement, gypsum and their products" },
  { id: 33, code: "33_GOODS",    name: "KSA Steel Rebar Manufacturing",            type: "Goods",    origin: "Local",   score: 0.60, isic: "25114",                  desc: "Locally manufactured reinforcement steel (rebar)" },
  { id: 34, code: "34_GOODS",    name: "KSA IT and Telecom Manufacturing",         type: "Goods",    origin: "Local",   score: 0.15, isic: "261-264",                desc: "Locally manufactured wired/wireless comms equipment, computer and electronic products" },
  { id: 35, code: "35_GOODS",    name: "KSA Other Local Products",                 type: "Goods",    origin: "Local",   score: 0.30, isic: "13-18, 21, 23 exc. 2394-2395, 31-32 (inc. 2790 PV panels, inverters)", desc: "Paper, wood, furniture, textiles, pharmaceuticals, PV panels, inverters" },
  { id: 36, code: "36_GOODS",    name: "KSA Recycled Products",                    type: "Goods",    origin: "Local",   score: 0.70, isic: "381103, 383",            desc: "Locally recycled metal, paper, plastic, rubber" },
  { id: 37, code: "37_GOODS",    name: "KSA Agent or Distributor",                 type: "Goods",    origin: "Local",   score: 0.05, isic: "45-47",                  desc: "Goods not manufactured in KSA, obtained from a KSA-based supplier (importer/distributor)" },
  { id: 38, code: "38_GOODS",    name: "Foreign Goods",                            type: "Goods",    origin: "Foreign", score: 0.00, isic: "N/A",                    desc: "Goods obtained from suppliers outside KSA" },
]

export const PRODUCT_CATEGORIES = [
  { main: "Hardware", mainAr: "أجهزة تقنية المعلومات", subs: ["Hardware Devices", "Handsets & Wearables", "Accessories", "Data Center Hardware", "Physical Access Hardware", "Networking Hardware", "Other Hardware"] },
  { main: "Software", mainAr: "البرمجيات", subs: ["End-user Applications", "Gaming Apps", "Middleware & Firmware", "Business Software", "System Software"] },
  { main: "Emerging Technologies", mainAr: "التقنيات الناشئة", subs: ["AR/VR", "Robotics", "Artificial Intelligence", "Internet of Things", "Distributed Ledger Technology", "Big Data", "3D Printing"] },
]

export const TEAM_QUESTIONS = [
  { key: "hasRDTeam", label: "Research & Innovation team in KSA?" },
  { key: "hasClientResearchTeam", label: "Client needs research team in KSA?" },
  { key: "hasDesignTeam", label: "Product design team in KSA?" },
  { key: "hasDevTeam", label: "Development/manufacturing team in KSA?" },
  { key: "hasTestingTeam", label: "Testing team in KSA?" },
  { key: "hasManagementTeam", label: "Product management/deployment team in KSA?" },
  { key: "hasMaintenanceTeam", label: "Maintenance/support team in KSA?" },
  { key: "usesLocalAssets", label: "Uses local assets for manufacturing/hosting?" },
]

// ─── LCGPA Template V2 weights ─────────────────────────────────────────
export const LABOR_SAUDI_FACTOR = 1.0       // Saudi employees: 100%
export const LABOR_FOREIGN_FACTOR = 0.534   // Foreign employees: 53.4% (was 37% in V7)

// Depreciation factors. Buildings & Land Improvements in KSA always count
// at 100% regardless — handled in scoring.js via the `assetType` field.
export const DEPRECIATION_LOCAL_FACTOR = 1.0       // KSA-produced assets: 100%
export const DEPRECIATION_FOREIGN_FACTOR = 0.30    // Foreign-produced assets: 30% (was 20% in V7)
export const DEPRECIATION_BUILDING_FACTOR = 1.0    // Buildings in KSA: always 100%

// Asset types per Section 7.2 of V2 template.
// BUILDING is special — always scored at 100% local regardless of origin.
export const ASSET_TYPES = [
  { id: 'BUILDING',       label: 'Buildings & Land Improvements', alwaysLocal: true,  desc: 'Buildings, land improvements, land. Always 100% LC.' },
  { id: 'FURNITURE',      label: 'Furniture',                     alwaysLocal: false, desc: 'Office furniture, meeting chairs and tables' },
  { id: 'MACHINERY',      label: 'Machinery and Equipment',       alwaysLocal: false, desc: 'Industrial equipment, testing equipment, IT and communications equipment' },
  { id: 'VEHICLES',       label: 'Vehicles',                      alwaysLocal: false, desc: 'Mobile cranes, trucks, transport vehicles, cars, trailers' },
  { id: 'INFRASTRUCTURE', label: 'Infrastructure',                alwaysLocal: false, desc: 'Infrastructure works such as road networks, power, water' },
  { id: 'PROPERTY',       label: 'Investment Properties',         alwaysLocal: false, desc: 'Real estate assets like residential and commercial buildings' },
  { id: 'LEASE_TANGIBLE', label: 'Right-of-Use (Lease)',          alwaysLocal: false, desc: 'Building, equipment, vehicle lease contracts' },
  { id: 'LEASE_SOFTWARE', label: 'Right-of-Use (Software)',       alwaysLocal: false, desc: 'Software licenses' },
  { id: 'OTHER',          label: 'Other',                         alwaysLocal: false, desc: 'Other asset classes' },
]

// R&D incentive: up to 10% bonus, full incentive at 2% of revenue.
// Added directly to the final LC percentage (not via LC/Cost ratio).
export const RD_INCENTIVE_MAX = 0.10
export const RD_REVENUE_THRESHOLD = 0.02

// Minimum LC score required for government procurement eligibility
export const LC_THRESHOLD = 0.40

// Template version metadata — shown in UI for audit trail
export const TEMPLATE_VERSION = 'V.2'
export const TEMPLATE_CODE = 'OM-LRG-02'
