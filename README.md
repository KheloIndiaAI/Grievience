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
npm run dev:internal   # internal view with grievance text, local only (see data-pipeline/README.md)
```

## Data

Coverage: grievances received 1 Jan 2022 – 21 Oct 2026, status as of 26 Oct 2026 (6,893 grievances; 2025 is a
partial pull, which the dashboard notes from the dataset's `coverage` field).

`public/data/grievances.json` is the **redacted** public dataset (`"redacted": true`). It has no
names, contact details, addresses, complaint or reply text, or officer remarks. Complainants appear
only as anonymous per-release codes (`cid`), and the re-filing fields are precomputed. The redacted
file is produced offline from the internal CPGRAMS export, and the internal export must never be
committed here.

`scripts/check_pii.py` runs in CI on the dataset and on the built `dist/`. Anything that looks like
a mobile number, email, Aadhaar or PAN, or a personal-data field, blocks the deploy.

## Internal view and data pipeline

The same code also runs an **internal view** on a local machine: `npm run dev:internal` loads
`private/grievances.internal.json` (git-ignored) and shows grievance and reply text, complainant
details (masked until switched on) and full CSV exports. The mode follows the dataset's `redacted`
flag. The internal file is served only by the dev server; `vite build` refuses to run with
`VITE_DATA_URL` set. `data-pipeline/` holds the scripts that build it from a CPGRAMS export.

## Deploy

`.github/workflows/frontend.yml`:
CI/CD runs on every push to `dev`; pull requests into `dev` get the same checks without deploying:
- **Push to `dev`**: type-check, build, PII gate, then the tested `dist/` is synced to S3 (hashed assets cached
  for a year; `index.html` and `data/*.json` set to no-cache) and CloudFront is invalidated.

AWS access is keyless through GitHub OIDC. The workflow reads the repository **variables**
`AWS_REGION`, `FE_DEPLOY_ROLE_ARN`, `FRONTEND_BUCKET` and `CLOUDFRONT_DIST_ID`, which the AWS
deploy kit prints when it provisions the bucket and distribution. Until those are set, the deploy
job is skipped rather than failing.

Rollback: revert on `dev` and push, or re-run the workflow for the last good commit.
