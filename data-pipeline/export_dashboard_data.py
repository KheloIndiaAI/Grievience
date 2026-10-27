"""
Exports enriched grievance records (from grievance_analysis.py) as JSON for the
React dashboard (INTERNAL dataset: contains personal data and free text).
Run:  CPGRAMS_XLSX=/path/to/export.xlsx AS_OF=YYYY-MM-DD python3 data-pipeline/export_dashboard_data.py
Writes private/grievances.internal.json, which `npm run dev:internal` serves. Never commit it.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import grievance_analysis as ga  # noqa: E402
import sai_analysis as sa  # noqa: E402

OUT = ga.ROOT / "private" / "grievances.internal.json"


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, (pd.Timestamp,)):
        return None if pd.isna(v) else v.strftime("%Y-%m-%d")
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if np.isnan(v) else round(float(v), 2)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if v is pd.NaT:
        return None
    return v


def main():
    df, _ = ga.main()
    df = sa.enrich(df)

    # office code -> name
    names = {"C1TZN": "Complainant"}
    for h in df["Action History"].dropna():
        for m in re.finditer(r"([A-Za-z][^\n]*?) - \(([A-Z0-9 ]{2,8})\)", h):
            nm = re.sub(r"^.*?\d{2}/\d{2}/\d{4}\s+", "", m.group(1)).strip()
            nm = re.sub(r"^.*\) ", "", nm)
            names.setdefault(m.group(2).strip(), nm)

    recs = []
    for _, r in df.iterrows():
        st = ga.parse_history(r["Action History"])
        steps, prev = [], None
        for s in st:
            steps.append({
                "n": s["n"], "action": s["action"].title(),
                "date": s["date"].strftime("%Y-%m-%d"),
                "from": s["frm"], "to": s["to"], "remarks": s["remarks"][:1500],
                "gap": None if prev is None else int((s["date"] - prev).days),
            })
            prev = s["date"]
        holder = st[-1]["to"] if st else None
        idle = int((pd.Timestamp(ga.AS_OF) - st[-1]["date"]).days) if st else None
        g = lambda c: clean(r.get(c))
        recs.append({
            "id": g("Registration Number"),
            "name": g("Name"), "mobile": None if pd.isna(r["Mobile"]) else str(int(r["Mobile"])),
            "email": g("Email"), "address": g("Address"),
            "district": g("District"), "state": g("State"),
            "receipt": g("Receipt Date"), "month": g("Month"), "weekday": g("Weekday"),
            "source": g("Source Portal"), "channel": g("Channel"),
            "receivedBy": g("Grievance Received By"), "nodal": g("Nodal Ministry"),
            "division": g("Closing Organisation"),
            "holder": None if r["Disposed"] else holder,
            "idleDays": None if r["Disposed"] else idle,
            "catL1": g("CPGRAMS Category L1"), "catL2": g("CPGRAMS Category L2") or None,
            "theme": g("Theme (keyword)"), "language": g("Language"),
            "campaign": g("Campaign") or None,
            "disposed": bool(r["Disposed"]), "disposalDate": g("First Disposal Date"),
            "days": g("Days to Disposal"), "daysAtMinistry": g("Days at Ministry (reach->disposal)"),
            "pendingAge": g("Pending Age (days)"),
            "transfers": g("Manual Transfers (excl. auto)"), "hops": g("Total Transfers (hops)"),
            "misroutes": g("Misroutes (Not pertaining)"), "offices": g("Unique Offices Touched"),
            "reminders": g("Reminders from Complainant"), "interim": g("Interim Replies"),
            "path": g("Path"),
            "agree": g("Agree With Grievance"), "cause": g("Cause of Grievance"),
            "resolution": g("Resolution Type"),
            "replyType": g("Reply Type"), "replyLen": g("Reply Length"),
            "replyReuse": g("Reply Reuse Count"), "template": bool(r["Template Reply (>=5 identical)"]),
            "specifics": bool(r["Reply has specifics"]), "overlap": g("Reply-Grievance Word Overlap"),
            "quality": g("Reply Quality Score (0-5)"),
            "qualityBand": None if pd.isna(r["Reply Quality Band"]) else str(r["Reply Quality Band"]),
            "mismatch": bool(r["Claimed 'Fully Resolved' but deflected"]),
            "filings": g("Complainant Filing Count"),
            "description": g("Grievance Description"), "reply": g("Final Reply"),
            "replyFormat": g("Reply Format"), "replyFamily": g("Reply Family Size"),
            "sai": None if not bool(r["SAI Involved"]) else {
                "entry": clean(r["SAI Entry Date"]), "sender": g("Sent to SAI by"),
                "entryOffice": g("SAI Entry Office"), "handler": g("SAI Handling Office"),
                "dRecMin": g("Days: Receipt -> Ministry"), "dMinSai": g("Days: Ministry -> SAI"),
                "dRecSai": g("Days: Receipt -> SAI"), "dHq": g("Days: SAI HQ -> Division"),
                "dDiv": g("Days: Division working"), "dIn": g("Days inside SAI"),
                "dAfter": g("Days: After SAI -> Disposal"), "outcome": g("SAI Outcome"),
                "pending": bool(r["Pending inside SAI"]), "hops": g("SAI Internal Hops"),
                "offices": g("SAI Offices Touched"), "text": g("SAI Reply / Report Text"),
            },
            "steps": steps,
        })
    sa.write(df, names)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"generated": pd.Timestamp.today().strftime("%Y-%m-%d"), "asOf": ga.AS_OF, "redacted": False, "slaDays": ga.SLA_DAYS,
               "offices": names, "saiOffices": sorted(sa.SAI_OFFICES), "records": recs}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, default=str))
    print("wrote", OUT, len(recs), "records", round(OUT.stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
