# Muhtawa — Saudi Local Content Compliance Platform

Built by Talal Al Zayed. Helps companies bidding on Saudi government contracts calculate their LCGPA local content score, check Made in Saudi eligibility, and get AI-powered compliance recommendations.

## Features

- **LC Score Calculator** — Full LCGPA Template V7 scoring across Labor, Goods & Services (39 sectors), Capacity Building, and Depreciation
- **Made in Saudi Assessment** — Product registration assessment based on LCGPA Products Registration Form
- **AI Compliance Advisor** — Claude-powered assistant for compliance questions and recommendations
- **PDF Export** — Professional reports with full score breakdown and recommendations
- **User Accounts** — Supabase auth with saved company profiles and assessment history

---

## Deployment Guide (15 minutes)

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Settings → API
3. Go to **SQL Editor** and paste the contents of `supabase-setup.sql`, then click Run
4. Go to **Authentication → Settings** and make sure email auth is enabled

### Step 2: Set Up the Repo

Option A — Push to GitHub:
```bash
cd muhtawa
git init
git add .
git commit -m "Initial commit — Muhtawa v1"
git remote add origin https://github.com/YOUR_USERNAME/muhtawa.git
git push -u origin main
```

Option B — If you already have the repo:
```bash
# Just copy all files into your repo directory
```

### Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. Framework: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
6. Click Deploy

### Step 4: Custom Domain (Optional)

In Vercel → Settings → Domains, add `muhtawa.talalalzayed.com` (or whatever subdomain you prefer). Update your DNS to point to Vercel.

---

## Local Development

```bash
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
npm run dev
```

The app runs in demo mode without Supabase credentials — you can test all features with any email/password.

---

## Architecture

```
muhtawa/
├── src/
│   ├── App.jsx              # Main app with all views
│   ├── main.jsx             # Entry point
│   ├── index.css            # Global styles
│   └── lib/
│       ├── supabase.js      # Auth + CRUD helpers
│       ├── sectors.js       # 39 LCGPA sector scores + constants
│       ├── scoring.js       # Score computation engine
│       └── pdf.js           # PDF report generator
├── supabase-setup.sql       # Database migration
├── vercel.json              # Vercel routing config
└── package.json
```

## Data Sources

- **LCGPA Template N.1 (V7)** — Local Content Score Template (Baseline)
- **LCGPA Products Registration Form** — Made in Saudi product assessment
- **EXPRO** — Government efficiency and procurement planning (advisory context)

## Tech Stack

- Vite + React 18
- Supabase (Auth + PostgreSQL)
- Claude API (AI Advisor)
- jsPDF (PDF export)
- Vercel (hosting)
