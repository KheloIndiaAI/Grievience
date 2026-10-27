import type { Grievance } from '@/types'
import { median, pct, quantile } from '@/data'

export const SLA = 21

/** Grievances received at least 21 days before the data date — the only ones whose 21-day outcome is known. */
export function matured(rows: Grievance[], asOf: string, sla = SLA) {
  const cut = new Date(Date.parse(asOf) - sla * 86400000).toISOString().slice(0, 10)
  return rows.filter((r) => r.receipt <= cut)
}

export interface Headline {
  received: number
  matured: number
  disposed21: number
  disposed21Pct: number | null
  genuine21: number
  genuine21Pct: number | null
  disposed: number
  answered: number
  answeredPct: number | null
  open: number
  stuck: number
  over60: number
  untouched: number
  medianWait: number | null
  p90Wait: number | null
  bounced: number
  bouncedPct: number
  repeat: number
  repeatPct: number
  outOfMandate: number
  outOfMandatePct: number | null
  noText: number
  firstTimeRightPct: number
}

export function headline(rows: Grievance[], asOf: string): Headline {
  const m = matured(rows, asOf)
  const d = rows.filter((r) => r.disposed)
  const days = d.map((r) => r.days!).filter((x) => x != null).sort((a, b) => a - b)
  const open = rows.filter((r) => !r.disposed)
  const d21 = m.filter((r) => r.disposed && (r.days ?? 999) <= SLA).length
  const g21 = m.filter((r) => r.genuine21).length
  const bounced = rows.filter((r) => r.misroutes > 0).length
  return {
    received: rows.length,
    matured: m.length,
    disposed21: d21,
    disposed21Pct: m.length ? pct(d21, m.length) : null,
    genuine21: g21,
    genuine21Pct: m.length ? pct(g21, m.length) : null,
    disposed: d.length,
    answered: d.filter((r) => r.answered).length,
    answeredPct: d.length ? pct(d.filter((r) => r.answered).length, d.length) : null,
    open: open.length,
    stuck: open.filter((r) => r.stuck).length,
    over60: open.filter((r) => (r.pendingAge ?? 0) > 60).length,
    untouched: open.filter((r) => r.untouched).length,
    medianWait: median(days),
    p90Wait: days.length ? Math.round(quantile(days, 0.9)) : null,
    bounced,
    bouncedPct: pct(bounced, rows.length),
    repeat: rows.filter((r) => r.repeatFiling).length,
    repeatPct: pct(rows.filter((r) => r.repeatFiling).length, rows.length),
    outOfMandate: d.filter((r) => r.outOfMandate).length,
    outOfMandatePct: d.length ? pct(d.filter((r) => r.outOfMandate).length, d.length) : null,
    noText: d.filter((r) => r.noText).length,
    firstTimeRightPct: pct(rows.length - bounced, rows.length),
  }
}

export interface MonthFlow { key: string; received: number; disposed: number; answered: number; open: number; genuinePct: number | null; matured: boolean }

/** In / out / open per month. Open stock starts at zero on 1 Jan (no backlog from before the first month in the export). */
export function monthlyFlow(rows: Grievance[], asOf: string): MonthFlow[] {
  const months = [...new Set(rows.map((r) => r.month))].sort()
  const cut = new Date(Date.parse(asOf) - SLA * 86400000).toISOString().slice(0, 7)
  let open = 0
  return months.map((m) => {
    const rec = rows.filter((r) => r.month === m)
    const out = rows.filter((r) => r.disposed && r.disposalDate?.slice(0, 7) === m)
    open += rec.length - out.length
    const g = rec.length ? pct(rec.filter((r) => r.genuine21).length, rec.length) : null
    return { key: m, received: rec.length, disposed: out.length, answered: out.filter((r) => r.answered).length, open, genuinePct: g, matured: m < cut }
  })
}

/** Days files waited with each office (gap before each action, plus the current open wait for pending cases). */
export function waitingByOffice(rows: Grievance[]) {
  const m = new Map<string, { code: string; days: number; actions: number; cases: Set<string> }>()
  const add = (code: string, days: number, id: string, action: boolean) => {
    if (!m.has(code)) m.set(code, { code, days: 0, actions: 0, cases: new Set() })
    const o = m.get(code)!
    o.days += days
    if (action) o.actions += 1
    o.cases.add(id)
  }
  for (const r of rows) {
    for (const s of r.steps) {
      if (s.gap == null || !s.from || s.from === 'C1TZN') continue
      add(s.from, s.gap, r.id, true)
    }
    if (!r.disposed && r.holder && r.idleDays) add(r.holder, r.idleDays, r.id, false)
  }
  const total = [...m.values()].reduce((s, o) => s + o.days, 0)
  return { total, offices: [...m.values()].map((o) => ({ ...o, n: o.cases.size, share: pct(o.days, total) })).sort((a, b) => b.days - a.days) }
}

/** Offices that returned grievances as "not pertaining", and to whom. */
export function bounceMap(rows: Grievance[]) {
  const by = new Map<string, { code: string; returns: number; cases: Set<string> }>()
  for (const r of rows) {
    for (const s of r.steps) {
      if (!/not pertaining/i.test(s.action) || !s.from) continue
      if (!by.has(s.from)) by.set(s.from, { code: s.from, returns: 0, cases: new Set() })
      const o = by.get(s.from)!
      o.returns += 1
      o.cases.add(r.id)
    }
  }
  return [...by.values()].sort((a, b) => b.returns - a.returns)
}

export const medianOf = (rs: Grievance[], f: (r: Grievance) => number | null | undefined) =>
  median(rs.map(f).filter((x): x is number => x != null))

export const pctOf = (rs: Grievance[], f: (r: Grievance) => boolean) => (rs.length ? pct(rs.filter(f).length, rs.length) : null)
