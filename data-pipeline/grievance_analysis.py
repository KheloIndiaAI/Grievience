"""
CPGRAMS Grievance Analysis - Ministry of Youth Affairs & Sports
----------------------------------------------------------------
Parses the CPGRAMS export, reconstructs each grievance's movement trail from
the "Action History" column, and derives:
  * number of transfers / hops / misroutes before disposal
  * days taken for disposal (overall, and after reaching the Ministry)
  * dwell time per office (bottleneck analysis)
  * submission patterns (month, weekday, channel, source portal)
  * nature of grievances (CPGRAMS category + keyword-based theme)
  * quality of final replies (reply type, template reuse, specificity, score)
Outputs an enriched Excel workbook + JSON of headline stats.

Run:  CPGRAMS_XLSX=/path/to/export.xlsx python3 data-pipeline/grievance_analysis.py
"""
import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
# Inputs and outputs contain personal data: both live outside git (private/ is git-ignored).
SRC = Path(os.environ.get("CPGRAMS_XLSX", ROOT / "private" / "CPGRAMS_export.xlsx"))
OUT_DIR = Path(os.environ.get("PIPELINE_OUT", ROOT / "private"))
OUT_XLSX = OUT_DIR / "Grievance_Analysis_Output.xlsx"
OUT_JSON = OUT_DIR / "summary_stats.json"
# status date of the export (pending ages and idle days are measured to this day)
AS_OF = os.environ.get("AS_OF", "2026-10-21")

SLA_DAYS = 21  # current CPGRAMS norm (DARPG guidelines, Aug-2024); 30 earlier

ACTIONS = [
    "TRANSFERRED TO SUBORDINATE ORGANISATION", "RECEIVED THE GRIEVANCE",
    "CASE DISPOSED OF", "NOT PERTAINING TO THIS ORGANISATION",
    "REDIRECTED TO OTHER ORGANISATION", "TRANSFER TO OTHER ORGANISATION",
    "TAKEN UP WITH SUBORDINATE ORGANISATION",
    "CASE REPORT SENT AND DISPOSED LOCALLY", "REMINDER RECEIVED FROM COMPLAINANT",
    "EXAMINED AT OUR LEVEL", "CASE TRANSFERRED BY NODAL AGENCY",
    "INTERIM REPLY TO COMPLAINANT", "NO ACTION REQUIRED",
    "MODIFY FINAL REPLY (CASE DISPOSED OF)",
]
FORWARD = {"TRANSFERRED TO SUBORDINATE ORGANISATION", "REDIRECTED TO OTHER ORGANISATION",
           "TRANSFER TO OTHER ORGANISATION", "TAKEN UP WITH SUBORDINATE ORGANISATION",
           "CASE TRANSFERRED BY NODAL AGENCY"}
RETURN = {"NOT PERTAINING TO THIS ORGANISATION", "CASE REPORT SENT AND DISPOSED LOCALLY"}
DISPOSE = {"CASE DISPOSED OF", "MODIFY FINAL REPLY (CASE DISPOSED OF)", "NO ACTION REQUIRED"}
MINISTRY_CODES = {"DSPRT", "MOYAS"}

act_alt = "|".join(re.escape(a) for a in sorted(ACTIONS, key=len, reverse=True))
STEP_RE = re.compile(rf"(?m)^(\d+)\s+({act_alt})\s+(\d{{2}}/\d{{2}}/\d{{4}})\s*(.*)")
CODE_RE = re.compile(r" - \(([A-Z0-9 ]{2,8})\)")


def parse_history(text):
    """Return list of steps: dict(n, action, date, frm, to, remarks)."""
    if not isinstance(text, str):
        return []
    text = text.replace("Print Close", "")
    matches = list(STEP_RE.finditer(text))
    steps = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.start(4):end].strip()
        codes = list(CODE_RE.finditer(body))
        frm = codes[0].group(1).strip() if len(codes) > 0 else None
        to = codes[1].group(1).strip() if len(codes) > 1 else None
        remarks = body[codes[1].end():].strip() if len(codes) > 1 else ""
        steps.append(dict(n=int(m.group(1)), action=m.group(2),
                          date=pd.to_datetime(m.group(3), dayfirst=True),
                          frm=frm, to=to, remarks=remarks))
    return steps


