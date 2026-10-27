import * as React from 'react'
import { ArrowRight } from 'lucide-react'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { PageHeader, ChartCard, Legend, MeasureNote, CaseLink, Finding, Kpi, KpiGrid } from '@/components/kit'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ColumnChart, PairColumns, TrendChart } from '@/charts/Charts'
import { monthlyFlow, waitingByOffice, medianOf, SLA } from '@/lib/exec'
import { countBy, fmt, fmtPct, pct, quantile } from '@/data'
import { DAY_BUCKETS, DAY_BUCKET_LABEL, fmtDate, monthLabel, monthLong } from '@/lib/labels'

const bucketColor = (b: string) => (['0-7', '8-15', '16-21'].includes(b) ? 'var(--series-1)' : b === '22-30' || b === '31-60' ? 'var(--status-serious)' : 'var(--status-critical)')

export function OverviewPage() {
  const { rows, ds, showCases, goto, office } = useStore()
  const D = rows.filter((r) => r.disposed)
  const P = rows.filter((r) => !r.disposed)
  const on = D.filter((r) => (r.days ?? 999) <= SLA)
  const days = D.map((r) => r.days!).filter((x) => x != null).sort((a, b) => a - b)
  const p90 = days.length ? Math.round(quantile(days, 0.9)) : 0
  const flow = monthlyFlow(rows, ds.asOf)
  const [first, last] = React.useMemo(() => ds.records.reduce(([a, b], r) => [r.receipt < a ? r.receipt : a, r.receipt > b ? r.receipt : b], ['9999', '0000']), [ds])
  const wait = waitingByOffice(rows)
  const top2 = wait.offices.slice(0, 2)
  const bounced = rows.filter((r) => r.misroutes > 0)
  const refiled = D.filter((r) => r.refiledSame)
  const buckets = React.useMemo(() => {
    const c = new Map(countBy(D, (r) => r.daysBucket).map((x) => [x.key, x.count]))
    return DAY_BUCKETS.map((b) => ({ key: b, label: DAY_BUCKET_LABEL[b], value: c.get(b) ?? 0, color: bucketColor(b) }))
  }, [D])

  const panel = (title: string, rs: Grievance[], description?: string, preview: 'reply' | 'grievance' = 'reply') => showCases({ title, rows: rs, description, preview })

  return (
    <>
      <PageHeader eyebrow="Overview" title="Grievances received, disposed and pending"
        description={<>CPGRAMS grievances to the Ministry of Youth Affairs & Sports, received {fmtDate(first)} – {fmtDate(last)} (status as of {fmtDate(ds.asOf)}). Click any number to read the grievances behind it.</>} />

      <KpiGrid cols={4}>
        <Kpi label="Grievances received" value={fmt(rows.length)} sub={`${fmt(D.length)} disposed · ${fmt(P.length)} pending`}
          onClick={() => panel('All grievances in view', rows, undefined, 'grievance')} />
        <Kpi label="Disposed within 21 days" value={fmtPct(D.length ? pct(on.length, D.length) : null, 0)} tone={pct(on.length, D.length) >= 80 ? 'good' : 'warning'}
          sub={<>{fmt(on.length)} of {fmt(D.length)} disposed · {fmt(D.length - on.length)} took longer</>}
          onClick={() => showCases({ title: 'Disposed grievances by time taken', tabs: [
            { label: 'Took more than 21 days', rows: D.filter((r) => (r.days ?? 0) > SLA) },
            { label: 'Within 21 days', rows: on },
          ] })} />
        <Kpi label="Days to dispose (median)" value={fmt(medianOf(D, (r) => r.days))} unit="days"
          sub={<>1 in 10 took {fmt(p90)} days or more</>}
          onClick={() => panel(`Slowest 10% — ${fmt(p90)}+ days`, D.filter((r) => (r.days ?? 0) >= p90))} />
        <Kpi label="Pending now" value={fmt(P.length)} tone={P.some((r) => r.stuck) ? 'warning' : 'good'}
          sub={<>{fmt(P.filter((r) => r.stuck).length)} past 21 days · {fmt(P.filter((r) => (r.pendingAge ?? 0) > 60).length)} over 60 days</>}
          onClick={() => showCases({ title: 'Pending grievances', preview: 'grievance', tabs: [
            { label: 'Past 21 days', rows: P.filter((r) => r.stuck) },
            { label: 'Over 60 days', rows: P.filter((r) => (r.pendingAge ?? 0) > 60) },
            { label: 'All pending', rows: P },
          ] })} />
        <Kpi label="Bounced between offices" value={fmtPct(pct(bounced.length, rows.length), 0)} tone="warning"
          sub={<>{fmt(bounced.length)} sent back at least once as “not pertaining”</>} onClick={() => goto('routing')} />
        <Kpi label="Filed again on the same issue" value={fmt(refiled.length)}
          sub={<>after the earlier grievance was disposed ({fmtPct(pct(refiled.length, D.length), 1)} of disposals)</>}
          onClick={() => panel('Filed again on the same issue after disposal', refiled, 'The earlier grievance and its reply. Open one to see the later grievance the same citizen filed.')} />
        <Kpi label="Went through SAI" value={fmt(rows.filter((r) => r.sai).length)}
          sub={<>{fmt(rows.filter((r) => r.saiRelation === 'About SAI, not sent to SAI').length)} more are about SAI but were not sent there</>}
          onClick={() => goto('divisions')} />
        <Kpi label="Text needs further analysis" value={fmt(rows.filter((r) => r.theme === 'Needs further analysis').length)}
          sub="Scanned or blank petitions — subject not in the export" onClick={() => goto('nature')} />
      </KpiGrid>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Received and disposed each month"
          description="Received = filed that month. Disposed = closed that month (of any month’s grievances). Click a month to read the grievances received in it."
          action={<Legend items={[{ label: 'Received', color: 'var(--seq-250)' }, { label: 'Disposed', color: 'var(--series-1)' }]} />}
          table={{ columns: ['Month', 'Received', 'Disposed', 'Pending at month end'], rows: flow.map((f) => [monthLong(f.key), f.received, f.disposed, f.open]) }}
          footer={flow.some((f) => f.key === '2026-08') ? <>The Aug 2026 spike is the AIFF U-15 coach campaign: 106 grievances arrived on 1 Aug 2026 alone.</> : undefined}>
          <PairColumns height={260} data={flow.map((f) => ({ key: f.key, label: monthLabel(f.key), a: f.received, b: f.disposed }))}
            a={{ label: 'Received', color: 'var(--seq-250)' }} b={{ label: 'Disposed', color: 'var(--series-1)' }}
            onSelect={(k) => panel(`Received in ${monthLong(k)}`, rows.filter((r) => r.month === k), undefined, 'grievance')} />
        </ChartCard>
        <ChartCard title="Pending at month end" description={`Grievances received from ${fmtDate(first)} and not yet disposed at each month end. Older pending cases are not in this export.`}
          table={{ columns: ['Month', 'Pending at month end'], rows: flow.map((f) => [monthLong(f.key), f.open]) }}>
          <TrendChart valueLabel="Pending" area height={260} data={flow.map((f) => ({ key: f.key, label: monthLabel(f.key), value: f.open }))} />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <ChartCard className="xl:col-span-3" title="How long disposal takes" description="Disposed grievances by days taken. Blue bars are within 21 days. Click a bar to read those grievances."
          action={<Legend items={[{ label: 'Within 21 days', color: 'var(--series-1)' }, { label: '22–60 days', color: 'var(--status-serious)' }, { label: 'Over 60 days', color: 'var(--status-critical)' }]} />}
          table={{ columns: ['Days', 'Grievances'], rows: buckets.map((b) => [b.label, b.value]) }}>
          <ColumnChart data={buckets} height={250} valueLabel="Grievances"
            onSelect={(k) => panel(`Disposed in ${DAY_BUCKET_LABEL[k]} days`, D.filter((r) => r.daysBucket === k))} />
        </ChartCard>
        <Card className="p-6 xl:col-span-2">
          <h2 className="mb-5 text-[15px] font-semibold">Key points</h2>
          <div className="space-y-5">
            <Finding n={1} title={<>{fmtPct(D.length ? pct(D.length - on.length, D.length) : null, 0)} of disposals took longer than 21 days</>}>
              {fmt(D.length - on.length)} grievances, and {fmt(D.filter((r) => (r.days ?? 0) > 60).length)} of them took more than 60 days.
            </Finding>
            <Finding n={2} title={<>Files wait longest at two desks</>}>
              {top2.map((o, i) => (
                <React.Fragment key={o.code}>{i > 0 && ' and '}
                  <CaseLink onClick={() => showCases({ title: office(o.code), tabs: [
                    { label: 'Pending now', rows: rows.filter((r) => !r.disposed && r.holder === o.code) },
                    { label: 'Closed', rows: rows.filter((r) => r.disposed && r.ownerCode === o.code) },
                  ] })}>{office(o.code)}</CaseLink>
                </React.Fragment>
              ))} account for {fmtPct(top2.reduce((s, o) => s + o.share, 0), 0)} of all file-days (days a file sat with an office before it acted).
            </Finding>
            <Finding n={3} title={<>Bounced grievances take more than twice as long</>}
              action={<Button variant="link" size="xs" className="h-auto px-0" onClick={() => goto('routing')}>See routing & bounces <ArrowRight /></Button>}>
              Median {fmt(medianOf(D.filter((r) => r.misroutes > 0), (r) => r.days))} days when sent back as “not pertaining” at least once, against {fmt(medianOf(D.filter((r) => !r.misroutes), (r) => r.days))} days otherwise.
            </Finding>
          </div>
        </Card>
      </div>

      <MeasureNote items={[
        { term: 'Days to dispose', def: 'Days from the date of receipt to the first “Case disposed of” action. 21 days is the current CPGRAMS norm.' },
        { term: 'Bounced', def: 'An office that received the grievance sent it back with “Not pertaining to this organisation”. See the Routing & bounces page.' },
        { term: 'File-days', def: 'For every grievance, the days between one action and the next are counted against the office that held the file in that period. Added across all grievances, that is the office’s file-days.' },
        { term: 'Filed again on the same issue', def: 'The same mobile number filed a new grievance on or after the date the earlier one was disposed, and at least 20% of the meaningful words in the two texts are the same.' },
        { term: 'Pending at month end', def: 'Starts from zero in the first month of the data: grievances pending from before then are not in this export.' },
        { term: 'Campaigns', def: 'The AIFF U-15 coach and STC Kurnool hostel campaigns (2026) are included. Switch them off with “Include mass campaigns” above.' },
      ]} />
    </>
  )
}
