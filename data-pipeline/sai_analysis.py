"""
SAI (Sports Authority of India) deep-dive.

Identifies every grievance that passed through SAI HQ (SPSAI) or any office SAI
HQ forwards to as a subordinate, then measures each stage of the journey:

  receipt -> reaches Ministry -> Ministry desk forwards to SAI -> SAI HQ passes to
  division -> division works -> (reply to citizen | report back to Ministry -> disposal)

Run:  python3 data-pipeline/sai_analysis.py      (also called by export_dashboard_data.py)
"""
import re
from pathlib import Path

import numpy as np
import pandas as pd

import grievance_analysis as ga

OUT_XLSX = ga.OUT_DIR / "SAI_Analysis_Output.xlsx"
REF = pd.Timestamp(ga.AS_OF)

SAI_HQ = "SPSAI"
# SAI HQ plus every office it forwards to as a subordinate (derived from the action trails)
SAI_OFFICES = {
    "SPSAI", "DIRTD", "TOPSD", "KHIND", "KHELO", "OPSDV", "RECUR", "COADV", "PERDV", "FITIN",
    "TAGG1", "INFDV", "STDDV", "ESDIV", "VGDVN", "RCBLR", "RCPAT", "RCSNP", "RCKOL", "RCCHD",
    "RCGDN", "RCLUK", "RCBHP", "RCTRI", "RCMUM", "LNCPE", "SPMSP", "IGS02", "JNS01", "MDCNS", "KSSR3",
}
SAI_GROUP = {  # how each SAI office is presented
    "SPSAI": "SAI HQ", "DIRTD": "Division", "TOPSD": "Division", "KHIND": "Division", "KHELO": "Division",
    "OPSDV": "Division", "RECUR": "Division", "COADV": "Division", "PERDV": "Division", "FITIN": "Division",
    "TAGG1": "Division", "INFDV": "Division", "STDDV": "Division", "ESDIV": "Division", "VGDVN": "Division",
    "SPMSP": "Stadium", "IGS02": "Stadium", "JNS01": "Stadium", "MDCNS": "Stadium", "KSSR3": "Stadium",
}


def journey(steps, receipt, disposed):
    """Return SAI journey dict for one grievance (None if it never reached SAI)."""
    into = [i for i, s in enumerate(steps) if s["to"] in SAI_OFFICES]
    acted = [i for i, s in enumerate(steps) if s["frm"] in SAI_OFFICES]
    if not into and not acted:
        return None
    if into and (not acted or into[0] < acted[0]):
        i0 = into[0]
        e = steps[i0]
    else:
        # the export sometimes drops the destination of the step that forwarded the case to SAI;
        # the first SAI action shows SAI had it, so the forwarding step is the one just before it
        i0 = max(0, acted[0] - 1)
        e = dict(steps[i0])
        e["to"] = steps[acted[0]]["frm"]
    reach_min = next((s["date"] for s in steps if s["to"] in ga.MINISTRY_CODES or s["frm"] in ga.MINISTRY_CODES), None)
    after = steps[i0:]
    # SAI HQ -> division hand-over
    hq_in = next((s["date"] for s in after if s["to"] == SAI_HQ), None)
    hq_out = next((s["date"] for s in after if s["frm"] == SAI_HQ and s["to"] in SAI_OFFICES and s["to"] != SAI_HQ), None)
    hq_lag = max(0, (hq_out - hq_in).days) if hq_in is not None and hq_out is not None and hq_out >= hq_in else 0
    handler = None
    for s in after:
        if s["to"] in SAI_OFFICES and s["to"] != SAI_HQ:
            handler = s["to"]
    exits = [s for s in after if s["frm"] in SAI_OFFICES and s["to"] not in SAI_OFFICES]
    disposed_by_sai = any(s["action"] in ga.DISPOSE and s["frm"] in SAI_OFFICES for s in after)
    last = steps[-1]
    pending_at_sai = (not disposed) and last["to"] in SAI_OFFICES
    ex = exits[-1] if exits else None
    if disposed_by_sai:
        exit_type = "Replied to citizen by SAI"
        sai_end = next(s["date"] for s in reversed(after) if s["action"] in ga.DISPOSE and s["frm"] in SAI_OFFICES)
    elif pending_at_sai:
        exit_type, sai_end = "Still pending inside SAI", REF
    elif ex is not None and ex["action"] == "NOT PERTAINING TO THIS ORGANISATION":
        exit_type, sai_end = "Returned: not pertaining to SAI", ex["date"]
    elif ex is not None:
        exit_type, sai_end = "Report sent back to Ministry", ex["date"]
    else:
        exit_type, sai_end = "Other", last["date"]
    disp = [s for s in steps if s["action"] in ga.DISPOSE]
    after_sai = None
    if not disposed_by_sai and disp and disp[-1]["date"] >= sai_end:
        after_sai = (disp[-1]["date"] - sai_end).days
    hops = sum(1 for s in after if s["to"] in SAI_OFFICES)
    sai_remark = ex["remarks"] if ex is not None else ""
    if disposed_by_sai:
        sai_remark = next(s["remarks"] for s in reversed(after) if s["action"] in ga.DISPOSE and s["frm"] in SAI_OFFICES)
    days_in = max(0, (sai_end - e["date"]).days)
    return {
        "SAI Involved": True,
        "SAI Entry Date": e["date"],
        "Sent to SAI by": e["frm"],
        "SAI Entry Office": e["to"],
        "SAI Handling Office": handler or SAI_HQ,
        "Days: Receipt -> Ministry": (reach_min - receipt).days if reach_min is not None and reach_min <= e["date"] else 0,
        "Days: Ministry -> SAI": max(0, (e["date"] - (reach_min if reach_min is not None and reach_min <= e["date"] else receipt)).days),
        "Days: Receipt -> SAI": max(0, (e["date"] - receipt).days),
        "Days: SAI HQ -> Division": hq_lag,
        "Days inside SAI": days_in,
        "Days: Division working": max(0, days_in - hq_lag),
        "Days: After SAI -> Disposal": after_sai,
        "SAI Outcome": exit_type,
        "Pending inside SAI": pending_at_sai,
        "SAI Internal Hops": hops,
        "SAI Offices Touched": " > ".join(dict.fromkeys(s["to"] for s in after if s["to"] in SAI_OFFICES)),
        "SAI Reply / Report Text": (sai_remark or "")[:1500],
    }


