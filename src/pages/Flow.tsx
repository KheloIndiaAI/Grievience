import * as React from 'react'
import { createPortal } from 'react-dom'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { FlowDiagram, useTween, type FlowSpec } from './FlowDiagram'
import { countBy, median, pct } from '@/data'
import { fmtDate, monthLabel, monthLong } from '@/lib/labels'
import './flow.css'

const DEADLINE = 21
const STATUS = ['Disposed within 21 days', 'Disposed after 21 days', 'Pending', 'Pending over 21 days'] as const
const STATUS_COLOR: Record<string, string> = {
  'Disposed within 21 days': 'var(--c-6)',
  'Disposed after 21 days': 'var(--c-3)',
  Pending: 'var(--c-1)',
  'Pending over 21 days': 'var(--c-5)',
}
const SAI = 'Sent to SAI'
const ownerOf = (r: Grievance) => (r.sai ? SAI : r.owner)
const trunc = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s)
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
  prev: <svg viewBox="0 0 20 20"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>,
  next: <svg viewBox="0 0 20 20"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>,
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

function Summary({ s, of }: { s: Stats; of: string | null }) {
  return (
    <div className="flow-summary">
      <span><b>{useTween(s.pending)}</b> pending</span>
      <span className="bad"><b>{useTween(s.stuck)}</b> pending over 21 days</span>
      <span><b>{useTween(s.disposed ? Math.round(pct(s.on, s.disposed)) : 0)}</b>% disposed within 21 days</span>
      <span><b>{useTween(s.med ?? 0)}</b> days to dispose (median)</span>
      <em>{of ? <>Numbers are for the <b className="sel">{s.n.toLocaleString('en-IN')}</b> grievances through <b className="sel">{of}</b>. Click it again, or Clear, to see all.</> : 'Click any source, office or status to follow its grievances; the numbers change to match.'}</em>
    </div>
  )
}

interface Insight { tag: string; icon: React.ReactNode; color: string; key: string; title: string; body: string }

