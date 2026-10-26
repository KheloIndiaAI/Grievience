import * as React from 'react'
import type { Grievance } from '@/types'

/* ---------------------------------------------------------------------------
   Four-column flow: source → hub → office → status.
   Bands are proportional to the number of grievances; the last stage is
   coloured by status. Hover a node to trace its grievances; click to lock.
   --------------------------------------------------------------------------- */

export interface FlowSpec {
  heads: [string, string, string, string]
  hubSub: string
  /** path keys for one grievance: ['a:<source>', 'h', 'g:<office>', 's:<status>'] */
  pathOf: (r: Grievance) => [string, string, string, string]
  col0: string[] // ordered keys
  col2: string[]
  col3: string[]
  statusColor: Record<string, string>
  name: (key: string) => string
  /** red chip on office boxes (e.g. stuck count) */
  chip: (rs: Grievance[]) => number
  chipLabel: string
  dotDivisor: number
}

const f1 = (n: number) => n.toFixed(1)
const bandD = (x0: number, y0: number, x1: number, y1: number, w: number) => {
  const xm = (x0 + x1) / 2
  return `M${f1(x0)} ${f1(y0)} C${f1(xm)} ${f1(y0)} ${f1(xm)} ${f1(y1)} ${f1(x1)} ${f1(y1)} L${f1(x1)} ${f1(y1 + w)} C${f1(xm)} ${f1(y1 + w)} ${f1(xm)} ${f1(y0 + w)} ${f1(x0)} ${f1(y0 + w)} Z`
}
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useTween(to: number, dec = 0) {
  const [v, setV] = React.useState(to)
  const from = React.useRef(to)
  React.useEffect(() => {
    const a = from.current
    if (a === to || reduced()) { from.current = to; setV(to); return }
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 650)
      const e = 1 - Math.pow(1 - p, 3)
      setV(a + (to - a) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = to
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = to }
  }, [to])
  return dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-IN')
}

function Tw({ v }: { v: number }) { return <>{useTween(v)}</> }

interface Node { key: string; col: number; x: number; w: number; y: number; h: number; n: number; rows: Grievance[]; ly: number }

const trunc = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s)
interface Link { key: string; s: string; t: string; n: number; stage: number; w: number; x0: number; x1: number; y0: number; y1: number }

