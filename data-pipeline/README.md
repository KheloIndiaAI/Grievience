# Data pipeline

Turns a CPGRAMS Excel export into the datasets the dashboard reads.

| Step | Script | Output | In git? |
|---|---|---|---|
| 1. Analyse the export | `grievance_analysis.py`, `sai_analysis.py` | `private/*_Analysis_Output.xlsx`, `private/summary_stats.json` | **No** |
| 2. Internal dataset | `export_dashboard_data.py` | `private/grievances.internal.json` | **No** (personal data + free text) |
| 3. Public dataset | `redact_dataset.py` *(to be added)* | `public/data/grievances.json` (`"redacted": true`) | Yes |

Everything under `private/` is git-ignored. Only the redacted file in `public/data/` is committed, and
CI (`scripts/check_pii.py`) blocks any deploy where it looks otherwise.

## Run

```bash
pip install pandas numpy openpyxl
CPGRAMS_XLSX=/path/to/CPGRAMS_export.xlsx AS_OF=2026-10-21 \
  python3 -I data-pipeline/export_dashboard_data.py     # runs steps 1 and 2
npm run dev:internal                                     # internal view on http://localhost:5173
```

| Variable | Meaning | Default |
|---|---|---|
| `CPGRAMS_XLSX` | the CPGRAMS export (Excel) | `private/CPGRAMS_export.xlsx` |
| `AS_OF` | status date of the export; pending ages and idle days are measured to it | `2026-10-21` |
| `PIPELINE_OUT` | where the analysis workbooks go | `private/` |

## Internal view

`npm run dev:internal` runs the same dashboard on your machine with `private/grievances.internal.json`:
grievance and reply text, complainant details (masked until you switch them on), and exports that
include the text. It only exists on the local dev server. `vite build` refuses to run with
`VITE_DATA_URL` set, and the build never reads `private/`.

The re-filing rules in `src/data.ts` (`deriveRefilings`) and in the redaction step must stay the same.
