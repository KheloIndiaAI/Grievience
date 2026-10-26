import * as React from 'react'
import { Undo2, Send, CheckCircle2 } from 'lucide-react'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { PageHeader, ChartCard, Section, MeasureNote, Callout, Kpi, KpiGrid } from '@/components/kit'
import { Card } from '@/components/ui/card'
import { BarList } from '@/charts/BarList'
import { ColumnChart } from '@/charts/Charts'
import { SegmentBar } from '@/charts/Composite'
import { DataTable, type Column } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { medianOf, pctOf, SLA } from '@/lib/exec'
import { fmt, fmtPct, groupBy, mean, median, pct } from '@/data'
import { TRANSFER_BUCKETS, themeOrder, UNREAD_THEME } from '@/lib/labels'

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

interface Bounce { g: Grievance; sender: string | null; bouncer: string | null; lost: number | null }

export function RoutingPage() {
  const { rows, showCases, office } = useStore()
  const D = rows.filter((r) => r.disposed)
  const panel = (title: string, rs: Grievance[], description?: string, preview: 'reply' | 'grievance' = 'grievance') => showCases({ title, rows: rs, description, preview })

  /* every bounce event */
  const bounces: Bounce[] = React.useMemo(() => {
    const out: Bounce[] = []
    for (const r of rows) {
      r.steps.forEach((s, i) => {
        if (!/not pertaining/i.test(s.action)) return
        const sent = [...r.steps.slice(0, i)].reverse().find((x) => x.to === s.from)
        const next = r.steps.slice(i + 1).find((x) => x.from === s.to)
        out.push({ g: r, sender: s.to, bouncer: s.from, lost: sent && next ? Math.max(0, dayDiff(sent.date, next.date)) : null })
      })
    }
    return out
  }, [rows])
  const bounced = rows.filter((r) => r.misroutes > 0)
  const multi = rows.filter((r) => r.misroutes > 1)
  const lost = bounces.map((b) => b.lost).filter((x): x is number => x != null)
  const medB = medianOf(D.filter((r) => r.misroutes > 0), (r) => r.days)
  const medN = medianOf(D.filter((r) => !r.misroutes), (r) => r.days)

  /* pairs */
  const pairs = React.useMemo(() => [...groupBy(bounces, (b) => `${b.sender}|${b.bouncer}`).entries()].map(([k, bs]) => {
    const [s, b] = k.split('|')
    const cases = [...new Map(bs.map((x) => [x.g.id, x.g])).values()]
    const finals = [...groupBy(cases.filter((g) => g.disposed), (g) => g.owner).entries()].map(([o, gs]) => ({ o, n: gs.length })).sort((a, b) => b.n - a.n)
    return { key: k, sender: office(s), bouncer: office(b), n: bs.length, cases, lost: median(bs.map((x) => x.lost).filter((x): x is number => x != null)), finals }
  }).sort((a, b) => b.n - a.n), [bounces, office])

  const byBouncer = [...groupBy(bounces, (b) => b.bouncer).entries()].map(([k, bs]) => ({ key: k, n: bs.length, cases: [...new Set(bs.map((b) => b.g))] })).sort((a, b) => b.n - a.n)
  const themes = themeOrder([...groupBy(rows, (r) => r.theme).entries()].map(([k, rs]) => ({ key: k, n: rs.length, b: pctOf(rs, (r) => r.misroutes > 0) ?? 0, rows: rs })).filter((t) => t.n >= 10), (t) => t.key, (t) => t.b)
  const sources = [...groupBy(rows, (r) => r.source).entries()].map(([k, rs]) => ({ key: k, n: rs.length, b: pctOf(rs, (r) => r.misroutes > 0) ?? 0, rows: rs })).sort((a, b) => b.b - a.b)
  const byHops = TRANSFER_BUCKETS.map((b) => { const rs = rows.filter((r) => r.transferBucket === b); return { key: b, rows: rs, med: medianOf(rs.filter((r) => r.disposed), (r) => r.days) ?? 0 } })
  const toDesk = mean(D.map((r) => r.daysToDesk).filter((x): x is number => x != null)) ?? 0
  const atDesk = mean(D.map((r) => r.daysAtDesk).filter((x): x is number => x != null)) ?? 0

  const pairCols: Column<(typeof pairs)[number]>[] = [
    { key: 'sender', header: 'Sent by', cell: (p) => p.sender, sort: (p) => p.sender, className: 'whitespace-nowrap' },
    { key: 'bouncer', header: 'Sent back by', cell: (p) => <span className="font-medium">{p.bouncer}</span>, sort: (p) => p.bouncer, className: 'whitespace-nowrap' },
    { key: 'n', header: 'Bounces', align: 'right', cell: (p) => <Badge variant="warning" className="tabular">{p.n}</Badge>, sort: (p) => p.n },
    { key: 'lost', header: 'Days lost', align: 'right', cell: (p) => (p.lost == null ? '–' : `${fmt(p.lost)}d`), sort: (p) => p.lost, hideBelow: 'sm' },
    { key: 'final', header: 'Where they finally went', hideBelow: 'md', cell: (p) => <span className="text-[12px] text-muted-foreground">{p.finals.slice(0, 2).map((f) => `${f.o} (${f.n})`).join(', ') || 'Still pending'}</span> },
  ]

  return (
    <>
      <PageHeader eyebrow="Routing & bounces" title="How grievances move between offices"
        description="Which offices send grievances back, why that matters, and where the bounced grievances finally ended up. Click any row or bar to read the grievances." />

      <Card className="p-5">
        <div className="mb-3 text-[13px] font-semibold">What is a bounce?</div>
        <div className="flex flex-col gap-3 text-[13px] md:flex-row md:items-center">
          <span className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"><Send className="h-4 w-4 text-[var(--series-1)]" />Desk sends the grievance to an office</span>
          <span className="hidden text-muted-foreground md:inline">→</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-[color:color-mix(in_srgb,var(--status-serious)_50%,transparent)] px-3 py-2"><Undo2 className="h-4 w-4 text-[var(--status-serious)]" />The office sends it back: “Not pertaining to this organisation”</span>
          <span className="hidden text-muted-foreground md:inline">→</span>
          <span className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"><CheckCircle2 className="h-4 w-4 text-[var(--status-good)]" />Desk re-sends it to another office</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Each such return is one <b className="text-foreground">bounce</b>. A grievance can bounce several times. <b className="text-foreground">Days lost</b> = days from the moment it was sent to the wrong office until the desk sent it on again.
        </p>
      </Card>

      <KpiGrid cols={4}>
        <Kpi label="Grievances bounced" value={fmtPct(pct(bounced.length, rows.length), 0)} tone="warning" sub={`${fmt(bounced.length)} of ${fmt(rows.length)} · ${fmt(bounces.length)} bounces in all`}
          onClick={() => panel('Bounced grievances', bounced)} />
        <Kpi label="Bounced more than once" value={fmt(multi.length)} tone={multi.length ? 'critical' : 'good'} sub={`${fmt(rows.filter((r) => r.misroutes >= 3).length)} bounced 3 or more times`}
          onClick={() => panel('Bounced more than once', multi)} />
        <Kpi label="Days lost per bounce" value={fmt(median(lost))} unit="days median" sub={`Average ${fmt(mean(lost), 1)} days · ${fmt(lost.reduce((a, b) => a + b, 0))} days in all`} />
        <Kpi label="Time to dispose" value={`${fmt(medB)} vs ${fmt(medN)}`} unit="days" tone="critical" sub="Median: bounced vs not bounced" />
      </KpiGrid>

      <Section title="Who sends grievances back, and where they should have gone">
        <ChartCard title="Bounce routes" description="Each row is a route that failed: the office that sent the grievance, the office that sent it back, and the offices that finally disposed of those grievances. These are the routing rules to fix. Click a row to read the grievances."
          footer={<>“Days lost” is the median for that route. A pending grievance shows as “Still pending”.</>}>
          <DataTable rows={pairs} columns={pairCols} rowKey={(p) => p.key} pageSize={12} dense initialSort={{ key: 'n', dir: 'desc' }}
            onRowClick={(p) => panel(`${p.sender} → sent back by ${p.bouncer}`, p.cases)} />
        </ChartCard>
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <ChartCard title="Offices that send back most" description="Number of “not pertaining” returns.">
            <BarList compact limit={10} valueHeader="Bounces" extraHeaders={['Cases']} color="var(--status-serious)"
              items={byBouncer.map((b) => ({ key: b.key ?? '–', label: office(b.key), value: b.n, extra: [fmt(b.cases.length)] }))}
              onSelect={(k) => panel(`Sent back by ${office(k)}`, byBouncer.find((b) => b.key === k)!.cases)} />
          </ChartCard>
          <ChartCard title="Bounce rate by theme" description="Share of each theme’s grievances bounced at least once (themes with 10+).">
            <BarList compact valueFormat={(v) => `${Math.round(v)}%`} max={100} valueHeader="Bounced"
              items={themes.map((t) => ({ key: t.key, value: t.b, muted: t.key === UNREAD_THEME, color: t.b >= 40 ? 'var(--status-critical)' : t.b >= 25 ? 'var(--status-serious)' : 'var(--series-1)' }))}
              onSelect={(k) => panel(`Bounced — ${k}`, themes.find((t) => t.key === k)!.rows.filter((r) => r.misroutes > 0))} />
          </ChartCard>
          <ChartCard title="Bounce rate by entry point" description="Where the grievance came in.">
            <BarList compact valueFormat={(v) => `${Math.round(v)}%`} max={100} valueHeader="Bounced" extraHeaders={['Cases']}
              items={sources.map((s) => ({ key: s.key, value: s.b, extra: [fmt(s.n)], color: s.b >= 40 ? 'var(--status-critical)' : s.b >= 25 ? 'var(--status-serious)' : 'var(--series-1)' }))}
              onSelect={(k) => panel(`Bounced — came from ${k}`, sources.find((s) => s.key === k)!.rows.filter((r) => r.misroutes > 0))} />
          </ChartCard>
        </div>
      </Section>

      <Section title="What hand-offs cost">
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <ChartCard title="More hand-offs, longer wait" description="Median days to dispose by number of manual transfers. Click a bar to read those grievances."
            table={{ columns: ['Transfers', 'Grievances', 'Median days'], rows: byHops.map((b) => [b.key, b.rows.length, b.med]) }}>
            <ColumnChart height={230} valueLabel="Median days"
              data={byHops.map((b) => ({ key: b.key, label: b.key === '0' ? 'None' : b.key, value: b.med, color: b.med > SLA ? 'var(--status-critical)' : 'var(--series-1)', tip: [{ label: 'Grievances', value: fmt(b.rows.length) }] }))}
              onSelect={(k) => panel(`${k === '0' ? 'No' : k} manual transfer${k === '1' ? '' : 's'}`, byHops.find((b) => b.key === k)!.rows)} />
          </ChartCard>
          <ChartCard title="Where a grievance’s time goes" description="Average days for disposed grievances: reaching the office that finally replied, then waiting there.">
            <SegmentBar height={20} format={(v) => `${fmt(v, 1)} days`} segments={[
              { key: 'to', label: 'Reaching the right office', value: toDesk, color: 'var(--status-serious)' },
              { key: 'at', label: 'Waiting at that office', value: atDesk, color: 'var(--series-1)' },
            ]} />
            <Callout className="mt-4" tone="info">
              {fmtPct(pct(toDesk, toDesk + atDesk), 0)} of the time goes in reaching the right office; the rest is waiting at it. Fewer bounces shorten the first part directly.
            </Callout>
          </ChartCard>
        </div>
      </Section>

      <MeasureNote items={[
        { term: 'Bounce', def: 'A step in the movement history recorded as “Not pertaining to this organisation”: the office that received the grievance returned it to the office that sent it.' },
        { term: 'Grievances bounced', def: 'Grievances with at least one bounce. One grievance can bounce several times; “bounces in all” counts every return.' },
        { term: 'Days lost per bounce', def: 'Days from the step that sent the grievance to the returning office, until the sender forwarded it again.' },
        { term: 'Where they finally went', def: 'For each route, the offices that eventually disposed of those grievances: in effect, where they should have been sent first.' },
        { term: 'Manual transfers', def: 'Moves between offices, not counting the portal’s automatic first forward.' },
      ]} />
    </>
  )
}