# ----------------------------------------------------------------- themes
THEMES = [  # (theme, regex) - first match wins; ordered from specific to general
    ("Corruption / Harassment / Vigilance", r"corrupt|bribe|harass|vigilance|misbehav|fraud|scam|embezzl|misappropriat|illegal|unethical|extort|भ्रष्टाचार|घूस"),
    ("Doping (NADA/WADA)", r"doping|\bnada\b|wada|dope"),
    ("Selection / Trials / Team management", r"selection|selected|trial|team management|manager for|coach.*appoint|appoint.*coach|squad|not selected|chayan|चयन"),
    ("Sports Federation governance / recognition", r"federation|association|\bnsf\b|aiff|bcci|unrecogni|recogni[sz]ed body|olympic association|\bioa\b|election|sports code|nsdci"),
    ("Awards / Cash incentives / Pension to sportspersons", r"award|arjuna|khel ratna|dronacharya|padma|cash incentive|prize money|pension.*sportsperson|welfare fund|deendayal|पुरस्कार"),
    ("Financial assistance / Scholarship / Funding", r"financial (assistance|support|help)|scholarship|grant|fund|sponsor|nsdf|stipend|aarthik|आर्थिक|सहायता"),
    ("Jobs / Sports quota / Recruitment", r"job|employment|recruit|sports quota|naukri|vacanc|appointment as|rozgar|नौकरी|रोजगार"),
    ("Certificates / Verification", r"certificate|verification|प्रमाण"),
    ("SAI centres / Infrastructure / Stadium / Hostel", r"stadium|hostel|infrastructure|ground|playground|\bstc\b|training cent|sai cent|swimming pool|academy|facility|construction|maidan|मैदान|स्टेडियम"),
    ("Khelo India / Fit India schemes", r"khelo india|fit india|khelo|kheloindia"),
    ("Employee service matters (SAI/LNIPE/Ministry staff)", r"salary|promotion|pension|contract|outsourc|employee|staff|transfer posting|regulari[sz]|arrear|lnipe|establishment"),
    ("Youth affairs (NSS / NYKS / My Bharat / Volunteers)", r"\bnss\b|nyks|nehru yuva|my bharat|mybharat|volunteer|youth policy|yuva|youth club|youth parliament"),
    ("Para / Divyang sports", r"\bpara\b|divyang|disab|paralympic|handicap"),
    ("Suggestions / Policy ideas / Sports promotion", r"suggest|request the government|promote|promotion of|improve|roadmap|policy|ban|olympic|world cup|medal|sport.*development"),
]
THEME_RES = [(t, re.compile(p, re.I)) for t, p in THEMES]


def theme_of(text):
    if not isinstance(text, str) or len(text.strip()) < 5:
        return "Insufficient text (scanned / blank)"
    t = text.lower()
    if re.fullmatch(r"\s*\S{0,40}\s*additional information not provided\s*", t) or \
            "petition not fully scanned" in t:
        return "Insufficient text (scanned / blank)"
    for name, rx in THEME_RES:
        if rx.search(t):
            return name
    return "Other / Unclassified"


def language_of(text):
    if not isinstance(text, str):
        return "Unknown"
    scripts = {
        "Hindi/Devanagari": r"[\u0900-\u097F]", "Telugu": r"[\u0C00-\u0C7F]",
        "Tamil": r"[\u0B80-\u0BFF]", "Bengali": r"[\u0980-\u09FF]",
        "Kannada": r"[\u0C80-\u0CFF]", "Malayalam": r"[\u0D00-\u0D7F]",
        "Gujarati": r"[\u0A80-\u0AFF]", "Gurmukhi": r"[\u0A00-\u0A7F]",
        "Odia": r"[\u0B00-\u0B7F]",
    }
    counts = {k: len(re.findall(v, text)) for k, v in scripts.items()}
    k, v = max(counts.items(), key=lambda kv: kv[1])
    latin = len(re.findall(r"[A-Za-z]", text))
    return k if v > latin * 0.5 and v > 20 else "English"


