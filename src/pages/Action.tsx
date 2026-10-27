import * as React from 'react'
import { Download, ArrowRight, Route, Inbox, PenLine, Hourglass, MessageSquareReply } from 'lucide-react'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { PageHeader, ChartCard, MeasureNote, DaysPill } from '@/components/kit'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/DataTable'
import { headline, matured, waitingByOffice, bounceMap, medianOf, SLA } from '@/lib/exec'
import { downloadCSV, fmt, fmtPct, groupBy, mean, pct, toExportRow } from '@/data'
import { fmtDate } from '@/lib/labels'

const ENTRY = new Set(['C1TZN', 'DSPRT', 'MOYAS', 'PMOPG', 'DARPG', 'PRSEC'])

interface Lever {
  icon: React.ElementType
  title: string
  problem: React.ReactNode
  change: string
  gain: React.ReactNode
  rows: Grievance[]
  rowsLabel: string
  preview: 'reply' | 'grievance'
}

export function ActionPage() {
  const { rows, ds, showCases, office, showPII } = useStore()
  const h = headline(rows, ds.asOf)
  const D = rows.filter((r) => r.disposed)
  const wait = waitingByOffice(rows)

  /* 1 — out of mandate */
  const oom = D.filter((r) => r.outOfMandate)
  const oomDays = oom.reduce((s, r) => s + r.steps.reduce((a, st) => a + (st.gap != null && st.from && !ENTRY.has(st.from) ? st.gap : 0), 0), 0)
  const divisionDays = wait.offices.filter((o) => !ENTRY.has(o.code)).reduce((s, o) => s + o.days, 0)
  const oomHops = mean(oom.map((r) => r.transfers)) ?? 0
  /* 2 — routing */
  const bounced = rows.filter((r) => r.misroutes > 0)
  const medB = medianOf(bounced.filter((r) => r.disposed), (r) => r.days) ?? 0
  const medN = medianOf(D.filter((r) => !r.misroutes), (r) => r.days) ?? 0
  const topBouncers = bounceMap(rows).slice(0, 3)
  /* 3 — reply standard */
  const m = matured(rows, ds.asOf)
  const noTextOnTime = m.filter((r) => r.disposed && r.noText && (r.days ?? 999) <= SLA).length
  const noText = D.filter((r) => r.noText)
  /* 4 — stuck */
  const stuck = rows.filter((r) => r.stuck)
  const owners = [...groupBy(stuck, (r) => r.owner).entries()].map(([k, rs]) => ({
    key: k, rows: rs, n: rs.length,
    over60: rs.filter((r) => (r.pendingAge ?? 0) > 60).length,
    untouched: rs.filter((r) => r.untouched).length,
    oldest: Math.max(...rs.map((r) => r.pendingAge ?? 0)),
  })).sort((a, b) => b.n - a.n)
  /* 5 — interim replies */
  const interimSent = rows.filter((r) => r.interim > 0).length
  const needInterim = rows.filter((r) => !r.disposed && (r.pendingAge ?? 0) > 14 && r.interim === 0)

  const levers: Lever[] = [
    {
      icon: Inbox, title: 'Answer out-of-mandate grievances at the entry desk',
      problem: <>{fmt(oom.length)} grievances ({fmtPct(h.outOfMandatePct, 0)} of replies) were matters for a State, a federation or another body. They still went to a division first, averaging {fmt(oomHops, 1)} hand-offs.</>,
      change: 'The PG desk sends a proper referral reply — naming the State department or federation and its address — within 3 days, without routing to a division.',
      gain: <>Frees about <b>{fmt(oomDays)}</b> file-days of division time ({fmtPct(pct(oomDays, divisionDays), 0)} of all waiting at divisions) for grievances the Ministry can actually act on.</>,
      rows: oom, rowsLabel: 'Out-of-mandate grievances', preview: 'reply',
    },
    {
      icon: Route, title: 'Route each grievance to the right office first time',
      problem: <>{fmt(bounced.length)} grievances ({fmtPct(h.bouncedPct, 0)}) were sent back as “not pertaining”. Bounced cases take a median {fmt(medB)} days against {fmt(medN)}. Most returns come from {topBouncers.map((b) => office(b.code)).join(', ')}.</>,
      change: 'A one-page routing guide (subject → responsible office) at the PG desk, built from where bounced cases finally ended; any case bounced twice goes to the Director (PG).',
      gain: <>Up to <b>{fmt(Math.max(0, medB - medN))}</b> days less for each grievance that is routed right — about {fmt(Math.max(0, medB - medN) * bounced.length)} citizen-days across the selected period.</>,
      rows: bounced, rowsLabel: 'Bounced grievances', preview: 'grievance',
    },
    {
      icon: PenLine, title: 'Every reply must say what was done',
      problem: <>{fmt(noText.length)} replies carried no usable text — “PFA”, “copy attached”, or just “.” — so the citizen learns nothing from the portal message.</>,
      change: 'No disposal without a two-line summary in the reply box: what was decided, by whom, and what happens next. The attachment can stay.',
      gain: <>The genuine-resolution rate rises by up to <b>{fmt(pct(noTextOnTime, m.length), 0)} points</b> from these cases alone, with no extra time taken.</>,
      rows: noText, rowsLabel: 'Replies with no usable text', preview: 'reply',
    },
    {
      icon: Hourglass, title: 'Clear the stuck grievances',
      problem: <>{fmt(stuck.length)} grievances are past 21 days; {fmt(h.over60)} are over 60 days and {fmt(h.untouched)} have had no action for 14 days or more.</>,
      change: 'A fortnightly list to each office of its stuck grievances (below), reviewed at the PG meeting until it is clear.',
      gain: <>Removes the oldest {fmt(h.over60)} cases first; these drive the long tail where 1 in 10 citizens waits {fmt(h.p90Wait)}+ days.</>,
      rows: stuck, rowsLabel: 'Stuck grievances', preview: 'grievance',
    },
    {
      icon: MessageSquareReply, title: 'Send an interim reply at day 14',
      problem: <>Only {fmt(interimSent)} grievances received an interim reply in the selected period. {fmt(needInterim.length)} open grievances are older than 14 days with none.</>,
      change: 'Any grievance not closable by day 14 gets a short interim reply saying where it is and by when to expect an answer.',
      gain: <>Tells waiting citizens what is happening; repeat filings ({fmtPct(h.repeatPct, 0)} of all filings today) should fall.</>,
      rows: needInterim, rowsLabel: 'Open 14+ days without an interim reply', preview: 'grievance',
    },
  ]

  const ownerCols: Column<(typeof owners)[number]>[] = [
    { key: 'key', header: 'Office holding it', cell: (o) => <span className="font-medium">{o.key}</span>, sort: (o) => o.key, className: 'whitespace-nowrap' },
    { key: 'n', header: 'Stuck', align: 'right', cell: (o) => <Badge variant="critical" className="tabular">{o.n}</Badge>, sort: (o) => o.n },
    { key: 'over60', header: 'Over 60d', align: 'right', cell: (o) => fmt(o.over60), sort: (o) => o.over60 },
    { key: 'untouched', header: 'Untouched', align: 'right', cell: (o) => fmt(o.untouched), sort: (o) => o.untouched, hideBelow: 'sm' },
    { key: 'oldest', header: 'Oldest', align: 'right', cell: (o) => <DaysPill days={o.oldest} pending />, sort: (o) => o.oldest },
  ]

  return (
    <>
      <PageHeader eyebrow="Screen 4 of 4 · Action" title="What do we change, and what will it gain?"
        description="Five changes the data points to, each with its estimated effect and the grievances behind it. Estimates use the data in view and are upper bounds, not targets.">
        <Button variant="outline" size="sm" onClick={() => downloadCSV('stuck_grievances.csv', stuck.map((r) => ({ ...toExportRow(r, showPII), 'Office holding': r.owner, 'Days since last action': r.idleDays })))}>
          <Download />Stuck list (CSV)
        </Button>
      </PageHeader>

      <div className="space-y-3">
        {levers.map((l, i) => (
          <Card key={l.title} className="overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="flex gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><l.icon className="h-4.5 w-4.5" /></span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Change {i + 1}</div>
                  <h3 className="mt-0.5 text-[15px] font-semibold leading-snug">{l.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{l.problem}</p>
                </div>
              </div>
              <div className="border-t p-5 lg:border-l lg:border-t-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">What changes</div>
                <p className="mt-1.5 text-[13px] leading-relaxed">{l.change}</p>
              </div>
              <div className="flex flex-col justify-between gap-3 border-t bg-muted/30 p-5 lg:border-l lg:border-t-0">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Estimated effect</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{l.gain}</p>
                </div>
                <Button variant="outline" size="sm" className="self-start" onClick={() => showCases({ title: l.rowsLabel, rows: l.rows, preview: l.preview })}>
                  Read the {fmt(l.rows.length)} grievances <ArrowRight />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <ChartCard className="xl:col-span-3" title={`Stuck grievances to follow up (${fmt(stuck.length)})`}
          description="Pending more than 21 days, grouped by the office holding the file now. Click an office to read its stuck grievances; export the full list with the button above.">
          <DataTable rows={owners} columns={ownerCols} rowKey={(o) => o.key} pageSize={12} dense initialSort={{ key: 'n', dir: 'desc' }}
            onRowClick={(o) => showCases({ title: `Stuck with ${o.key}`, rows: o.rows, preview: 'grievance' })} />
        </ChartCard>
        <ChartCard className="xl:col-span-2" title="Track these five numbers every month" description="Current values for the period in view. Compare month to month to see whether the changes work.">
          <ol className="divide-y">
            {[
              { k: 'Genuinely answered within 21 days', v: fmtPct(h.genuine21Pct, 0) },
              { k: 'Grievances genuinely answered (all time in view)', v: fmt(h.answered) },
              { k: 'Open grievances · past 21 days', v: `${fmt(h.open)} · ${fmt(h.stuck)}` },
              { k: 'Citizen’s wait: median · slowest 10%', v: `${fmt(h.medianWait)} · ${fmt(h.p90Wait)} days` },
              { k: 'Bounced · repeat filings · deflected', v: `${fmtPct(h.bouncedPct, 0)} · ${fmtPct(h.repeatPct, 0)} · ${fmtPct(h.outOfMandatePct, 0)}` },
            ].map((x, i) => (
              <li key={x.k} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular">{i + 1}</span>
                <span className="flex-1 text-muted-foreground">{x.k}</span>
                <span className="font-semibold tabular">{x.v}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] text-muted-foreground">Data as of {fmtDate(ds.asOf)}. Use the date filter above to compare months.</p>
        </ChartCard>
      </div>

      <MeasureNote items={[
        { term: 'File-days freed', def: 'Days that out-of-mandate grievances waited with offices other than the entry desks (PG desk, PMO, DARPG, President’s Secretariat), summed.' },
        { term: 'Citizen-days saved', def: '(Median days of bounced grievances − median days of others) × number of bounced grievances. An upper bound: some cases would still need re-routing.' },
        { term: 'Points gained', def: 'Replies with no usable text that were sent within 21 days, as a share of matured grievances. If those replies had stated the action taken, they would count as answered.' },
        { term: 'Estimates', def: 'Based on the grievances in the selected period. They show the size of each lever, not a commitment or target.' },
      ]} />
    </>
  )
}
