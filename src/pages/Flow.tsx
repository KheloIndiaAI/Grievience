import * as React from 'react'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { FlowDiagram, useTween, type FlowSpec } from './FlowDiagram'
import { countBy, median, pct } from '@/data'
import { MONTHS } from '@/lib/labels'
import './flow.css'

const DEADLINE = 21
const STATUS = ['Disposed within 21 days', 'Disposed after 21 days', 'Pending', 'Pending over 21 days'] as const
const STATUS_COLOR: Record<string, string> = {
  'Disposed within 21 days': 'var(--c-6)',
  'Disposed after 21 days': 'var(--c-3)',
  Pending: 'var(--c-1)',
  'Pending over 21 days': 'var(--c-5)',
}
const statusOf = (r: Grievance) => (r.disposed ? ((r.days ?? 999) <= DEADLINE ? STATUS[0] : STATUS[1]) : (r.pendingAge ?? 0) > DEADLINE ? STATUS[3] : STATUS[2])
const stuck = (r: Grievance) => !r.disposed && (r.pendingAge ?? 0) > DEADLINE

const I = {
  arrow: <svg viewBox="0 0 20 20"><path d="M4 10h11M11 6l4 4-4 4" /></svg>,
  alert: <svg viewBox="0 0 20 20"><path d="M10 3 18 17H2L10 3Z" /><path d="M10 8v4M10 14.4v.2" /></svg>,
  hourglass: <svg viewBox="0 0 20 20"><path d="M6 3h8M6 17h8M7 3c0 4 6 4 6 7s-6 3-6 7M13 3c0 4-6 4-6 7s6 3 6 7" /></svg>,
  trend: <svg viewBox="0 0 20 20"><path d="M3 14l5-5 3 3 6-6M13 6h4v4" /></svg>,
  list: <svg viewBox="0 0 20 20"><path d="M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01" /></svg>,
  close: <svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" /></svg>,
  play: <svg viewBox="0 0 20 20"><path d="M6 4l10 6-10 6V4Z" /></svg>,
  pause: <svg viewBox="0 0 20 20"><path d="M7 4v12M13 4v12" /></svg>,
}

function topKeys(rows: Grievance[], f: (r: Grievance) => string | null, n: number, other: string) {
  const c = countBy(rows, f)
  const top = c.slice(0, n).map((x) => x.key)
  return { keys: c.length > n ? [...top, other] : top, has: new Set(top) }
}

interface Stats { n: number; disposed: number; on: number; pending: number; stuck: number; med: number | null }
const statsOf = (rs: Grievance[]): Stats => {
  const d = rs.filter((r) => r.disposed)
  return {
    n: rs.length, disposed: d.length, on: d.filter((r) => (r.days ?? 999) <= DEADLINE).length,
    pending: rs.length - d.length, stuck: rs.filter(stuck).length, med: median(d.map((r) => r.days!).filter((x) => x != null)),
  }
}

function Summary({ s }: { s: Stats }) {
  return (
    <div className="flow-summary">
      <span><b>{useTween(s.pending)}</b> pending</span>
      <span className="bad"><b>{useTween(s.stuck)}</b> pending over 21 days</span>
      <span><b>{useTween(s.disposed ? Math.round(pct(s.on, s.disposed)) : 0)}</b>% disposed within 21 days</span>
      <span><b>{useTween(s.med ?? 0)}</b> days to dispose (median)</span>
      <em>Click any source, office or status to follow its grievances.</em>
    </div>
  )
}

interface Insight { tag: string; icon: React.ReactNode; color: string; key: string; title: string; body: string }

