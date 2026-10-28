# Grievience — Khel Samadhaan Grievance Analytics

Public dashboard of CPGRAMS grievances received by the Ministry of Youth Affairs & Sports and SAI:
volumes against the 21-day deadline, routing and bounces between offices, SAI handling, and what
grievances are about.

**Live:** https://pgp.ccki.in · **Deploys from:** `dev` · **Hosting:** S3 + CloudFront (`ap-south-1`)

React 18 + Vite 5 + Tailwind + shadcn/ui (Radix) + Recharts. Static build, hash routing (`#/overview`), no backend.

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build -> dist/
```

## Data

Coverage: grievances received 1 Jan 2022 – 21 Oct 2026, status as of 26 Oct 2026 (6,893 grievances; 2025 is a
partial pull, which the dashboard notes from the dataset's `coverage` field).

`public/data/grievances.json` is the **redacted** public dataset (`"redacted": true`). It has no
names, contact details, addresses, complaint or reply text, or officer remarks. Complainants appear
only as anonymous per-release codes (`cid`), and the re-filing fields are precomputed. The redacted
file is produced offline from the internal CPGRAMS export, and the internal export must never be
committed here.

`public/data/texts.json` holds the grievance and reply text, keyed by registration number, with personal
details scrubbed offline: the complainant's own name and address words, numbers of 6+ digits (phones,
Aadhaar, PIN codes, accounts), emails, PAN/IFSC and other long IDs, and names after phrases such as
"my name is", "S/o", "Shri" or "Regards" are replaced with `[name]`, `[number]`, `[address]`, `[email]`
or `[id]`. Officer remarks are not published. The dashboard fetches this file only when a grievance list
or a grievance is first opened. Free text can still mention places or circumstances that identify
someone; scrubbing reduces that risk but cannot remove it entirely.

`scripts/check_pii.py` runs in CI on the dataset and on the built `dist/` (which includes `texts.json`).
Anything that looks like a mobile number, email, Aadhaar or PAN, or a personal-data field, blocks the deploy.

## Deploy

`.github/workflows/frontend.yml`:
CI/CD runs on every push to `dev`, and on no other branch:
- **Push to `dev`**: type-check, build, PII gate, then the tested `dist/` is synced to S3 (hashed assets cached
  for a year; `index.html` and `data/*.json` set to no-cache) and CloudFront is invalidated.

AWS access is keyless through GitHub OIDC. The workflow reads the repository **variables**
`AWS_REGION`, `FE_DEPLOY_ROLE_ARN`, `FRONTEND_BUCKET` and `CLOUDFRONT_DIST_ID`, which the AWS
deploy kit prints when it provisions the bucket and distribution. Until those are set, the deploy
job is skipped rather than failing.

Rollback: revert on `dev` and push, or re-run the workflow for the last good commit.
