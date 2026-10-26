import * as React from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Minus, Table2, BarChart3, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Hint } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { fmt } from '@/data'

/* ------------------------------------------------------------------ page header */
export function PageHeader({ title, description, children, eyebrow }: { title: string; description?: React.ReactNode; children?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ KPI */
export type Tone = 'neutral' | 'good' | 'warning' | 'critical'
const toneIcon: Record<Tone, React.ReactNode> = {
  neutral: null,
  good: <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-good)]" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-warning)]" />,
  critical: <XCircle className="h-3.5 w-3.5 text-[var(--status-critical)]" />,
}
const toneLabel: Record<Tone, string> = { neutral: '', good: 'On track', warning: 'Watch', critical: 'Needs attention' }

export function Kpi({
  label, value, unit, sub, tone = 'neutral', compare, hint, onClick, className,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  sub?: React.ReactNode
  tone?: Tone
  compare?: { text: string; dir?: 'up' | 'down' | 'flat'; good?: boolean }
  hint?: string
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Card className={cn('group relative overflow-hidden', onClick && 'transition hover:border-primary/30 hover:shadow-md', className)}>
      <Comp onClick={onClick} className="flex h-full w-full flex-col gap-2 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
          {tone !== 'neutral' && (
            <Hint label={toneLabel[tone]}>
              <span className="inline-flex" aria-label={toneLabel[tone]}>{toneIcon[tone]}</span>
            </Hint>
          )}
          {hint && tone === 'neutral' && (
            <Hint label={hint}><Info className="h-3.5 w-3.5 text-muted-foreground/60" /></Hint>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[26px] font-semibold leading-none tracking-tight text-foreground">{value}</span>
          {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          {compare && <Delta {...compare} />}
          {sub && <span className="leading-snug">{sub}</span>}
        </div>
      </Comp>
    </Card>
  )
}

export function Delta({ text, dir = 'flat', good }: { text: string; dir?: 'up' | 'down' | 'flat'; good?: boolean }) {
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus
  const color = good === undefined ? 'text-muted-foreground' : good ? 'text-[var(--good-ink)]' : 'text-[var(--critical-ink)]'
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium', color)}>
      <Icon className="h-3.5 w-3.5" />{text}
    </span>
  )
}

export function KpiGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const c = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-3 xl:grid-cols-6' }[cols]
  return <div className={cn('grid grid-cols-2 gap-3', c)}>{children}</div>
}

/* ------------------------------------------------------------------ chart card */
export interface TableView { columns: string[]; rows: (string | number | null)[][] }

export function ChartCard({
  title, description, children, action, footer, table, className, contentClassName, interactive,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
  footer?: React.ReactNode
  table?: TableView
  className?: string
  contentClassName?: string
  interactive?: boolean
}) {
  const [asTable, setAsTable] = React.useState(false)
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
          {action && <div className="mt-2 sm:hidden">{action}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action && <div className="hidden sm:block">{action}</div>}
          {table && (
            <Hint label={asTable ? 'Show chart' : 'Show as table'}>
              <button onClick={() => setAsTable((v) => !v)} aria-label={asTable ? 'Show chart' : 'Show as table'}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {asTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
              </button>
            </Hint>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('flex-1', contentClassName)}>
        {asTable && table ? <MiniTable {...table} /> : children}
      </CardContent>
      {(footer || interactive) && (
        <div className="flex items-center gap-1.5 border-t px-5 py-2.5 text-[12px] text-muted-foreground">
          {footer ?? <><Info className="h-3.5 w-3.5" /> Click a bar to filter the whole dashboard.</>}
        </div>
      )}
    </Card>
  )
}

export function MiniTable({ columns, rows }: TableView) {
  return (
    <div className="max-h-[360px] overflow-auto rounded-lg border scrollbar-thin">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>{columns.map((c, i) => <th key={c} className={cn('px-3 py-2 font-medium text-muted-foreground', i ? 'text-right' : 'text-left')}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((v, j) => <td key={j} className={cn('px-3 py-1.5', j ? 'text-right tabular' : 'text-left')}>{typeof v === 'number' ? fmt(v, Number.isInteger(v) ? 0 : 1) : v ?? '–'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ small pieces */
export function Section({ title, description, children, className }: { title?: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      {title && (
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Callout({ tone = 'info', title, children, className }: { tone?: 'info' | 'warning' | 'critical' | 'good'; title?: string; children: React.ReactNode; className?: string }) {
  const map = {
    info: { bar: 'bg-[var(--series-1)]', icon: <Info className="h-4 w-4 text-[var(--series-1)]" /> },
    warning: { bar: 'bg-[var(--status-warning)]', icon: <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" /> },
    critical: { bar: 'bg-[var(--status-critical)]', icon: <XCircle className="h-4 w-4 text-[var(--status-critical)]" /> },
    good: { bar: 'bg-[var(--status-good)]', icon: <CheckCircle2 className="h-4 w-4 text-[var(--status-good)]" /> },
  }[tone]
  return (
    <div className={cn('relative flex gap-3 overflow-hidden rounded-lg border bg-card p-3.5 pl-4 text-sm', className)}>
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', map.bar)} />
      <span className="mt-0.5 shrink-0">{map.icon}</span>
      <div className="min-w-0 space-y-0.5">
        {title && <div className="font-medium text-foreground">{title}</div>}
        <div className="text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

export function DaysPill({ days, pending, sla = 21 }: { days: number | null | undefined; pending?: boolean; sla?: number }) {
  if (days == null) return <span className="text-muted-foreground">–</span>
  const v = days > 60 ? 'critical' : days > sla ? 'warning' : 'good'
  return <Badge variant={v} className="tabular">{fmt(days)}d{pending ? ' old' : ''}</Badge>
}

export function StatusPill({ disposed }: { disposed: boolean }) {
  return disposed
    ? <Badge variant="secondary" className="gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--status-good)]" />Disposed</Badge>
    : <Badge variant="secondary" className="gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]" />Pending</Badge>
}

export function QualityPill({ band, score }: { band: string | null; score?: number | null }) {
  if (!band) return <span className="text-muted-foreground">–</span>
  const v = band === 'Good' ? 'good' : band === 'Fair' ? 'warning' : 'critical'
  return <Badge variant={v}>{band}{score != null ? ` · ${fmt(score, 1)}` : ''}</Badge>
}

export function Empty({ children = 'No grievances match the current filters.' }: { children?: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{children}</div>
}

export function Legend({ items }: { items: { label: string; color: string; shape?: 'square' | 'line' }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.shape === 'line'
            ? <span className="h-0.5 w-3.5 rounded" style={{ background: i.color }} />
            : <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ how we measure */
export function MeasureNote({ items }: { items: { term: string; def: React.ReactNode }[] }) {
  return (
    <details className="group rounded-xl border bg-card px-5 py-3 text-[13px] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-muted-foreground hover:text-foreground">
        <Info className="h-4 w-4" />How we measure this
        <span className="ml-auto text-[12px] font-normal group-open:hidden">Show</span>
        <span className="ml-auto hidden text-[12px] font-normal group-open:inline">Hide</span>
      </summary>
      <dl className="mt-3 grid gap-x-8 gap-y-2.5 pb-1 md:grid-cols-2">
        {items.map((i) => (
          <div key={i.term}>
            <dt className="font-medium text-foreground">{i.term}</dt>
            <dd className="text-muted-foreground leading-relaxed">{i.def}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/* ------------------------------------------------------------------ clickable number */
export function CaseLink({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={cn('rounded font-semibold text-foreground underline decoration-dotted decoration-muted-foreground/60 underline-offset-[3px] transition hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
      {children}
    </button>
  )
}

export function Finding({ n, title, children, action }: { n: number; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">{n}</span>
      <div className="min-w-0 space-y-1">
        <div className="text-[14.5px] font-semibold leading-snug text-foreground">{title}</div>
        {children && <div className="text-[13px] leading-relaxed text-muted-foreground">{children}</div>}
        {action}
      </div>
    </div>
  )
}
