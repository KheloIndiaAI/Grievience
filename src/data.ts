import type { Dataset, Grievance } from './types'
import { CHANNEL_SHORT, OFFICE_OVERRIDE, REPLY_SHORT, SOURCE_SHORT, THEME_SHORT } from './lib/labels'

export function dayBucket(d: number | null): string | null {
  if (d == null) return null
  if (d <= 7) return '0-7'
  if (d <= 15) return '8-15'
  if (d <= 21) return '16-21'
  if (d <= 30) return '22-30'
  if (d <= 60) return '31-60'
  if (d <= 90) return '61-90'
  if (d <= 180) return '91-180'
  return '>180'
}
export function transferBucket(t: number): string {
  if (t <= 3) return String(t)
  if (t <= 5) return '4-5'
  return '6+'
}

/** Public build: the redacted file in public/data. `npm run dev:internal` points this at the
 *  internal export, which the dev server serves from private/ (never copied into dist/). */
export const DATA_URL: string = import.meta.env.VITE_DATA_URL || '/data/grievances.json'

export async function loadData(): Promise<Dataset> {
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`Could not load data (${res.status})`)
  const ds: Dataset = await res.json()
  const off = ds.offices
  for (const [k, v] of Object.entries(OFFICE_OVERRIDE)) off[k] = v
  const name = (c: string | null | undefined) => (c ? off[c] || c : null)
  for (const r of ds.records) {
    r.themeFull = r.theme
    r.theme = THEME_SHORT[r.theme] ?? r.theme
    r.replyType = REPLY_SHORT[r.replyType] ?? r.replyType
    r.sourceShort = SOURCE_SHORT[r.source] ?? r.source
    r.source = r.sourceShort
    r.channel = CHANNEL_SHORT[r.channel] ?? r.channel
    r.status = r.disposed ? 'Disposed' : 'Pending'
    r.sla = !r.disposed ? 'Pending' : (r.days ?? 0) <= ds.slaDays ? 'Within 21 days' : 'Beyond 21 days'
    r.daysBucket = dayBucket(r.days)
    r.pendingBucket = dayBucket(r.pendingAge)
    r.transferBucket = transferBucket(r.transfers)
    r.holderName = r.holder ? name(r.holder) : null
    r.divisionLabel = r.disposed ? r.division || 'Unknown' : r.holderName ?? 'Unknown'
    r.campaignLabel = r.campaign || 'No campaign'
    r.causeLabel = r.cause || 'Not recorded'
    r.resolutionLabel = r.resolution || 'Not recorded'
    r.misrouted = r.misroutes > 0 ? 'Misrouted' : 'Not misrouted'
    r.saiLabel = r.sai ? 'Went through SAI' : 'Did not go to SAI'
    r.saiHandler = r.sai ? name(r.sai.handler) : null
    r.saiSender = r.sai ? (r.sai.sender === 'SPSAI' ? 'SAI HQ (direct)' : name(r.sai.sender)) : null
    r.pathNamed = r.path.split(' > ').map((c) => name(c) ?? c).join(' → ')
    r.state = r.state || 'Not Known'
    // internal dataset: the complainant key is the mobile number itself (never published)
    if (!ds.redacted && r.cid == null) r.cid = r.mobile ?? null
    if (r.email) r.email = r.email.trim().split(/\s+/)[0]
    // search never indexes personal identifiers, even on the internal dataset
    r._search = [r.id, r.description, r.reply, r.district, r.state, r.themeFull, r.catL1, r.catL2]
      .filter(Boolean).join(' \u0001 ').toLowerCase()
  }
  deriveExecutive(ds, name)
  return ds
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const OUT_OF_MANDATE = new Set(['“State subject” deflection', '“Federation decides” deflection', 'Not pertaining / not a grievance'])

/** Fields used by the executive screens. */
function deriveExecutive(ds: Dataset, name: (c: string | null | undefined) => string | null) {
  // The public dataset ships repeatFiling / refiledAny / refiledSame / followUpOf precomputed
  // (they need mobile numbers and complaint text, which are not published).
  if (!ds.redacted) deriveRefilings(ds)
  deriveOwnership(ds, name)
}

