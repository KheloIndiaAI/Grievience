import * as React from 'react'
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts'
import { fmt } from '@/data'
import { cn } from '@/lib/utils'
import { Hint } from '@/components/ui/tooltip'
import { TipBox } from './Charts'

/* ------------------------------------------------------------------ segmented (stacked) bar */
export interface Segment { key: string; label: string; value: number; color: string; hint?: string }

export function SegmentBar({ segments, total, height = 14, showLabels = true, format = (v: number) => fmt(v), className }: {
  segments: Segment[]
  total?: number
  height?: number
  showLabels?: boolean
  format?: (v: number) => string
  className?: string
}) {
  const t = total ?? segments.reduce((s, x) => s + x.value, 0)
  return (
    <div className={cn('w-full', className)}>
      <div className="flex w-full gap-[2px] overflow-hidden rounded-md" style={{ height }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <Hint key={s.key} label={<span><b>{s.label}</b>: {format(s.value)}{s.hint ? ` · ${s.hint}` : ''}</span>}>
            <span className="block h-full first:rounded-l-md last:rounded-r-md transition-[width] duration-500" style={{ width: `${(s.value / t) * 100}%`, background: s.color }} />
          </Hint>
        ))}
      </div>
      {showLabels && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {segments.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
              <span className="font-medium tabular text-foreground">{format(s.value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ heat table */
export function HeatTable({ rows, cols, value, rowLabel, colLabel, onCell, format = (v: number) => fmt(v), max }: {
  rows: string[]
  cols: string[]
  value: (r: string, c: string) => number
  rowLabel?: (r: string) => React.ReactNode
  colLabel?: (c: string) => React.ReactNode
  onCell?: (r: string, c: string) => void
  format?: (v: number) => string
  max?: number
}) {
  const m = max ?? Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))))
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="h-24 min-w-[44px] align-bottom font-medium text-muted-foreground">
                <div className="mx-auto w-4 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-left leading-tight">{colLabel ? colLabel(c) : c}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th className="whitespace-nowrap pr-2 text-left font-normal text-foreground">{rowLabel ? rowLabel(r) : r}</th>
              {cols.map((c) => {
                const v = value(r, c)
                const a = v ? 0.12 + 0.88 * (v / m) : 0
                return (
                  <td key={c} className="p-0">
                    <button
                      disabled={!v || !onCell}
                      onClick={() => onCell?.(r, c)}
                      className={cn('flex h-8 w-full items-center justify-center rounded-[4px] tabular transition', v ? 'hover:ring-2 hover:ring-ring/50' : 'bg-muted/40 text-transparent')}
                      style={v ? { background: `color-mix(in srgb, var(--seq-550) ${Math.round(a * 100)}%, transparent)`, color: a > 0.55 ? '#fff' : 'hsl(var(--foreground))' } : undefined}
                      title={`${r} × ${c}: ${format(v)}`}
                    >
                      {v ? format(v) : '·'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ flow (sankey) */
export interface FlowData { nodes: { name: string; color?: string }[]; links: { source: number; target: number; value: number }[] }

function FlowNode(props: any) {
  const { x, y, width, height, index, payload, containerWidth } = props
  const isRight = x + width + 6 > containerWidth - 160
  const color = payload.color ?? 'var(--series-1)'
  return (
    <Layer key={`n${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} radius={2} />
      {height > 7 && (
        <text
          x={isRight ? x - 6 : x + width + 6}
          y={y + height / 2}
          textAnchor={isRight ? 'end' : 'start'}
          dominantBaseline="middle"
          fontSize={11}
          fill="var(--chart-ink)"
        >
          {payload.name} <tspan fill="var(--chart-muted)">{fmt(payload.value)}</tspan>
        </text>
      )}
    </Layer>
  )
}

export function FlowChart({ data, height = 380 }: { data: FlowData; height?: number }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [w, setW] = React.useState(1000)
  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  if (!data.links.length) return null
  return (
    <div ref={ref} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          nodePadding={14}
          nodeWidth={8}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          link={{ stroke: 'var(--seq-350)', strokeOpacity: 0.28 }}
          node={<FlowNode containerWidth={w} />}
          iterations={48}
        >
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p: any = payload[0].payload
            if (p.source && p.target) return <TipBox title={`${p.source.name} → ${p.target.name}`} rows={[{ label: 'Grievances', value: fmt(p.value) }]} />
            return <TipBox title={p.name} rows={[{ label: 'Grievances', value: fmt(p.value) }]} />
          }} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
