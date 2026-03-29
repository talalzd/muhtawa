export const SECTORS = [
  { id: 1, code: "1_SERVICES", name: "KSA Accommodation", type: "Services", origin: "Local", score: 0.60, isic: "55", desc: "Short-term accommodation (Hotels), Camping grounds, Other accommodation" },
  { id: 2, code: "2_SERVICES", name: "KSA Food and Beverages", type: "Services", origin: "Local", score: 0.40, isic: "56", desc: "Food and beverages services (Restaurants, catering)" },
  { id: 3, code: "3_SERVICES", name: "KSA Industrial Services", type: "Services", origin: "Local", score: 0.30, isic: "25921, 33, 35-38", desc: "Testing, inspection, certification, calibration, maintenance services" },
  { id: 4, code: "4_SERVICES", name: "KSA Security Services", type: "Services", origin: "Local", score: 0.70, isic: "80, 811001", desc: "Guard and patrol services, electronic security alarm systems" },
  { id: 5, code: "5_SERVICES", name: "KSA Professional Services", type: "Services", origin: "Local", score: 0.50, isic: "69-74", desc: "Engineering, accounting, legal, management consultancy" },
  { id: 6, code: "6_SERVICES", name: "KSA Rep of Foreign Professional Services", type: "Services", origin: "Local", score: 0.20, isic: "69-74", desc: "Local representative of foreign professional service provider" },
  { id: 7, code: "7_SERVICES", name: "KSA Real Estate", type: "Services", origin: "Local", score: 0.40, isic: "68", desc: "Selling/buying real estate, appraising, escrow agents" },
  { id: 8, code: "8_SERVICES", name: "KSA Construction", type: "Services", origin: "Local", score: 0.35, isic: "41-43", desc: "Construction services, specialized construction activities" },
  { id: 9, code: "9_SERVICES", name: "KSA Education", type: "Services", origin: "Local", score: 0.66, isic: "75, 85", desc: "Education activities, professional training, language education" },
  { id: 10, code: "10_SERVICES", name: "KSA Finance and Insurance", type: "Services", origin: "Local", score: 0.75, isic: "64-66", desc: "Banking, funds management, insurance and pension services" },
  { id: 11, code: "11_SERVICES", name: "KSA Healthcare", type: "Services", origin: "Local", score: 0.29, isic: "86-88", desc: "Healthcare services (excluding equipment and pharmaceuticals)" },
  { id: 12, code: "12_SERVICES", name: "KSA Public Administration and Defence", type: "Services", origin: "Local", score: 0.69, isic: "84", desc: "Government bodies, public administration, defence activities" },
  { id: 13, code: "13_SERVICES", name: "KSA Transport and Logistics", type: "Services", origin: "Local", score: 0.40, isic: "49-53", desc: "Shipping, transportation, cargo, Saudi-based airlines" },
  { id: 14, code: "14_SERVICES", name: "KSA Onshore Drilling", type: "Services", origin: "Local", score: 0.30, isic: "06, 091", desc: "Onshore drilling services" },
  { id: 15, code: "15_SERVICES", name: "KSA Offshore Drilling", type: "Services", origin: "Local", score: 0.20, isic: "06, 091", desc: "Offshore drilling services" },
  { id: 16, code: "16_SERVICES", name: "KSA Mining Services", type: "Services", origin: "Local", score: 0.30, isic: "09", desc: "Mining services" },
  { id: 17, code: "17_SERVICES", name: "KSA Facility Rental", type: "Services", origin: "Local", score: 0.60, isic: "68102", desc: "Office buildings, compounds, warehouses rental" },
  { id: 18, code: "18_SERVICES", name: "KSA Cars, Trucks & Equipment Rental", type: "Services", origin: "Local", score: 0.25, isic: "49225, 773, 771", desc: "Rental of cars, trucks, equipment including driver services" },
  { id: 19, code: "19_SERVICES", name: "KSA Man Power Supply", type: "Services", origin: "Local", score: 0.45, isic: "78", desc: "Total labor force of the entity" },
  { id: 20, code: "20_SERVICES", name: "IT & Telecom Services", type: "Services", origin: "Local", score: 0.30, isic: "582, 61-63", desc: "IT services, computer programming, broadcasting, telecom" },
  { id: 21, code: "21_SERVICES", name: "KSA Other Services", type: "Services", origin: "Local", score: 0.20, isic: "39, 58-60", desc: "Recreation activities, household activities, other services" },
  { id: 22, code: "22_SERVICES", name: "Foreign Service Agent", type: "Services", origin: "Local", score: 0.05, isic: "N/A", desc: "Foreign service through local agents, travel agencies" },
  { id: 23, code: "23_SERVICES", name: "Foreign Services", type: "Services", origin: "Foreign", score: 0.00, isic: "N/A", desc: "Services from foreign providers without KSA registration" },
  { id: 24, code: "24_GOODS", name: "KSA Agriculture, Forestry and Fishing", type: "Goods", origin: "Local", score: 0.57, isic: "01-03", desc: "Locally produced raw materials from agriculture, forestry, fishing" },
  { id: 25, code: "25_GOODS", name: "KSA Food and Beverage", type: "Goods", origin: "Local", score: 0.35, isic: "10-12", desc: "Locally produced food, beverage and tobacco products" },
  { id: 26, code: "26_GOODS", name: "KSA Chemicals & Oil and Gas", type: "Goods", origin: "Local", score: 0.50, isic: "19-20, 22, 352", desc: "Locally produced chemicals, plastics, Oil & Gas products" },
  { id: 27, code: "27_GOODS", name: "KSA Chemical Blending", type: "Goods", origin: "Local", score: 0.10, isic: "20", desc: "Locally produced chemicals with imported raw material" },
  { id: 28, code: "28_GOODS", name: "KSA Machinery and Equipment", type: "Goods", origin: "Local", score: 0.20, isic: "265-268, 28, 29-30", desc: "Locally produced machinery and equipment" },
  { id: 29, code: "29_GOODS", name: "KSA Electrical Materials", type: "Goods", origin: "Local", score: 0.40, isic: "27, 2814", desc: "Switch gears, junction boxes, trays, conduits, fixtures" },
  { id: 30, code: "30_GOODS", name: "KSA Mining", type: "Goods", origin: "Local", score: 0.34, isic: "05, 07-08", desc: "Locally produced raw materials from mining (coal, metal ores)" },
  { id: 31, code: "31_GOODS", name: "KSA Static Equipment", type: "Goods", origin: "Local", score: 0.30, isic: "24-25, 2813", desc: "Tanks, pressure vessels, valves, steel structures" },
  { id: 32, code: "32_GOODS", name: "KSA Cement and Gypsum", type: "Goods", origin: "Local", score: 0.50, isic: "2394-2395", desc: "Locally produced cement, concrete and gypsum" },
  { id: 33, code: "33_GOODS", name: "KSA Steel Rebar Manufacturing", type: "Goods", origin: "Local", score: 0.60, isic: "25114", desc: "Locally produced steel rebar" },
  { id: 34, code: "34_GOODS", name: "KSA IT & Telecom Manufacturing", type: "Goods", origin: "Local", score: 0.15, isic: "261-264", desc: "Computer/electronic components, communication equipment" },
  { id: 35, code: "35_GOODS", name: "KSA Other Manufacturing", type: "Goods", origin: "Local", score: 0.22, isic: "13-18, 21, 23, 31-32", desc: "Paper, wood, furniture, textiles, pharmaceuticals, PV panels" },
  { id: 36, code: "36_GOODS", name: "KSA Recyclers", type: "Goods", origin: "Local", score: 0.70, isic: "381103, 383", desc: "Locally recycled metal scrap, paper, plastic and rubber" },
  { id: 37, code: "37_GOODS", name: "KSA Agent or Distributor", type: "Goods", origin: "Local", score: 0.05, isic: "45-47", desc: "Suppliers who import and distribute goods (not producers)" },
  { id: 38, code: "38_GOODS", name: "KSA High LC Companies", type: "Goods", origin: "Local", score: 0.50, isic: "N/A", desc: "Aramco, SABIC, SEC, Maaden, STC, Zain, Mobily, SAR, SADARA, Marafiq, NWC, SWCC" },
  { id: 39, code: "39_GOODS", name: "Foreign Goods", type: "Goods", origin: "Foreign", score: 0.00, isic: "N/A", desc: "Goods from foreign producers without KSA registration" },
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

export const LABOR_FOREIGN_FACTOR = 0.37
export const LABOR_SAUDI_FACTOR = 1.0
export const DEPRECIATION_FOREIGN_FACTOR = 0.20
export const DEPRECIATION_LOCAL_FACTOR = 1.0
export const RD_INCENTIVE_MAX = 0.10
export const RD_REVENUE_THRESHOLD = 0.02
export const LC_THRESHOLD = 0.40