function FlowSection({ id, crumb, title, spec, rows, period, monthBar, kind }: {
  id: string
  crumb: string
  title: (n: React.ReactNode) => React.ReactNode
  spec: FlowSpec
  rows: Grievance[]
  period: string
  monthBar: React.ReactNode
  kind: { a: string; g: string }
}) {
  const { showCases } = useStore()
  const [lock, setLock] = React.useState<string | null>(null)
  const [revealed, setRevealed] = React.useState(true)
  React.useEffect(() => { const t = setTimeout(() => setRevealed(false), 1600); return () => clearTimeout(t) }, [])
  const all = statsOf(rows)
  const nTween = useTween(rows.length)

  const inNode = (k: string) => rows.filter((r) => spec.pathOf(r).includes(k))
  const offices = spec.col2.map((k) => ({ k, rs: inNode(k) })).filter((x) => x.rs.length)
  const insights: Insight[] = []
  const hot = [...offices].sort((a, b) => b.rs.filter(stuck).length - a.rs.filter(stuck).length)[0]
  if (hot && hot.rs.some(stuck)) {
    const s = statsOf(hot.rs)
    insights.push({ tag: 'Most stuck', icon: I.alert, color: 'var(--c-5)', key: hot.k, title: `${spec.name(hot.k)} · ${s.stuck} pending over 21 days`, body: `${s.pending} pending in all; ${s.disposed ? Math.round(pct(s.on, s.disposed)) : 0}% of its disposals were within 21 days.` })
  }
  const slow = offices.filter((x) => x.rs.filter((r) => r.disposed).length >= 8)
    .map((x) => ({ ...x, s: statsOf(x.rs) })).sort((a, b) => pct(a.s.on, a.s.disposed) - pct(b.s.on, b.s.disposed))[0]
  if (slow && slow.k !== hot?.k) insights.push({ tag: 'Slowest to dispose', icon: I.hourglass, color: 'var(--c-3)', key: slow.k, title: `${spec.name(slow.k)} · ${Math.round(pct(slow.s.on, slow.s.disposed))}% within 21 days`, body: `Median ${slow.s.med ?? '–'} days to dispose (overall ${all.med ?? '–'}).` })
  const pair = countBy(rows, (r) => { const p = spec.pathOf(r); return p[0] + '|' + p[2] })[0]
  if (pair) {
    const [a, g] = pair.key.split('|')
    insights.push({ tag: 'Largest stream', icon: I.trend, color: 'var(--c-1)', key: a, title: `${spec.name(a)} → ${spec.name(g)}`, body: `${pair.count} grievances, ${Math.round(pct(pair.count, rows.length))}% of all ${period}.` })
  }

  const lockRows = lock ? inNode(lock) : []
  const ls = statsOf(lockRows)
  const lkind = lock?.charAt(0)
  const otherTop = lock ? countBy(lockRows, (r) => { const p = spec.pathOf(r); return lkind === 'g' ? p[0] : p[2] })[0] : null
  const seg = STATUS.map((s) => [s, lockRows.filter((r) => statusOf(r) === s).length] as const)

  return (
    <section id={id} style={{ scrollMarginTop: 120 }}>
      <div className="flow-top">
        <div>
          <div className="crumb" style={{ color: 'var(--accent)' }}>{crumb} · {period}</div>
          <h2 className="flow-title">{title(<span className="hl">{nTween} grievances</span>)}</h2>
          <Summary s={all} />
        </div>
      </div>

      <div className="card flow-card">
        <div className="flow-swipe">Swipe sideways to see the full flow {I.arrow}</div>
        <FlowDiagram spec={spec} rows={rows} lock={lock} onLock={setLock} reveal={revealed} />
        <div className="flow-foot">
          <div className="legend">
            {STATUS.map((s) => <span key={s}><i style={{ background: STATUS_COLOR[s] }} />{s}</span>)}
            <span className="lg-chip"><b>2 {spec.chipLabel}</b> pending over 21 days (red dot on small boxes)</span>
          </div>
          {monthBar}
        </div>
      </div>

      <div className="flow-panel">
        {lock ? (
          <div className="flow-trace-card">
            <div className="ftc-head">
              <div>
                <div className="ftc-kicker"><span className="ftc-dot" />Following {lkind === 'a' ? kind.a : lkind === 'g' ? kind.g : 'status'}</div>
                <div className="ftc-title">{spec.name(lock)}</div>
                <div className="ftc-sub"><b>{ls.n}</b> of {rows.length} grievances {period}</div>
              </div>
              <div className="ftc-actions">
                <button className="btn btn-primary" onClick={() => showCases({ title: spec.name(lock), preview: 'reply', tabs: [
                  { label: 'Pending over 21 days', rows: lockRows.filter(stuck) },
                  { label: 'Pending', rows: lockRows.filter((r) => !r.disposed) },
                  { label: 'Disposed', rows: lockRows.filter((r) => r.disposed) },
                  { label: 'All', rows: lockRows },
                ].filter((t) => t.rows.length) })}>{I.list}Open these {ls.n} grievances {I.arrow}</button>
                {lock === 'g:Sent to SAI' && <button className="btn btn-ghost" onClick={() => document.getElementById('flow-sai')?.scrollIntoView({ behavior: 'smooth' })}>See the SAI flow {I.arrow}</button>}
                <button className="btn btn-ghost" onClick={() => setLock(null)}>{I.close}Clear</button>
              </div>
            </div>
            <div className="ftc-bar">
              {seg.map(([s, n]) => (n ? <span key={s} style={{ flex: n, background: STATUS_COLOR[s] }} title={`${s}: ${n}`} /> : null))}
            </div>
            <div className="ftc-stats">
              <div className="ftc-stat"><span className="k">Pending</span><b>{ls.pending}</b><span>{ls.stuck} over 21 days</span></div>
              <div className={`ftc-stat ${ls.stuck ? 'bad' : ''}`}><span className="k">Pending over 21 days</span><b>{ls.stuck}</b><span>{ls.pending ? `${Math.round(pct(ls.stuck, ls.pending))}% of its pending` : 'nothing pending'}</span></div>
              <div className="ftc-stat"><span className="k">Disposed within 21 days</span><b>{ls.disposed ? Math.round(pct(ls.on, ls.disposed)) : 0}%</b><span>{ls.disposed} disposed · median {ls.med ?? '–'} days</span></div>
              <div className="ftc-stat"><span className="k">{lkind === 'g' ? `Main ${kind.a}` : `Main ${kind.g}`}</span><b>{otherTop ? spec.name(otherTop.key) : '—'}</b><span>{otherTop ? `${otherTop.count} grievances` : ''}</span></div>
            </div>
          </div>
        ) : (
          <>
            <div className="flow-insights-head">Needs attention <em>click a card to follow its grievances</em></div>
            <div className="flow-insights">
              {insights.map((x) => (
                <button key={x.tag} className="fi-card" style={{ ['--k' as string]: x.color } as React.CSSProperties} onClick={() => setLock(x.key)}>
                  <span className="fi-tag"><span className="fi-ic">{x.icon}</span>{x.tag}</span>
                  <span className="fi-title">{x.title}</span>
                  <span className="fi-body">{x.body}</span>
                  <span className="fi-go">Follow{I.arrow}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export function FlowPage() {
  const { rows: allRows } = useStore()
  const months = React.useMemo(() => [...new Set(allRows.map((r) => r.month))].sort(), [allRows])
  const [month, setMonth] = React.useState<string | null>(null)
  const [playing, setPlaying] = React.useState(false)
  React.useEffect(() => {
    if (!playing) return
    const seq = [...months, null]
    let i = 0
    setMonth(seq[i++])
    const t = setInterval(() => {
      if (i >= seq.length) { setPlaying(false); clearInterval(t); return }
      setMonth(seq[i++])
    }, 1800)
    return () => clearInterval(t)
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = React.useMemo(() => (month ? allRows.filter((r) => r.month === month) : allRows), [allRows, month])
  const period = month ? `received in ${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}` : 'received Jan – Oct 2026'

  /* ---------------- Ministry flow ---------------- */
  const ministry = React.useMemo<FlowSpec>(() => {
    const src = topKeys(allRows, (r) => r.source, 5, 'Other sources')
    const ownerOf = (r: Grievance) => (r.sai ? 'Sent to SAI' : r.owner)
    const off = topKeys(allRows, ownerOf, 7, 'Other offices')
    return {
      heads: ['Came from', 'PG desk', 'Ministry office', 'Current status'],
      hubSub: 'received',
      pathOf: (r) => [
        'a:' + (src.has.has(r.source) ? r.source : 'Other sources'), 'h',
        'g:' + (off.has.has(ownerOf(r)) ? ownerOf(r) : 'Other offices'), 's:' + statusOf(r),
      ],
      col0: src.keys.map((k) => 'a:' + k), col2: off.keys.map((k) => 'g:' + k), col3: STATUS.map((s) => 's:' + s),
      statusColor: STATUS_COLOR, name: (k) => (k === 'h' ? 'PG desk' : k.slice(2)), chip: (rs) => rs.filter(stuck).length, chipLabel: 'over 21d', dotDivisor: 16,
    }
  }, [allRows])

  /* ---------------- SAI flow ---------------- */
  const saiAll = React.useMemo(() => allRows.filter((r) => r.sai), [allRows])
  const sai = React.useMemo<FlowSpec>(() => {
    const snd = topKeys(saiAll, (r) => r.saiSender, 5, 'Other desks')
    const hd = topKeys(saiAll, (r) => r.saiHandler, 8, 'Other SAI offices')
    const short = (s: string) => s.replace(' (SAI)', '').replace('Autonomous Bodies (Ministry)', 'Autonomous Bodies desk')
    return {
      heads: ['Sent by (Ministry desk)', 'SAI HQ', 'SAI office', 'Current status'],
      hubSub: 'reached SAI',
      pathOf: (r) => [
        'a:' + (snd.has.has(r.saiSender!) ? r.saiSender : 'Other desks'), 'h',
        'g:' + (hd.has.has(r.saiHandler!) ? r.saiHandler : 'Other SAI offices'), 's:' + statusOf(r),
      ],
      col0: snd.keys.map((k) => 'a:' + k), col2: hd.keys.map((k) => 'g:' + k), col3: STATUS.map((s) => 's:' + s),
      statusColor: STATUS_COLOR, name: (k) => (k === 'h' ? 'SAI HQ' : short(k.slice(2))), chip: (rs) => rs.filter(stuck).length, chipLabel: 'over 21d', dotDivisor: 5,
    }
  }, [saiAll])
  const saiRows = React.useMemo(() => rows.filter((r) => r.sai), [rows])

  const maxM = Math.max(1, ...months.map((m) => allRows.filter((r) => r.month === m).length))
  const monthBar = (
    <div className="flow-period">
      <button className={`btn btn-ghost btn-sm play${playing ? ' on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? I.pause : I.play}<span>{playing ? 'Pause' : 'Play months'}</span></button>
      <div className="wk-chips">
        <button className={`wk${month === null ? ' on' : ''}`} onClick={() => { setPlaying(false); setMonth(null) }}><span className="wk-bar q" /><span className="wk-lbl">All</span></button>
        {months.map((m) => {
          const n = allRows.filter((r) => r.month === m).length
          return (
            <button key={m} className={`wk${month === m ? ' on' : ''}${playing && month === m ? ' run' : ''}`} title={`${n} received`} onClick={() => { setPlaying(false); setMonth(m) }}>
              <span className="wk-bar"><i style={{ height: `${Math.max(8, (n / maxM) * 100)}%` }} /></span>
              <span className="wk-lbl">{MONTHS[Number(m.slice(5, 7)) - 1]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="gf -mx-4 -mt-6 space-y-10 px-4 pb-4 pt-6 lg:-mx-8 lg:px-8" style={{ background: 'var(--bg)' }}>
      <FlowSection id="flow-ministry" crumb="Ministry" spec={ministry} rows={rows} period={period} monthBar={monthBar} kind={{ a: 'source', g: 'office' }}
        title={(n) => <>Where {n} came from, and where they stand today</>} />
      <FlowSection id="flow-sai" crumb="Sports Authority of India" spec={sai} rows={saiRows} period={period} monthBar={monthBar} kind={{ a: 'desk', g: 'SAI office' }}
        title={(n) => <>How {n} moved through SAI</>} />
      <p className="muted" style={{ fontSize: 12.5 }}>
        Office = the office that disposed of the grievance, or holds it now if pending. Grievances sent to SAI appear as one “Sent to SAI” box in the Ministry flow and are broken down in the SAI flow.
        Current status: disposed within / after 21 days of receipt, or pending (over 21 days marked red).
      </p>
    </div>
  )
}