def enrich(df):
    raw = df["Action History"]
    rows = []
    for idx, h in raw.items():
        st = ga.parse_history(h)
        j = journey(st, df.at[idx, "Receipt Date"], bool(df.at[idx, "Disposed"])) if st else None
        rows.append(j or {"SAI Involved": False})
    j = pd.DataFrame(rows, index=df.index)
    for c in j.columns:
        df[c] = j[c]
    df["SAI Involved"] = df["SAI Involved"].fillna(False).astype(bool)
    return df


def tables(df, names):
    s = df[df["SAI Involved"]].copy()
    nm = lambda c: names.get(c, c)
    s["Handling Office"] = s["SAI Handling Office"].map(nm)
    s["Sent by"] = s["Sent to SAI by"].map(nm)
    d = s[s["Disposed"]]

    def grp(by):
        g = s.groupby(by, dropna=False)
        t = pd.DataFrame({
            "Cases": g.size(),
            "Median days Receipt->SAI": g["Days: Receipt -> SAI"].median(),
            "Median days inside SAI": g["Days inside SAI"].median(),
            "% handled in SAI within 21d": g["Days inside SAI"].apply(lambda x: round((x <= 21).mean() * 100, 1)),
            "Median end-to-end days": g["Days to Disposal"].median(),
            "Pending inside SAI": g["Pending inside SAI"].sum(),
            "Avg reply quality (0-5)": g["Reply Quality Score (0-5)"].mean().round(2),
            "% custom-written replies": g["Reply Format"].apply(lambda x: round((x == "Custom-written reply").mean() * 100, 1)),
        }).sort_values("Cases", ascending=False)
        return t.reset_index()

    stages = pd.DataFrame({
        "Stage": ["Citizen -> Ministry", "Ministry desk -> SAI", "SAI HQ -> Division", "Division working",
                  "After SAI -> Disposal (returned cases)"],
        "Median days": [s["Days: Receipt -> Ministry"].median(), s["Days: Ministry -> SAI"].median(),
                        s["Days: SAI HQ -> Division"].median(), s["Days: Division working"].median(),
                        s["Days: After SAI -> Disposal"].median()],
        "Mean days": [s["Days: Receipt -> Ministry"].mean(), s["Days: Ministry -> SAI"].mean(),
                      s["Days: SAI HQ -> Division"].mean(), s["Days: Division working"].mean(),
                      s["Days: After SAI -> Disposal"].mean()],
    }).round(1)
    nonsai = df[(~df["SAI Involved"]) & df["Disposed"]]
    head = pd.DataFrame([
        ("Grievances that reached SAI", len(s)),
        ("% of all grievances", round(len(s) / len(df) * 100, 1)),
        ("Disposed / pending", f"{int(s['Disposed'].sum())} / {int((~s['Disposed']).sum())}"),
        ("Pending inside SAI now", int(s["Pending inside SAI"].sum())),
        ("Median days receipt -> SAI", s["Days: Receipt -> SAI"].median()),
        ("Median days inside SAI", s["Days inside SAI"].median()),
        ("% handled inside SAI within 21 days", round((s["Days inside SAI"] <= 21).mean() * 100, 1)),
        ("Median end-to-end days (SAI cases)", d["Days to Disposal"].median()),
        ("Median end-to-end days (non-SAI cases)", nonsai["Days to Disposal"].median()),
        ("% disposed within 21 days (SAI cases)", round((d["Days to Disposal"] <= 21).mean() * 100, 1)),
        ("% disposed within 21 days (non-SAI cases)", round((nonsai["Days to Disposal"] <= 21).mean() * 100, 1)),
        ("% good replies (SAI cases)", round((d["Reply Quality Band"] == "Good").mean() * 100, 1)),
        ("% good replies (non-SAI cases)", round((nonsai["Reply Quality Band"] == "Good").mean() * 100, 1)),
        ("% custom-written replies (SAI cases)", round((d["Reply Format"] == "Custom-written reply").mean() * 100, 1)),
        ("% custom-written replies (non-SAI cases)", round((nonsai["Reply Format"] == "Custom-written reply").mean() * 100, 1)),
    ], columns=["Metric", "Value"])
    cols = ["Registration Number", "Receipt Date", "Campaign", "Theme (keyword)", "CPGRAMS Category L1",
            "CPGRAMS Category L2", "Sent by", "SAI Entry Date", "Handling Office", "SAI Offices Touched",
            "Days: Receipt -> Ministry", "Days: Ministry -> SAI", "Days: SAI HQ -> Division", "Days: Division working",
            "Days inside SAI", "Days: After SAI -> Disposal", "Days to Disposal", "SAI Outcome", "Disposed",
            "Pending inside SAI", "Closing Organisation", "Reply Type", "Reply Format", "Reply Quality Score (0-5)",
            "Reply Quality Band", "SAI Reply / Report Text", "Final Reply"]
    pend = s[s["Pending inside SAI"]].assign(**{"Age (days)": lambda x: (REF - x["Receipt Date"]).dt.days})
    return {
        "SAI Headline": head,
        "SAI Journey Stages": stages,
        "SAI By Handling Office": grp("Handling Office"),
        "SAI By Sending Desk": grp("Sent by"),
        "SAI By Theme": grp("Theme (keyword)"),
        "SAI Work Sub-categories": (s[s["CPGRAMS Category L2"].fillna("") != ""].groupby(
            ["CPGRAMS Category L1", "CPGRAMS Category L2"]).size().sort_values(ascending=False)
            .reset_index(name="Cases")),
        "SAI Outcomes": s["SAI Outcome"].value_counts().rename_axis("Outcome").reset_index(name="Cases"),
        "SAI Reply Types": d.groupby("Reply Type").agg(Cases=("Registration Number", "size"),
                                                       AvgQuality=("Reply Quality Score (0-5)", "mean"),
                                                       MedianDays=("Days to Disposal", "median"))
                           .sort_values("Cases", ascending=False).round(2).reset_index(),
        "SAI Reply Format": d["Reply Format"].value_counts().rename_axis("Format").reset_index(name="Cases"),
        "SAI Top Reused Replies": (d["Final Reply"].str.strip().value_counts().loc[lambda x: x >= 2]
                                   .rename_axis("Reply text").reset_index(name="Times used")),
        "SAI Pending Inside": pend[["Registration Number", "Receipt Date", "Age (days)", "Handling Office",
                                    "Theme (keyword)", "SAI Offices Touched"]].sort_values("Age (days)", ascending=False),
        "SAI Cases": s[cols].sort_values("Receipt Date"),
    }