# ----------------------------------------------------------------- replies
REPLY_TYPES = [
    ("Attachment only (no text)", r"^\W*(please\s+)?(find|see|refer)?.{0,25}(attach|enclos|copy attached|annexed)|^\W*copy attached\W*$|^\W*attached\W*$"),
    ("Duplicate / cross-referenced", r"same as [A-Z]{4,6}/|already (been )?(replied|disposed|addressed)|duplicate|similar grievance"),
    ("Deflection: State subject", r"state subject|राज्य का विषय|राज्य विषय|pertains to the state government"),
    ("Deflection: NSF / autonomous body", r"recognises national sports federations|autonomous|nsf takes all decision|federation is (an )?autonomous|recognized any federation|not recognised|apex body|bcci"),
    ("Not pertaining / Not a grievance", r"not pertain|not related to this|does not pertain|not a grievance|no grievance|suggestion|noted with thanks|not under the purview|outside the purview|not within"),
    ("Seeking more information", r"provide (the )?(documentary|details|more|complete|additional)|information not provided|incomplete|insufficient|kindly provide|please provide|not clear"),
    ("Forwarded / under process", r"forwarded|under (process|consideration|examination)|being examined|taken up with|will be (considered|examined|looked)|necessary action|sent to"),
]
REPLY_RES = [(t, re.compile(p, re.I)) for t, p in REPLY_TYPES]
STOP = set("""the a an and or of to in for on at by with is are was were be been this that it as from
your you we our i my me sir madam dear kindly please has have had not no which who will shall may can
under above said its their they he she his her them any all such being also into upon regarding""".split())


def reply_type(text):
    if not isinstance(text, str) or not text.strip():
        return "No reply (pending)"
    t = text.strip()
    if len(t) < 15:
        return "Attachment only (no text)" if re.search(r"attach|copy|enclos", t, re.I) else "Very short / non-informative"
    for name, rx in REPLY_RES:
        if name.startswith("Attachment") and len(t) > 120:
            continue
        if rx.search(t):
            return name
    return "Substantive / action-taken reply"


def words(t):
    return {w for w in re.findall(r"[a-z]{3,}", str(t).lower()) if w not in STOP}


