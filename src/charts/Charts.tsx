import * as React from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Area, ComposedChart, Label,
} from 'recharts'
import { fmt } from '@/data'
import { cn } from '@/lib/utils'

export const AXIS = { stroke: 'var(--chart-axis)', tick: { fill: 'var(--chart-muted)', fontSize: 11 }, tickLine: false } as const
export const GRID = { stroke: 'var(--chart-grid)', vertical: false } as const

/* ------------------------------------------------------------------ tooltip */
export function TipBox({ title, rows }: { title?: React.ReactNode; rows: { label: string; value: React.ReactNode; color?: string }[] }) {
  return (
    <div className="min-w-[150px] rounded-lg border bg-popover px-3 py-2 text-[12px] text-popover-foreground shadow-lg">
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              {r.color && <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-medium tabular text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ column chart */
export interface ColumnDatum {
  key: string
  label: string
  value: number
  color?: string
  tip?: { label: string; value: React.ReactNode }[]
  dim?: boolean
}

export function ColumnChart({
  data, height = 240, valueLabel = 'Grievances', onSelect, format = (v: number) => fmt(v), showValues = true, refLine, yMax, color = 'var(--series-1)', className, barSize,
}: {
  data: ColumnDatum[]
  height?: number
  valueLabel?: string
  onSelect?: (key: string) => void
  format?: (v: number) => string
  showValues?: boolean
  refLine?: { y: number; label: string }
  yMax?: number
  color?: string
  className?: string
  barSize?: number
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: showValues ? 20 : 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval={0} tickMargin={6} />
          <YAxis {...AXIS} axisLine={false} width={48} tickFormatter={(v) => format(v)} domain={[0, yMax ?? 'auto']} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as ColumnDatum
              return <TipBox title={d.label} rows={[{ label: valueLabel, value: format(d.value), color: d.color ?? color }, ...(d.tip ?? [])]} />
            }}
          />
          {refLine && (
            <ReferenceLine y={refLine.y} stroke="var(--chart-ink)" strokeOpacity={0.5}>
              <Label value={refLine.label} position="insideTopRight" fill="var(--chart-muted)" fontSize={11} />
            </ReferenceLine>
          )}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={(d: any) => onSelect?.(d.key)} cursor={onSelect ? 'pointer' : undefined} maxBarSize={barSize ?? 56} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.key} fill={d.color ?? color} fillOpacity={d.dim ? 0.35 : 1} />)}
            {showValues && <LabelList dataKey="value" position="top" formatter={(v: number) => format(v)} fill="var(--chart-ink)" fontSize={11} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ trend (single measure) */
export function TrendChart({
  data, height = 200, format = (v: number) => fmt(v), color = 'var(--series-1)', valueLabel, domain, refLine, area, dashedFrom,
}: {
  data: { key: string; label: string; value: number | null; note?: string }[]
  height?: number
  format?: (v: number) => string
  color?: string
  valueLabel: string
  domain?: [number, number]
  refLine?: { y: number; label: string }
  area?: boolean
  /** index from which points are provisional (e.g. current month) */
  dashedFrom?: number
}) {
  const solid = data.map((d, i) => ({ ...d, solid: dashedFrom != null && i >= dashedFrom ? null : d.value, prov: dashedFrom != null && i >= dashedFrom - 1 ? d.value : null }))
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={solid} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval={0} tickMargin={6} />
          <YAxis {...AXIS} axisLine={false} width={48} tickFormatter={(v) => format(v)} domain={domain ?? [0, 'auto']} />
          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return <TipBox title={d.label} rows={[{ label: valueLabel, value: d.value == null ? '–' : format(d.value), color }, ...(d.note ? [{ label: 'Note', value: d.note }] : [])]} />
            }}
          />
          {refLine && (
            <ReferenceLine y={refLine.y} stroke="var(--chart-ink)" strokeOpacity={0.45}>
              <Label value={refLine.label} position="insideTopLeft" fill="var(--chart-muted)" fontSize={11} />
            </ReferenceLine>
          )}
          {area
            ? <Area type="monotone" dataKey="solid" stroke={color} strokeWidth={2} fill="url(#trendFill)" dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            : <Line type="monotone" dataKey="solid" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />}
          {dashedFrom != null && (
            <Line type="monotone" dataKey="prov" stroke={color} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: 'var(--chart-surface)', stroke: color, strokeWidth: 1.5 }} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ grouped columns (2 series, same unit) */