/** Internal dataset only: same rules as data-pipeline/redact_dataset.py — keep the two in sync. */
function deriveRefilings(ds: Dataset) {
  // repeat filings: every filing after a person's first (by mobile number)
  const seen = new Set<string>()
  const byDate = [...ds.records].sort((a, b) => a.receipt.localeCompare(b.receipt) || a.id.localeCompare(b.id))
  for (const r of byDate) {
    r.repeatFiling = !!r.mobile && seen.has(r.mobile)
    if (r.mobile) seen.add(r.mobile)
  }
  // filed again after disposal: same mobile, later grievance received on/after the disposal date
  const STOP = new Set('the and for this that with from have been your sir madam please kindly request regarding respected dear subject additional information provided which their they there will shall also into about under'.split(' '))
  const words = (r: Grievance) => new Set(((r.description ?? '').split('\n').filter((l) => !l.includes('>>')).join(' ').toLowerCase().match(/[a-z\u0900-\u097f]{4,}/g) ?? []).filter((w) => !STOP.has(w)))
  const byMobile = new Map<string, Grievance[]>()
  for (const r of ds.records) {
    r.refiledAny = null
    r.refiledSame = null
    r.followUpOf = null
    if (!r.mobile) continue
    if (!byMobile.has(r.mobile)) byMobile.set(r.mobile, [])
    byMobile.get(r.mobile)!.push(r)
  }
  for (const rs of byMobile.values()) {
    if (rs.length < 2) continue
    const ws = new Map(rs.map((r) => [r.id, words(r)]))
    for (const r of rs) {
      if (!r.disposed || !r.disposalDate) continue
      const later = rs.filter((x) => x.id !== r.id && x.receipt >= r.disposalDate!).sort((a, b) => a.receipt.localeCompare(b.receipt))
      if (!later.length) continue
      r.refiledAny = later[0].id
      const w = ws.get(r.id)!
      if (w.size < 8) continue
      for (const x of later) {
        const wx = ws.get(x.id)!
        if (wx.size < 8) continue
        let inter = 0
        for (const t of w) if (wx.has(t)) inter++
        if (inter / (w.size + wx.size - inter) >= 0.2) {
          r.refiledSame = x.id
          if (!x.followUpOf) x.followUpOf = r.id
          break
        }
      }
    }
  }
}

function deriveOwnership(ds: Dataset, name: (c: string | null | undefined) => string | null) {
  for (const r of ds.records) {
    r.saiRelation = r.sai ? 'Sent to SAI' : r.theme === 'SAI centres & infrastructure' || r.catL1 === 'SAI Work' ? 'About SAI, not sent to SAI' : 'Not SAI-related'
    const disp = [...r.steps].reverse().find((s) => /disposed of/i.test(s.action))
    r.ownerCode = r.disposed ? disp?.from ?? null : r.holder
    r.owner = name(r.ownerCode) ?? (r.disposed ? r.division ?? 'Unknown' : 'Unknown')
    r.answered = r.disposed && r.replyType === 'Substantive reply'
    r.genuine21 = r.answered && (r.days ?? 999) <= ds.slaDays
    r.outOfMandate = r.disposed && OUT_OF_MANDATE.has(r.replyType)
    r.noText = r.replyFormat.startsWith('No usable')
    r.stuck = !r.disposed && (r.pendingAge ?? 0) > ds.slaDays
    r.untouched = !r.disposed && (r.idleDays ?? 0) > 14
    r.outcome = !r.disposed ? 'Pending' : r.answered ? 'Answered' : r.outOfMandate ? 'Deflected / out of mandate' : r.noText ? 'No usable text' : 'Other reply'
    r.daysToDesk = null
    r.daysAtDesk = null
    if (r.disposed && disp && r.ownerCode) {
      const arrive = r.steps.find((s) => s.to === r.ownerCode)?.date ?? r.receipt
      r.daysToDesk = Math.max(0, dayDiff(r.receipt, arrive))
      r.daysAtDesk = Math.max(0, dayDiff(arrive, disp.date))
    }
  }
}

// ------------------------------------------------------------ stats helpers
export function median(xs: number[]): number | null {
  const a = xs.filter((x) => x != null && !Number.isNaN(x)).sort((p, q) => p - q)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}
export const mean = (xs: number[]) => {
  const a = xs.filter((x) => x != null && !Number.isNaN(x))
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
}
export const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0)
export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? '–' : n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })
export const fmtPct = (n: number | null | undefined, digits = 1) => (n == null ? '–' : `${fmt(n, digits)}%`)