def write(df, names):
    t = tables(df, names)
    with pd.ExcelWriter(OUT_XLSX, engine="openpyxl") as xw:
        for k, v in t.items():
            v.to_excel(xw, sheet_name=k[:31], index=False)
    from openpyxl import load_workbook
    wb = load_workbook(OUT_XLSX)
    for ws in wb.worksheets:
        ws.freeze_panes = "A2"
        for col in ws.columns:
            w = max(len(str(c.value)) if c.value is not None else 0 for c in list(col)[:200])
            ws.column_dimensions[col[0].column_letter].width = min(max(10, w + 2), 60)
    wb.save(OUT_XLSX)
    return t


def office_names(df):
    names = {"C1TZN": "Complainant"}
    for h in df["Action History"].dropna():
        for m in re.finditer(r"([A-Za-z][^\n]*?) - \(([A-Z0-9 ]{2,8})\)", h):
            nm = re.sub(r"^.*?\d{2}/\d{2}/\d{4}\s+", "", m.group(1)).strip()
            nm = re.sub(r"^.*\) ", "", nm)
            names.setdefault(m.group(2).strip(), nm)
    return names


if __name__ == "__main__":
    df, _ = ga.main()
    df = enrich(df)
    t = write(df, office_names(df))
    print(t["SAI Headline"].to_string(index=False))
    print(t["SAI Journey Stages"].to_string(index=False))