export function PairColumns({
  data, a, b, height = 240, onSelect,
}: {
  data: { key: string; label: string; a: number; b: number; note?: string }[]
  a: { label: string; color: string }
  b: { label: string; color: string }
  height?: number
  onSelect?: (key: string) => void
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval={0} tickMargin={6} />
          <YAxis {...AXIS} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return <TipBox title={d.label} rows={[{ label: a.label, value: fmt(d.a), color: a.color }, { label: b.label, value: fmt(d.b), color: b.color }, ...(d.note ? [{ label: 'Note', value: d.note }] : [])]} />
            }}
          />
          <Bar dataKey="a" fill={a.color} radius={[4, 4, 0, 0]} maxBarSize={28} onClick={(d: any) => onSelect?.(d.key)} cursor={onSelect ? 'pointer' : undefined} isAnimationActive={false} />
          <Bar dataKey="b" fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={28} onClick={(d: any) => onSelect?.(d.key)} cursor={onSelect ? 'pointer' : undefined} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ quadrant scatter */
export interface QuadPoint { key: string; label: string; x: number; y: number; n: number; color?: string }

export function QuadrantScatter({
  data, xLabel, yLabel, xRef, yRef, height = 340, onSelect, xFormat = (v: number) => fmt(v), yFormat = (v: number) => fmt(v, 1), quadrantLabels,
}: {
  data: QuadPoint[]
  xLabel: string
  yLabel: string
  xRef: number
  yRef: number
  height?: number
  onSelect?: (key: string) => void
  xFormat?: (v: number) => string
  yFormat?: (v: number) => string
  quadrantLabels?: [string, string, string, string] // TL, TR, BL, BR
}) {
  const maxX = Math.max(xRef * 2, ...data.map((d) => d.x)) * 1.08
  return (
    <div className="relative w-full" style={{ height }}>
      {quadrantLabels && (
        <div className="pointer-events-none absolute inset-0 z-[1] grid grid-cols-2 grid-rows-2 pb-[52px] pl-[52px] pr-5 pt-3 text-[11px] font-medium text-muted-foreground/80">
          <span>{quadrantLabels[0]}</span><span className="text-right">{quadrantLabels[1]}</span>
          <span className="self-end">{quadrantLabels[2]}</span><span className="self-end text-right">{quadrantLabels[3]}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: -4, bottom: 14 }}>
          <CartesianGrid stroke="var(--chart-grid)" />
          <XAxis type="number" dataKey="x" {...AXIS} domain={[0, Math.ceil(maxX / 5) * 5]} tickFormatter={xFormat}>
            <Label value={xLabel} position="insideBottom" offset={-10} fill="var(--chart-muted)" fontSize={11} />
          </XAxis>
          <YAxis type="number" dataKey="y" {...AXIS} domain={[0, 5]} width={34} tickFormatter={yFormat} ticks={[0, 1, 2, 3, 4, 5]} />
          <ZAxis type="number" dataKey="n" range={[60, 700]} />
          <ReferenceLine x={xRef} stroke="var(--chart-ink)" strokeOpacity={0.4} />
          <ReferenceLine y={yRef} stroke="var(--chart-ink)" strokeOpacity={0.4} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as QuadPoint
              return <TipBox title={d.label} rows={[{ label: 'Cases', value: fmt(d.n) }, { label: xLabel, value: xFormat(d.x) }, { label: yLabel, value: yFormat(d.y) }]} />
            }}
          />
          <Scatter data={data} onClick={(d: any) => onSelect?.(d.key)} cursor={onSelect ? 'pointer' : undefined} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.key} fill={d.color ?? 'var(--series-1)'} fillOpacity={0.78} stroke="var(--chart-surface)" strokeWidth={2} />)}
            <LabelList dataKey="label" content={(p: any) => (p.value ? (
              <text x={p.x + p.width + 4} y={p.y + p.height / 2} dominantBaseline="middle" fontSize={11} fill="var(--chart-ink)" style={{ paintOrder: 'stroke', stroke: 'var(--chart-surface)', strokeWidth: 3 }}>{p.value}</text>
            ) : null)} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