function layout(spec: FlowSpec, rows: Grievance[], W: number) {
  const H = 540, top = 58, avail = H - top - 22
  const cols = [spec.col0, ['h'], spec.col2, spec.col3]
  const gaps = [18, 0, 8, 22]
  const count: Record<string, number> = {}
  const byNode: Record<string, Grievance[]> = {}
  const links: Record<string, Link> = {}
  for (const r of rows) {
    const p = spec.pathOf(r)
    p.forEach((k) => { count[k] = (count[k] ?? 0) + 1; (byNode[k] ??= []).push(r) })
    for (let i = 0; i < 3; i++) {
      const lk = p[i] + '|' + p[i + 1]
      ;(links[lk] ??= { key: lk, s: p[i], t: p[i + 1], n: 0, stage: i, w: 0, x0: 0, x1: 0, y0: 0, y1: 0 }).n++
    }
  }
  const N = Math.max(1, rows.length)
  // minimum visual height per column so small boxes stay readable/clickable
  const minH = [3, 0, 24, 3]
  const fitK = (col: string[], ci: number) => {
    const room = avail - gaps[ci] * (col.length - 1)
    let kk = room / N
    for (let it = 0; it < 6; it++) {
      const small = col.filter((key) => (count[key] ?? 0) * kk < minH[ci])
      const smallN = small.reduce((a, key) => a + (count[key] ?? 0), 0)
      kk = (room - small.length * minH[ci]) / Math.max(1, N - smallN)
    }
    return kk
  }
  const k = Math.min(...cols.map((c, i) => fitK(c, i)))
  const boxW = Math.max(200, Math.min(250, Math.round(W * 0.17)))
  const xs = [{ x: 206, w: 12 }, { x: Math.round(W * 0.28), w: 120 }, { x: Math.round(W * 0.53), w: boxW }, { x: W - 236, w: 12 }]
  const nodes: Record<string, Node> = {}
  const order: Record<string, number> = {}
  const so: Record<string, number> = {}, to: Record<string, number> = {}
  const hOf = (key: string, ci: number) => { const n = count[key] ?? 0; return n ? Math.max(minH[ci], n * k) : 0 }
  cols.forEach((col, ci) => {
    const colH = col.reduce((a, key) => a + hOf(key, ci), 0) + gaps[ci] * (col.length - 1)
    let y = top + (avail - colH) / 2
    col.forEach((key, i) => {
      const h = hOf(key, ci)
      nodes[key] = { key, col: ci, x: xs[ci].x, w: xs[ci].w, y, h, n: count[key] ?? 0, rows: byNode[key] ?? [], ly: y + h / 2 }
      order[key] = i
      // centre the bands inside boxes that were padded up to the minimum height
      const pad = (h - (count[key] ?? 0) * k) / 2
      so[key] = pad; to[key] = pad
      y += h + gaps[ci]
    })
    // keep side labels apart (two text lines need ~32px)
    if (ci === 0 || ci === 3) {
      const ns = col.map((key) => nodes[key]).filter((nd) => nd.n)
      for (let i = 1; i < ns.length; i++) ns[i].ly = Math.max(ns[i].ly, ns[i - 1].ly + 32)
      const over = ns.length ? ns[ns.length - 1].ly - (H - 26) : 0
      if (over > 0) ns.forEach((nd) => (nd.ly -= over))
      for (let i = ns.length - 2; i >= 0; i--) ns[i].ly = Math.min(ns[i].ly, ns[i + 1].ly - 32)
    }
  })
  const list = Object.values(links).filter((l) => nodes[l.s] && nodes[l.t])
  ;[...list].sort((a, b) => order[a.s] - order[b.s] || order[a.t] - order[b.t]).forEach((l) => { l.w = l.n * k; l.y0 = nodes[l.s].y + so[l.s]; so[l.s] += l.w })
  ;[...list].sort((a, b) => order[a.t] - order[b.t] || order[a.s] - order[b.s]).forEach((l) => { l.y1 = nodes[l.t].y + to[l.t]; to[l.t] += l.w })
  list.forEach((l) => { l.x0 = nodes[l.s].x + nodes[l.s].w; l.x1 = nodes[l.t].x })
  return { W, H, k, nodes, links: list, cols, N: rows.length, xs }
}