def main():
    df = pd.read_excel(SRC)
    df["Receipt Date"] = pd.to_datetime(df["Date of Receipt"], dayfirst=True)
    reg = df["Registration Number"].str.split("/")
    df["Source Org Code"] = reg.str[0]
    df["Channel Code"] = reg.str[1]
    channel_map = {"E": "Online (E)", "D": "Dak / physical letter (D)", "I": "Code I",
                   "C": "Code C (CSC/Call centre)", "P": "Code P"}
    df["Channel"] = df["Channel Code"].map(channel_map).fillna("Other")
    src_map = {"DSPRT": "Direct - Dept of Sports", "MOYAS": "Direct - Dept of Youth Affairs",
               "PMOPG": "PMO (PM's Office)", "PRSEC": "President's Secretariat",
               "DARPG": "DARPG / DPG (Cab Sectt)"}
    df["Source Portal"] = df["Source Org Code"].map(src_map).fillna("Other Ministries (redirected in)")

    # ---------------- movement trail
    recs, dwell = [], defaultdict(list)
    ref_date = None
    all_steps = {}
    for idx, h in df["Action History"].items():
        st = parse_history(h)
        all_steps[idx] = st
        if st:
            md = max(s["date"] for s in st)
            ref_date = md if ref_date is None or md > ref_date else ref_date
    for idx, st in all_steps.items():
        r = {}
        acts = [s["action"] for s in st]
        r["Total Steps"] = len(st)
        r["Forward Moves"] = sum(a in FORWARD for a in acts)
        r["Return Moves (Not pertaining / report back)"] = sum(a in RETURN for a in acts)
        r["Misroutes (Not pertaining)"] = acts.count("NOT PERTAINING TO THIS ORGANISATION")
        auto = sum(1 for s in st if s["action"] in FORWARD and "auto forwarded" in s["remarks"].lower())
        r["Auto-forwards"] = auto
        r["Total Transfers (hops)"] = r["Forward Moves"] + r["Return Moves (Not pertaining / report back)"]
        r["Manual Transfers (excl. auto)"] = r["Total Transfers (hops)"] - auto
        orgs = [o for s in st for o in (s["frm"], s["to"]) if o and o != "C1TZN"]
        r["Unique Offices Touched"] = len(set(orgs))
        r["Reminders from Complainant"] = acts.count("REMINDER RECEIVED FROM COMPLAINANT")
        r["Interim Replies"] = acts.count("INTERIM REPLY TO COMPLAINANT")
        r["Inter-Ministry Redirects"] = sum(a in ("REDIRECTED TO OTHER ORGANISATION", "TRANSFER TO OTHER ORGANISATION",
                                                  "CASE TRANSFERRED BY NODAL AGENCY") for a in acts)
        disp = [s for s in st if s["action"] in DISPOSE]
        r["Disposed"] = bool(disp)
        r["First Disposal Date"] = disp[0]["date"] if disp else pd.NaT
        r["Last Disposal Date"] = disp[-1]["date"] if disp else pd.NaT
        r["Disposal Count"] = len(disp)
        r["Disposing Officer Remark"] = disp[-1]["remarks"][:300] if disp else ""
        reach = [s["date"] for s in st if s["to"] in MINISTRY_CODES or s["frm"] in MINISTRY_CODES]
        r["Date Reached Ministry"] = min(reach) if reach else pd.NaT
        r["Last Action Date"] = st[-1]["date"] if st else pd.NaT
        r["Path"] = " > ".join([st[0]["frm"] or "?"] + [s["to"] or "?" for s in st]) if st else ""
        recs.append(r)
        # dwell: interval preceding each action is attributed to the office that acted (frm)
        for a, b in zip(st, st[1:]):
            if b["frm"] and b["frm"] != "C1TZN":
                dwell[b["frm"]].append((b["date"] - a["date"]).days)
    mv = pd.DataFrame(recs, index=df.index)
    df = pd.concat([df, mv], axis=1)

    df["Days to Disposal"] = (df["First Disposal Date"] - df["Receipt Date"]).dt.days
    df["Days at Ministry (reach->disposal)"] = (df["First Disposal Date"] - df["Date Reached Ministry"]).dt.days
    df["Days before reaching Ministry"] = (df["Date Reached Ministry"] - df["Receipt Date"]).dt.days
    df["Pending Age (days)"] = np.where(~df["Disposed"], (ref_date - df["Receipt Date"]).dt.days, np.nan)
    df["Within SLA (21d)"] = np.where(df["Disposed"], df["Days to Disposal"] <= SLA_DAYS, np.nan)
    bins = [-1, 7, 15, 21, 30, 60, 90, 180, 10000]
    labels = ["0-7", "8-15", "16-21", "22-30", "31-60", "61-90", "91-180", ">180"]
    df["Disposal Bucket"] = pd.cut(df["Days to Disposal"], bins=bins, labels=labels)
    df["Pending Bucket"] = pd.cut(df["Pending Age (days)"], bins=bins, labels=labels)
    df["Transfer Bucket"] = pd.cut(df["Manual Transfers (excl. auto)"], [-1, 0, 1, 2, 3, 5, 100],
                                   labels=["0", "1", "2", "3", "4-5", "6+"])

    # normalise State names (Hindi-script / case variants)
    hi = {"उत्तर प्रदेश": "Uttar Pradesh", "उत्तराखंड": "Uttarakhand", "कर्नाटक": "Karnataka", "गुजरात": "Gujarat",
          "गोआ": "Goa", "छत्तीसगढ़": "Chhattisgarh", "झारखंड": "Jharkhand", "तमिलनाडू": "Tamil Nadu",
          "दिल्ली": "Delhi", "पंजाब": "Punjab", "बिहार": "Bihar", "मध्य प्रदेश": "Madhya Pradesh",
          "महाराष्ट्र": "Maharashtra", "राजस्थान": "Rajasthan", "हरियाणा": "Haryana", "अज्ञात": "Not Known",
          "Tamil nadu": "Tamil Nadu", "Keralam": "Kerala", "Not Provided": "Not Known"}
    df["State"] = df["State"].replace(hi).fillna("Not Known")

    # organised campaigns (mass / coordinated filings)
    low = df["Grievance Description"].fillna("").str.lower()
    df["Campaign"] = np.select(
        [low.str.contains(r"ranjit bajaj|bajaj|u-15|u15|under-15|under 15") & low.str.contains("football|aiff|coach|u-15"),
         low.str.contains("kurnool") | df["Final Reply"].fillna("").str.contains("STC Kurnool")],
        ["AIFF U-15 coach (Ranjit Bajaj) campaign", "STC Kurnool hostel/relocation"], default="")

    # ---------------- submission timing
    df["Month"] = df["Receipt Date"].dt.to_period("M").astype(str)
    df["Weekday"] = df["Receipt Date"].dt.day_name()
    df["Day of Month"] = df["Receipt Date"].dt.day
    df["ISO Week"] = df["Receipt Date"].dt.isocalendar().week

    # ---------------- nature
    first = df["Grievance Description"].fillna("").str.split("\n").str[0]
    cat = first.apply(lambda s: [x.strip() for x in s.split(">>")] if ">>" in s else [])
    df["CPGRAMS Category L1"] = cat.apply(lambda x: x[1] if len(x) > 1 else "(Not categorised)")
    df["CPGRAMS Category L2"] = cat.apply(lambda x: x[2] if len(x) > 2 else "")
    df["Theme (keyword)"] = df["Grievance Description"].apply(theme_of)
    # campaign petitions are often scanned/blank but their subject is known from the campaign itself
    df.loc[df["Campaign"] == "STC Kurnool hostel/relocation", "Theme (keyword)"] = \
        "SAI centres / Infrastructure / Stadium / Hostel"
    df.loc[df["Campaign"] == "AIFF U-15 coach (Ranjit Bajaj) campaign", "Theme (keyword)"] = \
        "Selection / Trials / Team management"
    df["Language"] = df["Grievance Description"].apply(language_of)
    df["Desc Length"] = df["Grievance Description"].fillna("").str.len()

    # repeat complainants & campaigns
    mob = df["Mobile"].map(df["Mobile"].value_counts())
    df["Complainant Filing Count"] = mob.fillna(1).astype(int)
    body = df["Grievance Description"].fillna("").str.split("\n").str[1:].str.join(" ").str.strip().str[:250]
    bc = body.map(body.value_counts())
    df["Near-identical Grievances"] = np.where(body.str.len() > 60, bc, 1)

    # ---------------- reply quality
    fr = df["Final Reply"].fillna("").str.replace("Print Close", "").str.strip()
    df["Final Reply"] = fr.replace("", np.nan)
    df["Reply Type"] = df["Final Reply"].apply(reply_type)
    df["Reply Length"] = fr.str.len()
    reuse = fr.map(fr[fr != ""].value_counts()).fillna(0).astype(int)
    df["Reply Reuse Count"] = reuse
    df["Template Reply (>=5 identical)"] = reuse >= 5
    # near-identical replies: same text once numbers, dates, reg. numbers and State names are masked
    fam = fr.str.lower()
    fam = fam.str.replace(r"[a-z]{4,6}/[a-z]/\d{4}/\d+", " ", regex=True)
    fam = fam.str.replace(r"state government of [a-z &]+?(,|\.| therefore)", r"state government of X\1", regex=True)
    fam = fam.str.replace(r"\d+", "#", regex=True).str.replace(r"[^a-z#]+", " ", regex=True).str.strip()
    fam = fam.str[:160]
    fam_n = fam.map(fam[fam != ""].value_counts()).fillna(0).astype(int)
    df["Reply Family Size"] = fam_n
    df["Reply Format"] = np.select(
        [fr == "",
         df["Reply Type"].isin(["Attachment only (no text)", "Very short / non-informative"]),
         reuse >= 5, fam_n >= 5],
        ["No reply (pending)", "No usable text (attachment / '.')", "Standard template (identical text)",
         "Standard template (lightly edited)"], default="Custom-written reply")
    df["Reply has specifics"] = fr.str.contains(r"\d{2,}|Rs\.?|₹|lakh|crore|dated|letter no|order no|sanction|released|appointed|meeting", case=False)
    df["Reply-Grievance Word Overlap"] = [
        round(len(words(g) & words(rp)) / max(1, len(words(rp))), 2) if rp else np.nan
        for g, rp in zip(df["Grievance Description"], fr)]

    def score(row):
        if row["Reply Type"] == "No reply (pending)":
            return np.nan
        s = 0
        s += 1 if row["Reply Length"] >= 150 else 0
        s += 1 if row["Reply Length"] >= 400 else 0
        s += 1 if not row["Template Reply (>=5 identical)"] else 0
        s += 1 if row["Reply has specifics"] else 0
        s += 1 if row["Reply Type"] in ("Substantive / action-taken reply",) else 0
        s += 0.5 if row["Reply Type"] in ("Forwarded / under process", "Seeking more information",
                                          "Deflection: NSF / autonomous body") else 0
        s += 1 if (row["Reply-Grievance Word Overlap"] or 0) >= 0.3 else 0
        if row["Reply Type"] in ("Attachment only (no text)", "Very short / non-informative",
                                 "Duplicate / cross-referenced"):
            s = min(s, 1)
        return min(s, 5)
    df["Reply Quality Score (0-5)"] = df.apply(score, axis=1)
    df["Reply Quality Band"] = pd.cut(df["Reply Quality Score (0-5)"], [-0.1, 1.5, 3, 5],
                                      labels=["Poor", "Fair", "Good"])
    df["Claimed 'Fully Resolved' but deflected"] = (df["Resolution Type"] == "Fully Resolved") & \
        df["Reply Type"].str.startswith(("Deflection", "Not pertaining", "Attachment", "Very short", "Duplicate"))

    # ================================================================ summaries
    D = df[df["Disposed"]]
    S = {}
    S["ref_date"] = str(ref_date.date())
    S["total"] = len(df)
    S["receipt_range"] = [str(df["Receipt Date"].min().date()), str(df["Receipt Date"].max().date())]
    S["disposed"] = int(df["Disposed"].sum())
    S["pending"] = int((~df["Disposed"]).sum())
    dd = D["Days to Disposal"]
    S["days"] = dict(mean=round(dd.mean(), 1), median=float(dd.median()), p75=float(dd.quantile(.75)),
                     p90=float(dd.quantile(.9)), max=int(dd.max()),
                     within_sla_pct=round((dd <= SLA_DAYS).mean() * 100, 1),
                     within_30_pct=round((dd <= 30).mean() * 100, 1))
    dm = D["Days at Ministry (reach->disposal)"].dropna()
    S["days_at_ministry"] = dict(mean=round(dm.mean(), 1), median=float(dm.median()))
    bm = D["Days before reaching Ministry"].dropna()
    S["days_before_ministry"] = dict(mean=round(bm.mean(), 1), median=float(bm.median()))
    mt = df["Manual Transfers (excl. auto)"]
    S["transfers"] = dict(mean_total=round(df["Total Transfers (hops)"].mean(), 2),
                          mean_manual=round(mt.mean(), 2), median_manual=float(mt.median()),
                          max_manual=int(mt.max()),
                          pct_with_misroute=round((df["Misroutes (Not pertaining)"] > 0).mean() * 100, 1),
                          mean_offices=round(df["Unique Offices Touched"].mean(), 2))
    S["pending_age"] = df["Pending Age (days)"].describe().round(1).to_dict()
    S["reminders_pct"] = round((df["Reminders from Complainant"] > 0).mean() * 100, 1)
    S["template_pct"] = round(D["Template Reply (>=5 identical)"].mean() * 100, 1)
    S["claimed_fully_but_deflected"] = int(df["Claimed 'Fully Resolved' but deflected"].sum())
    nc = D[D["Campaign"] == ""]["Days to Disposal"]
    S["days_excl_campaigns"] = dict(median=float(nc.median()), mean=round(nc.mean(), 1),
                                    within_sla_pct=round((nc <= SLA_DAYS).mean() * 100, 1))
    S["campaign_counts"] = df["Campaign"].value_counts().to_dict()
    S["repeat_complainants"] = int((df["Mobile"].value_counts() > 1).sum())
    S["grievances_from_repeaters"] = int((df["Complainant Filing Count"] > 1).sum())

    def vc(s, name):
        t = s.value_counts(dropna=False).rename_axis(name).reset_index(name="Count")
        t["%"] = (t["Count"] / t["Count"].sum() * 100).round(1)
        return t

    def grp(by):
        g = df.groupby(by, dropna=False, observed=True)
        t = pd.DataFrame({
            "Grievances": g.size(),
            "Disposed": g["Disposed"].sum(),
            "Pending": g["Disposed"].apply(lambda x: (~x).sum()),
            "Median Days": g["Days to Disposal"].median(),
            "Mean Days": g["Days to Disposal"].mean().round(1),
            "% within 21d": g["Within SLA (21d)"].apply(lambda x: round(pd.to_numeric(x).mean() * 100, 1)),
            "Avg Manual Transfers": g["Manual Transfers (excl. auto)"].mean().round(2),
            "% Misrouted": g["Misroutes (Not pertaining)"].apply(lambda x: round((x > 0).mean() * 100, 1)),
            "Avg Reply Quality": g["Reply Quality Score (0-5)"].mean().round(2),
            "% Template Replies": g["Template Reply (>=5 identical)"].apply(lambda x: round(x.mean() * 100, 1)),
        }).sort_values("Grievances", ascending=False)
        return t.reset_index()

    tables = {
        "By Closing Division": grp("Closing Organisation"),
        "By Theme": grp("Theme (keyword)"),
        "By CPGRAMS Category": grp("CPGRAMS Category L1"),
        "By Source Portal": grp("Source Portal"),
        "By Channel": grp("Channel"),
        "By Month": grp("Month").sort_values("Month"),
        "By Transfers": grp("Transfer Bucket").sort_values("Transfer Bucket"),
        "By Reply Type": grp("Reply Type"),
        "By State": grp("State"),
        "By Language": grp("Language"),
        "By Campaign": grp("Campaign"),
        "Daily Receipts": df.groupby(df["Receipt Date"].dt.date).size().rename("Count").reset_index(),
    }
    wd = vc(df["Weekday"], "Weekday")
    wd["order"] = wd["Weekday"].map({d: i for i, d in enumerate(
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])})
    tables["By Weekday"] = wd.sort_values("order").drop(columns="order")
    tables["Disposal Buckets"] = vc(D["Disposal Bucket"], "Days").sort_values("Days")
    tables["Pending Ageing"] = vc(df.loc[~df["Disposed"], "Pending Bucket"], "Age (days)").sort_values("Age (days)")
    tables["Transfer Distribution"] = vc(df["Manual Transfers (excl. auto)"], "Manual transfers").sort_values("Manual transfers")
    tables["Cause x Resolution"] = pd.crosstab(df["Cause of Grievance"].fillna("(blank)"),
                                               df["Resolution Type"].fillna("(blank)"), margins=True).reset_index()
    tables["ReplyType x Resolution"] = pd.crosstab(df["Reply Type"], df["Resolution Type"].fillna("(blank)"),
                                                   margins=True).reset_index()
    tables["Quality Band"] = vc(D["Reply Quality Band"], "Band")
    tables["Top Template Replies"] = (fr[fr != ""].value_counts().head(25)
                                      .rename_axis("Reply text").reset_index(name="Times used"))
    names = {}
    for h in df["Action History"].dropna():
        for m in re.finditer(r"([A-Za-z][^\n]*?) - \(([A-Z0-9 ]{2,8})\)", h):
            nm = re.sub(r"^.*?\d{2}/\d{2}/\d{4}\s+", "", m.group(1)).strip()
            nm = re.sub(r"^.*\) ", "", nm)
            names.setdefault(m.group(2).strip(), nm)
    dw = pd.DataFrame([(k, names.get(k, ""), len(v), np.median(v), np.mean(v), np.sum(v)) for k, v in dwell.items()],
                      columns=["Office code", "Office name", "Actions", "Median dwell (days)", "Mean dwell (days)", "Total days held"])
    tables["Office Dwell (bottlenecks)"] = dw.sort_values("Total days held", ascending=False).round(1)
    tables["Top Paths"] = df["Path"].value_counts().head(30).rename_axis("Movement path").reset_index(name="Count")
    tables["Campaigns (near-identical)"] = (body[(body.str.len() > 60)].value_counts().loc[lambda s: s >= 3]
                                            .rename_axis("Grievance text (first 250 chars)").reset_index(name="Count"))
    tables["L2 Sub-categories"] = (df[df["CPGRAMS Category L2"] != ""]
                                   .groupby(["CPGRAMS Category L1", "CPGRAMS Category L2"]).size()
                                   .sort_values(ascending=False).head(40).reset_index(name="Count"))
    tables["Long Pending (>60d)"] = df.loc[(~df["Disposed"]) & (df["Pending Age (days)"] > 60),
                                           ["Registration Number", "Receipt Date", "Pending Age (days)",
                                            "Theme (keyword)", "Path", "Manual Transfers (excl. auto)"]
                                           ].sort_values("Pending Age (days)", ascending=False)
    tables["Slowest Disposals"] = D.nlargest(30, "Days to Disposal")[
        ["Registration Number", "Receipt Date", "First Disposal Date", "Days to Disposal",
         "Manual Transfers (excl. auto)", "Closing Organisation", "Reply Type", "Path"]]
    corr = D[["Days to Disposal", "Manual Transfers (excl. auto)", "Misroutes (Not pertaining)",
              "Unique Offices Touched", "Reminders from Complainant", "Reply Quality Score (0-5)"]].corr(method="spearman").round(2)
    tables["Correlations (Spearman)"] = corr.reset_index()

    # ---------------- write
    detail_cols = ["Registration Number", "Receipt Date", "State", "District", "Source Portal", "Channel",
                   "Month", "Weekday", "CPGRAMS Category L1", "CPGRAMS Category L2", "Theme (keyword)",
                   "Language", "Grievance Received By", "Closing Organisation", "Disposed",
                   "First Disposal Date", "Days to Disposal", "Days before reaching Ministry",
                   "Days at Ministry (reach->disposal)", "Within SLA (21d)", "Pending Age (days)",
                   "Total Steps", "Total Transfers (hops)", "Manual Transfers (excl. auto)",
                   "Misroutes (Not pertaining)", "Inter-Ministry Redirects", "Unique Offices Touched",
                   "Reminders from Complainant", "Interim Replies", "Path", "Agree With Grievance",
                   "Cause of Grievance", "Resolution Type", "Reply Type", "Reply Length",
                   "Reply Reuse Count", "Template Reply (>=5 identical)", "Reply Family Size", "Reply Format", "Reply has specifics",
                   "Reply-Grievance Word Overlap", "Reply Quality Score (0-5)", "Reply Quality Band",
                   "Claimed 'Fully Resolved' but deflected", "Complainant Filing Count",
                   "Near-identical Grievances", "Campaign", "Final Reply"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(OUT_XLSX, engine="openpyxl") as xw:
        pd.DataFrame([(k, json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in S.items()],
                     columns=["Metric", "Value"]).to_excel(xw, sheet_name="Headline", index=False)
        df[detail_cols].to_excel(xw, sheet_name="Grievance Detail", index=False)
        for name, t in tables.items():
            t.to_excel(xw, sheet_name=name[:31], index=False)
    # autosize-ish
    from openpyxl import load_workbook
    wb = load_workbook(OUT_XLSX)
    for ws in wb.worksheets:
        ws.freeze_panes = "A2"
        for col in ws.columns:
            w = max(len(str(c.value)) if c.value is not None else 0 for c in list(col)[:200])
            ws.column_dimensions[col[0].column_letter].width = min(max(10, w + 2), 60)
    wb.save(OUT_XLSX)

    S["tables"] = {k: v.head(40).to_dict(orient="records") for k, v in tables.items()
                   if k not in ("Long Pending (>60d)", "Slowest Disposals")}
    OUT_JSON.write_text(json.dumps(S, indent=1, default=str))
    print(json.dumps({k: v for k, v in S.items() if k != "tables"}, indent=1, default=str))
    return df, tables


if __name__ == "__main__":
    main()