function FlowSection({ id, crumb, title, spec, rows, period, monthBar, kind, lock: lockProp, onLock, deep, picker }: {
  id: string
  crumb: string
  title: (n: React.ReactNode) => React.ReactNode
  spec: FlowSpec
  rows: Grievance[]
  period: string
  monthBar: React.ReactNode
  kind: { a: string; g: string }
  /** controlled lock (the Ministry flow shares it with the page to pick the in-depth flow) */
  lock?: string | null
  onLock?: (k: string | null) => void
  /** label of the in-depth flow below for an office key, if there is one */
  deep?: (key: string) => string | null
  picker?: React.ReactNode
}) {
  const { showCases } = useStore()
  const [ownLock, setOwnLock] = React.useState<string | null>(null)
  const lock = lockProp !== undefined ? lockProp : ownLock
  const setLock = onLock ?? setOwnLock
  // a click anywhere except a box, the selection card or the month strip clears the selection
  React.useEffect(() => {
    if (!lock) return
    const away = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (!t?.closest || document.querySelector('[role="dialog"]')) return
      if (t.closest('.fl-node, .flow-panel, .dept-pick, .flow-period, .flow-now, [data-radix-popper-content-wrapper]')) return
      setLock(null)
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [lock, setLock])
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
          <Summary s={lock ? ls : all} of={lock ? spec.name(lock) : null} />
        </div>
      </div>
      {picker}

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
                {deep && deep(lock) && <button className="btn btn-ghost" onClick={() => document.getElementById('flow-dept')?.scrollIntoView({ behavior: 'smooth' })}>See {deep(lock)} in depth {I.arrow}</button>}
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
  const { rows: allRows, office } = useStore()
  const months = React.useMemo(() => [...new Set(allRows.map((r) => r.month))].sort(), [allRows])
  const [month, setMonth] = React.useState<string | null>(null)
  const [playing, setPlaying] = React.useState(false)
  React.useEffect(() => {
    if (!playing) return
    const seq = [...months, null]
    // resume after a paused month, otherwise start from the first month
    let i = month ? months.indexOf(month) + 1 : 0
    setMonth(seq[i++])
    const t = setInterval(() => {
      if (i >= seq.length) { setPlaying(false); clearInterval(t); return }
      setMonth(seq[i++])
    }, 1800)
    return () => clearInterval(t)
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = React.useMemo(() => (month ? allRows.filter((r) => r.month === month) : allRows), [allRows, month])
  const idx = month ? months.indexOf(month) : -1
  // previous / next month; stepping past either end goes back to all months
  const step = (d: number) => {
    setPlaying(false)
    if (idx < 0) return setMonth(d > 0 ? months[0] : months[months.length - 1])
    const j = idx + d
    setMonth(j < 0 || j >= months.length ? null : months[j])
  }
  // keep the current month's chip in view in every month strip
  React.useEffect(() => {
    document.querySelectorAll<HTMLElement>('.gf .wk-chips').forEach((strip) => {
      const on = strip.querySelector<HTMLElement>('.wk.on')
      if (on) strip.scrollTo({ left: on.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' })
    })
  }, [month])
  const [first, last] = React.useMemo(() => allRows.reduce(([a, b], r) => [r.receipt < a ? r.receipt : a, r.receipt > b ? r.receipt : b], ['9999', '0000']), [allRows])
  const period = month ? `received in ${monthLong(month)}` : allRows.length ? `received ${fmtDate(first)} – ${fmtDate(last)}` : 'no grievances in the selected period'

  /* ---------------- Ministry flow ---------------- */
  const off = React.useMemo(() => topKeys(allRows, ownerOf, 7, 'Other offices'), [allRows])
  const ministry = React.useMemo<FlowSpec>(() => {
    const src = topKeys(allRows, (r) => r.source, 5, 'Other sources')
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
  }, [allRows, off])

  /* ---- which office the second (in-depth) flow shows: SAI until an office is clicked above ---- */
  const [mLock, setMLock] = React.useState<string | null>(null)
  const [dept, setDept] = React.useState(SAI)
  const lockMinistry = (k: string | null) => { setMLock(k); if (k?.startsWith('g:')) setDept(k.slice(2)) }
  const pickDept = (d: string) => { setDept(d); setMLock('g:' + d) }
  const deptOf = (r: Grievance) => (off.has.has(ownerOf(r)) ? ownerOf(r) : 'Other offices')

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

  /* ---------------- any other office: who sent it → office → what it was about → status ---------------- */
  const deptAll = React.useMemo(() => allRows.filter((r) => deptOf(r) === dept), [allRows, dept, off]) // eslint-disable-line react-hooks/exhaustive-deps
  const deptSpec = React.useMemo<FlowSpec>(() => {
    const others = dept === 'Other offices'
    const senderOf = (r: Grievance) => {
      const from = r.steps.find((s) => s.to === r.ownerCode)?.from
      return !from || from === 'C1TZN' ? 'Directly from citizen' : office(from)
    }
    const midOf = (r: Grievance) => (others ? r.owner : r.theme)
    const snd = topKeys(deptAll, senderOf, 5, 'Other senders')
    const mid = topKeys(deptAll, midOf, others ? 8 : 7, others ? 'All other offices' : 'Other themes')
    return {
      heads: ['Sent by', trunc(others ? 'Other offices' : dept, 26), others ? 'Office' : 'Nature of case', 'Current status'],
      hubSub: others ? 'in smaller offices' : 'handled here',
      pathOf: (r) => [
        'a:' + (snd.has.has(senderOf(r)) ? senderOf(r) : 'Other senders'), 'h',
        'g:' + (mid.has.has(midOf(r)) ? midOf(r) : others ? 'All other offices' : 'Other themes'), 's:' + statusOf(r),
      ],
      col0: snd.keys.map((k) => 'a:' + k), col2: mid.keys.map((k) => 'g:' + k), col3: STATUS.map((s) => 's:' + s),
      statusColor: STATUS_COLOR, name: (k) => (k === 'h' ? dept : k.slice(2)), chip: (rs) => rs.filter(stuck).length, chipLabel: 'over 21d',
      dotDivisor: Math.max(3, Math.round(deptAll.length / 250)),
    }
  }, [deptAll, dept, office])
  const deptRows = React.useMemo(() => rows.filter((r) => deptOf(r) === dept), [rows, dept, off]) // eslint-disable-line react-hooks/exhaustive-deps
  const offices = ministry.col2.map((k) => k.slice(2))
  const picker = (
    <div className="dept-pick">
      <span>Show in depth</span>
      <div className="seg-pill" role="group" aria-label="Office shown in depth">
        {offices.map((d) => (
          <button key={d} className={d === dept ? 'on' : ''} aria-pressed={d === dept} onClick={() => pickDept(d)}>
            {d === SAI ? 'SAI' : d}<i>{allRows.filter((r) => deptOf(r) === d).length.toLocaleString('en-IN')}</i>
          </button>
        ))}
      </div>
    </div>
  )

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
              <span className="wk-lbl">{monthLabel(m)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="gf -mx-4 -mt-6 space-y-10 px-4 pb-28 pt-6 lg:-mx-8 lg:px-8" style={{ background: 'var(--bg)' }}>
      <FlowSection id="flow-ministry" crumb="Ministry" spec={ministry} rows={rows} period={period} monthBar={monthBar} kind={{ a: 'source', g: 'office' }}
        lock={mLock} onLock={lockMinistry} deep={(k) => (k.startsWith('g:') ? (k === 'g:' + SAI ? 'SAI' : k.slice(2)) : null)}
        title={(n) => <>Where {n} came from, and where they stand today</>} />
      {dept === SAI ? (
        <FlowSection key={SAI} id="flow-dept" crumb="Sports Authority of India" spec={sai} rows={saiRows} period={period} monthBar={monthBar} kind={{ a: 'desk', g: 'SAI office' }}
          picker={picker} title={(n) => <>How {n} moved through SAI</>} />
      ) : (
        <FlowSection key={dept} id="flow-dept" crumb={dept} spec={deptSpec} rows={deptRows} period={period} monthBar={monthBar}
          kind={dept === 'Other offices' ? { a: 'sender', g: 'office' } : { a: 'sender', g: 'theme' }} picker={picker}
          title={(n) => (dept === 'Other offices' ? <>How {n} spread across the smaller offices</> : <>Who sent {dept} its {n}, what they were about, and where they stand</>)} />
      )}
      {/* month dock, only while a month is picked or playing: rendered on <body> so it stays on screen
          (the page wrapper's animation would pin a fixed element to the page) */}
      {month && createPortal(
        <div className="gf">
          <div className="flow-now" role="region" aria-label="Month shown in the flows">
            <button className="fn-ic" onClick={() => step(-1)} aria-label="Previous month" title="Previous month">{I.prev}</button>
            <div className="fn-mid" aria-live="polite">
              <span className="fn-k">{playing ? 'Playing' : 'Showing'}</span>
              <b>{monthLong(month)}</b>
              <span className="fn-n">{rows.length.toLocaleString('en-IN')} received · month {idx + 1} of {months.length}</span>
            </div>
            <button className="fn-ic" onClick={() => step(1)} aria-label="Next month" title="Next month">{I.next}</button>
            <button className={`btn btn-sm fn-play${playing ? ' on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? I.pause : I.play}<span>{playing ? 'Pause' : 'Play'}</span></button>
            <button className="btn btn-ghost btn-sm fn-all" onClick={() => { setPlaying(false); setMonth(null) }}>{I.close}<span>All months</span></button>
            <span className="fn-bar" aria-hidden><i style={{ width: `${((idx + 1) / months.length) * 100}%` }} /></span>
          </div>
        </div>,
        document.body,
      )}
      <p className="muted" style={{ fontSize: 12.5 }}>
        Office = the office that disposed of the grievance, or holds it now if pending. Click an office in the Ministry flow (or pick one above the second flow) to see it in depth:
        SAI is broken down by the Ministry desk that sent it and the SAI office that handled it; every other office by who sent it the grievance and what the grievances were about.
        Current status: disposed within / after 21 days of receipt, or pending (over 21 days marked red).
      </p>
    </div>
  )
}