export function FlowDiagram({ spec, rows, lock, onLock, reveal }: {
  spec: FlowSpec
  rows: Grievance[]
  lock: string | null
  onLock: (k: string | null) => void
  reveal: boolean
}) {
  const slot = React.useRef<HTMLDivElement>(null)
  const [W, setW] = React.useState(1100)
  const [hover, setHover] = React.useState<string | null>(null)
  const [dotsOn, setDotsOn] = React.useState(false)
  React.useEffect(() => {
    if (!slot.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(1040, Math.floor(e.contentRect.width))))
    ro.observe(slot.current)
    return () => ro.disconnect()
  }, [])
  const L = React.useMemo(() => layout(spec, rows, W), [spec, rows, W])
  React.useEffect(() => { setDotsOn(false); const t = setTimeout(() => setDotsOn(true), 800); return () => clearTimeout(t) }, [L])

  const sel = lock ?? (hover === 'h' ? null : hover)
  const trace = React.useMemo(() => {
    if (!sel) return null
    const sub: Record<string, number> = {}, hit: Record<string, boolean> = {}
    for (const r of rows) {
      const p = spec.pathOf(r)
      if (!p.includes(sel)) continue
      p.forEach((k) => (hit[k] = true))
      for (let i = 0; i < 3; i++) { const lk = p[i] + '|' + p[i + 1]; sub[lk] = (sub[lk] ?? 0) + 1 }
    }
    return { sub, hit }
  }, [sel, rows, spec])

  const color = (l: Link) => (l.stage === 2 ? spec.statusColor[l.t.slice(2)] : 'var(--accent)')
  const dots = React.useMemo(() => {
    if (!dotsOn || reduced()) return ''
    let html = ''
    L.links.forEach((l, idx) => {
      if (!l.n) return
      const c = Math.min(3, Math.ceil(l.n / spec.dotDivisor)), ym0 = l.y0 + l.w / 2, ym1 = l.y1 + l.w / 2, xm = (l.x0 + l.x1) / 2
      const path = `M${f1(l.x0)} ${f1(ym0)} C${f1(xm)} ${f1(ym0)} ${f1(xm)} ${f1(ym1)} ${f1(l.x1)} ${f1(ym1)}`
      for (let i = 0; i < c; i++) {
        const dur = 4.2 + ((idx * 7 + i * 13) % 10) / 4, begin = -(((idx * 3 + i * 5) % 17) / 17) * dur
        html += `<circle r="${l.stage === 2 ? 2.4 : 2.1}" style="fill:${color(l)}"><animateMotion dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" path="${path}"/></circle>`
      }
    })
    return html
  }, [dotsOn, L]) // eslint-disable-line react-hooks/exhaustive-deps

  const hx = [L.xs[0].x - 40, L.xs[1].x + L.xs[1].w / 2, L.xs[2].x + L.xs[2].w / 2, L.xs[3].x + 70]

  return (
    <div className="flow-scroll">
      <div className="flow-slot" ref={slot}>
        <svg className={`flow-svg${reveal && !reduced() ? ' reveal' : ''}${sel ? ' tracing' : ''}`} viewBox={`0 0 ${L.W} ${L.H}`} width={L.W} height={L.H}
          role="img" aria-label={`Flow of ${L.N} grievances from ${spec.heads[0]} to ${spec.heads[3]}`}
          onMouseLeave={() => setHover(null)}>
          <defs><clipPath id={`rv-${spec.heads[1].replace(/\W/g, '')}`}><rect className="fl-reveal" x={0} y={0} height={600} width={L.W} /></clipPath></defs>
          <g className="fl-heads">
            {spec.heads.map((t, i) => <text key={i} className="fl-head" x={hx[i]} y={22} textAnchor="middle">{`${i + 1} · ${t}`.toUpperCase()}</text>)}
          </g>
          <g className="fl-bands" clipPath={`url(#rv-${spec.heads[1].replace(/\W/g, '')})`}>
            {L.links.map((l) => {
              const d = bandD(l.x0, l.y0, l.x1, l.y1, l.w)
              return (
                <path key={l.key} className={`fl-band s${l.stage}`} d={d} style={{ d: `path("${d}")`, ...(l.stage === 2 ? { fill: color(l) } : {}) } as React.CSSProperties}>
                  <title>{`${l.n} · ${spec.name(l.s)} → ${spec.name(l.t)}`}</title>
                </path>
              )
            })}
          </g>
          <g className="fl-traces">
            {trace && L.links.map((l) => {
              const n = trace.sub[l.key] ?? 0
              const d = bandD(l.x0, l.y0, l.x1, l.y1, n * L.k)
              return <path key={l.key} className={`fl-trace s${l.stage}`} d={d} style={{ d: `path("${d}")`, fill: color(l), opacity: n ? 1 : 0 } as React.CSSProperties} />
            })}
          </g>
          <g className="fl-dots" clipPath={`url(#rv-${spec.heads[1].replace(/\W/g, '')})`} dangerouslySetInnerHTML={{ __html: dots }} />
          <g className="fl-nodes">
            {L.cols.flatMap((col, ci) => col.map((key) => {
              const nd = L.nodes[key]
              const share = L.N ? Math.round((nd.n / L.N) * 100) : 0
              const cls = `fl-node c${ci}${nd.n === 0 ? ' empty' : ''}${trace?.hit[key] ? ' hit' : ''}${key === sel ? ' sel' : ''}`
              const events = {
                onMouseEnter: () => setHover(key),
                onClick: () => key !== 'h' && onLock(key === lock ? null : key),
              }
              if (ci === 0 || ci === 3) {
                return (
                  <g key={key} className={cls} style={{ transform: `translate(${f1(nd.x)}px,${f1(nd.y)}px)` }} {...events}>
                    <rect className="fl-bar" x={0} y={0} width={12} rx={2} style={{ height: Math.max(0, nd.h), ...(ci === 3 ? { fill: spec.statusColor[key.slice(2)] } : {}) }} />
                    {Math.abs(nd.ly - (nd.y + nd.h / 2)) > 2 && (
                      <path className="fl-leader" d={ci === 0 ? `M-2 ${f1(nd.h / 2)} L-10 ${f1(nd.ly - nd.y)}` : `M14 ${f1(nd.h / 2)} L22 ${f1(nd.ly - nd.y)}`} />
                    )}
                    <g className="fl-lab" style={{ transform: `translate(0px,${f1(nd.ly - nd.y)}px)` }}>
                      <text className="fl-name" x={ci === 0 ? -14 : 26} y={-3} textAnchor={ci === 0 ? 'end' : 'start'}>{trunc(spec.name(key), ci === 0 ? 27 : 26)}<title>{spec.name(key)}</title></text>
                      <text className="fl-sub" x={ci === 0 ? -14 : 26} y={14} textAnchor={ci === 0 ? 'end' : 'start'}>{nd.n.toLocaleString('en-IN')} · {share}%</text>
                    </g>
                    <title>{`${nd.n} grievances · ${spec.name(key)} · ${share}% — click to trace`}</title>
                  </g>
                )
              }
              if (ci === 1) {
                const hh = Math.max(64, nd.h), off = nd.h < 64 ? (64 - nd.h) / 2 : 0
                return (
                  <g key={key} className={cls} style={{ transform: `translate(${f1(nd.x)}px,${f1(nd.y - off)}px)` }} {...events}>
                    <rect className="fl-hub" x={0} y={0} rx={16} style={{ width: nd.w, height: hh }} />
                    <g className="fl-lab" style={{ transform: `translate(${nd.w / 2}px,${f1(hh / 2)}px)` }}>
                      <text className="fl-big" y={2} textAnchor="middle"><Tw v={nd.n} /></text>
                      <text className="fl-hubsub" y={24} textAnchor="middle">{spec.hubSub}</text>
                    </g>
                  </g>
                )
              }
              const hh = Math.max(0, nd.h), chip = spec.chip(nd.rows)
              const tall = nd.h >= 40
              const nameMax = Math.floor((nd.w - 30 - String(nd.n).length * 9) / 7.4)
              return (
                <g key={key} className={`${cls}${nd.h < 20 ? ' tight' : ''}`} style={{ transform: `translate(${f1(nd.x)}px,${f1(nd.y)}px)` }} {...events}>
                  <rect className="fl-box" x={0} y={0} rx={7} style={{ width: nd.w, height: hh }} />
                  <rect className="fl-tab" x={0} y={0} width={4} rx={2} style={{ height: hh }} />
                  <g className="fl-lab" style={{ transform: `translate(0px,${f1(nd.h / 2)}px)` }}>
                    <text className="fl-name" x={16} y={tall && chip > 0 ? -4 : 4.5}>{trunc(spec.name(key), nameMax)}</text>
                    {chip > 0 && tall && (
                      <g className="fl-chip" transform="translate(16,14)">
                        <rect height={17} rx={4} y={-8.5} x={0} width={14 + `${chip} ${spec.chipLabel}`.length * 6.1} />
                        <text y={3.8} x={7}>{chip} {spec.chipLabel}</text>
                      </g>
                    )}
                    {chip > 0 && !tall && <circle className="fl-chipdot" cx={nd.w - 18 - String(nd.n).length * 8.6} cy={0} r={3.5} />}
                    <text className="fl-count" x={nd.w - 12} y={5} textAnchor="end"><Tw v={nd.n} /></text>
                  </g>
                  <title>{`${nd.n} grievances · ${spec.name(key)} · ${chip} ${spec.chipLabel} — click to trace`}</title>
                </g>
              )
            }))}
          </g>
        </svg>
      </div>
    </div>
  )
}