export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): { key: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k == null || k === '') continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([k, c]) => ({ key: k, count: c })).sort((a, b) => b.count - a.count)
}

export function groupBy<T>(rows: T[], key: (r: T) => string | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    if (k == null || k === '') continue
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
  }
  return m
}

export interface GroupStats {
  key: string
  n: number
  disposed: number
  pending: number
  medianDays: number | null
  meanDays: number | null
  slaPct: number | null
  avgTransfers: number | null
  misroutePct: number
  avgQuality: number | null
  templatePct: number | null
  goodPct: number | null
}

export function stats(key: string, rows: Grievance[], sla = 21): GroupStats {
  const d = rows.filter((r) => r.disposed)
  const days = d.map((r) => r.days!).filter((x) => x != null)
  return {
    key,
    n: rows.length,
    disposed: d.length,
    pending: rows.length - d.length,
    medianDays: median(days),
    meanDays: mean(days),
    slaPct: d.length ? pct(days.filter((x) => x <= sla).length, d.length) : null,
    avgTransfers: mean(rows.map((r) => r.transfers)),
    misroutePct: pct(rows.filter((r) => r.misroutes > 0).length, rows.length),
    avgQuality: mean(d.map((r) => r.quality!).filter((x) => x != null)),
    templatePct: d.length ? pct(d.filter((r) => r.template).length, d.length) : null,
    goodPct: d.length ? pct(d.filter((r) => r.qualityBand === 'Good').length, d.length) : null,
  }
}

export function groupStats(rows: Grievance[], key: (r: Grievance) => string | null | undefined): GroupStats[] {
  return [...groupBy(rows, key).entries()].map(([k, v]) => stats(k, v)).sort((a, b) => b.n - a.n)
}

export function boxStats(xs: number[]) {
  const a = [...xs].sort((p, q) => p - q)
  const q1 = quantile(a, 0.25)
  const q3 = quantile(a, 0.75)
  const iqr = q3 - q1
  const lo = Math.max(a[0] ?? 0, q1 - 1.5 * iqr)
  const hi = Math.min(a[a.length - 1] ?? 0, q3 + 1.5 * iqr)
  return [lo, q1, quantile(a, 0.5), q3, hi]
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ------------------------------------------------------------ privacy (internal dataset only)
export const maskName = (s: string | null | undefined) => {
  if (!s) return '–'
  return s.trim().split(/\s+/).map((w) => (w[0] ? w[0].toUpperCase() + '.' : '')).join(' ')
}
export const maskPhone = (s: string | null | undefined) => (s ? `••••••${s.slice(-4)}` : '–')
export const maskEmail = (s: string | null | undefined) => {
  if (!s) return '–'
  const [u, d] = s.split('@')
  return `${u.slice(0, 1)}•••@${d ?? ''}`
}

/** CSV export row. On the public dataset it carries no personal identifiers or free text
 *  (there are none to carry). On the internal dataset it adds the grievance and reply text,
 *  and complainant details: masked unless `showPII`. */
export const toExportRow = (r: Grievance, showPII = false) => ({
  ...baseExportRow(r),
  ...(r.description !== undefined || r.reply !== undefined ? {
    Complainant: showPII ? r.name ?? '' : maskName(r.name),
    Mobile: showPII ? r.mobile ?? '' : maskPhone(r.mobile),
    Email: showPII ? r.email ?? '' : maskEmail(r.email),
    Description: r.description ?? '', 'Final Reply': r.reply ?? '',
  } : {}),
})

const baseExportRow = (r: Grievance) => ({
  'Registration Number': r.id, 'Date of Receipt': r.receipt,
  State: r.state, District: r.district, Source: r.source, Channel: r.channel, Theme: r.theme,
  'Category L1': r.catL1, 'Category L2': r.catL2, Status: r.status, 'Closing Division': r.division,
  'Current Holder': r.holderName, 'Days to Disposal': r.days, 'Pending Age': r.pendingAge,
  'Manual Transfers': r.transfers, Misroutes: r.misroutes, 'Went through SAI': r.sai ? 'Yes' : 'No',
  'SAI handling office': r.saiHandler, 'Days inside SAI': r.sai?.dIn ?? null,
  'Reply Type': r.replyType, 'Reply Format': r.replyFormat,
  'Quality Score': r.quality, 'Quality Band': r.qualityBand, 'Resolution Type': r.resolution,
  Campaign: r.campaign,
})
