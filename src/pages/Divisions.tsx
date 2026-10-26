import * as React from 'react'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { PageHeader, ChartCard, MeasureNote, Callout, CaseLink, Legend } from '@/components/kit'
import { BarList } from '@/charts/BarList'
import { SegmentBar } from '@/charts/Composite'
import { DataTable, type Column } from '@/components/DataTable'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { waitingByOffice, bounceMap, medianOf, pctOf } from '@/lib/exec'
import { fmt, fmtPct, groupBy, mean, pct } from '@/data'

type Mode = 'ministry' | 'sai'

interface Row {
  key: string
  label: string
  rows: Grievance[]
  n: number
  pending: number
  stuck: number
  untouched: number
  genuine: number | null
  med: number | null
  waitShare: number
  returns: number
  good: number | null
  noText: number | null
}

const STAGES = [
  { key: 'dRecMin', label: 'Citizen → Ministry', color: 'var(--seq-250)' },
  { key: 'dMinSai', label: 'Ministry desk → SAI', color: 'var(--seq-450)' },
  { key: 'dHq', label: 'SAI HQ → division', color: 'var(--series-7)' },
  { key: 'dDiv', label: 'Inside the SAI office', color: 'var(--series-2)' },
  { key: 'dAfter', label: 'Back at Ministry', color: 'var(--neutral-mark)' },
] as const

export function DivisionsPage() {
  const { rows, ds, showCases, office } = useStore()
  const [mode, setMode] = React.useState<Mode>('ministry')
  const wait = React.useMemo(() => waitingByOffice(rows), [rows])
  const waitBy = new Map(wait.offices.map((o) => [o.code, o]))
  const bounceBy = new Map(bounceMap(rows).map((b) => [b.code, b.returns]))
  const saiSet = new Set(ds.saiOffices)

  const openOffice = (label: string, rs: Grievance[]) => {
    const isPending = (r: Grievance) => (mode === 'sai' ? !!r.sai?.pending : !r.disposed)
    showCases({
      title: label, preview: 'reply', tabs: [
        { label: mode === 'sai' ? 'Pending inside SAI' : 'Pending now', rows: rs.filter(isPending) },
        { label: 'Stuck > 21 days', rows: rs.filter((r) => isPending(r) && r.stuck) },
        { label: 'Closed', rows: rs.filter((r) => r.disposed) },
        ...(mode === 'sai' ? [{ label: 'All', rows: rs }] : []),
      ],
    })
  }

  const table: Row[] = React.useMemo(() => {
    const groups = mode === 'ministry'
      ? groupBy(rows, (r) => r.ownerCode ?? 'UNKNOWN')
      : groupBy(rows.filter((r) => r.sai), (r) => r.sai!.handler ?? 'SPSAI')
    return [...groups.entries()].map(([code, rs]) => {
      const d = rs.filter((r) => r.disposed)
      const p = mode === 'ministry' ? rs.filter((r) => !r.disposed) : rs.filter((r) => r.sai!.pending)
      return {
        key: code, label: code === 'UNKNOWN' ? 'Not recorded' : office(code), rows: rs, n: rs.length,
        pending: p.length, stuck: p.filter((r) => r.stuck).length, untouched: p.filter((r) => r.untouched).length,
        genuine: pctOf(d, (r) => (r.days ?? 999) <= 21),
        med: mode === 'ministry' ? medianOf(d, (r) => r.days) : medianOf(rs, (r) => r.sai!.dIn),
        waitShare: waitBy.get(code)?.share ?? 0,
        returns: bounceBy.get(code) ?? 0,
        good: d.length ? pct(d.filter((r) => r.qualityBand === 'Good').length, d.length) : null,
        noText: d.length ? pct(d.filter((r) => r.noText).length, d.length) : null,
      }
    }).filter((r) => r.n >= (mode === 'ministry' ? 5 : 2)).sort((a, b) => b.n - a.n)
  }, [rows, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const top = [...table].sort((a, b) => b.n - a.n)
  const worstStuck = [...table].sort((a, b) => b.stuck - a.stuck)[0]
  const shareTop2 = top.slice(0, 2).reduce((s, r) => s + r.n, 0)
  const waitPool = wait.offices.filter((o) => (mode === 'sai' ? saiSet.has(o.code) : true))
  const poolTotal = waitPool.reduce((s, o) => s + o.days, 0)
  const waitOffices = waitPool.map((o) => ({ ...o, share: pct(o.days, poolTotal) })).slice(0, 10)

  const cols: Column<Row>[] = [
    { key: 'label', header: mode === 'ministry' ? 'Office' : 'SAI office', cell: (r) => <span className="font-medium">{r.label}</span>, sort: (r) => r.label, className: 'whitespace-nowrap' },
    { key: 'n', header: 'Handled', align: 'right', cell: (r) => fmt(r.n), sort: (r) => r.n },
    { key: 'genuine', header: 'Disposed ≤21d', align: 'right', sort: (r) => r.genuine,
      cell: (r) => <span className={(r.genuine ?? 100) < 50 ? 'font-medium text-[var(--critical-ink)]' : ''}>{fmtPct(r.genuine, 0)}</span> },
    { key: 'med', header: mode === 'ministry' ? 'Median days' : 'Days in SAI', align: 'right', sort: (r) => r.med,
      cell: (r) => <span className={(r.med ?? 0) > 21 ? 'font-medium text-[var(--critical-ink)]' : ''}>{r.med == null ? '–' : fmt(r.med)}</span> },
    { key: 'pending', header: 'Pending', align: 'right', cell: (r) => fmt(r.pending), sort: (r) => r.pending },
    { key: 'stuck', header: 'Stuck', align: 'right', sort: (r) => r.stuck,
      cell: (r) => (r.stuck ? <Badge variant="critical" className="tabular">{r.stuck}</Badge> : <span className="text-muted-foreground">0</span>) },
    { key: 'untouched', header: 'Untouched', align: 'right', sort: (r) => r.untouched, hideBelow: 'md',
      cell: (r) => (r.untouched ? <Badge variant="warning" className="tabular">{r.untouched}</Badge> : <span className="text-muted-foreground">0</span>) },
    ...(mode === 'ministry' ? [
      { key: 'wait', header: 'File-days share', align: 'right' as const, sort: (r: Row) => r.waitShare, hideBelow: 'lg' as const, cell: (r: Row) => fmtPct(r.waitShare, 1) },
      { key: 'returns', header: 'Sent back', align: 'right' as const, sort: (r: Row) => r.returns, hideBelow: 'lg' as const, cell: (r: Row) => fmt(r.returns) },
    ] : []),
    { key: 'noText', header: 'No text', align: 'right', sort: (r) => r.noText, hideBelow: 'lg',
      cell: (r) => <span className={(r.noText ?? 0) >= 25 ? 'text-[var(--critical-ink)]' : ''}>{fmtPct(r.noText, 0)}</span> },
  ]

  /* ---------------- SAI journey */
  const sai = rows.filter((r) => r.sai)
  const stageAvg = STAGES.map((s) => mean(sai.map((r) => (r.sai![s.key] as number | null) ?? 0)) ?? 0)
  const senders = [...groupBy(sai, (r) => r.saiSender).entries()].map(([k, rs]) => ({ key: k, rows: rs, med: medianOf(rs, (r) => r.sai!.dMinSai) })).sort((a, b) => b.rows.length - a.rows.length)

  return (
    <>
      <PageHeader eyebrow="Divisions & SAI" title="Workload and pending grievances by office"
        description="One row per office: the office that closed the grievance, or holds it now if it is pending. Click any office to read its pending, stuck and closed grievances.">
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as Mode)} aria-label="Ministry or SAI">
          <ToggleGroupItem value="ministry">Ministry offices</ToggleGroupItem>
          <ToggleGroupItem value="sai">SAI offices</ToggleGroupItem>
        </ToggleGroup>
      </PageHeader>

      {mode === 'ministry' ? (
        <Callout tone="warning" title={`${top.slice(0, 2).map((r) => r.label).join(' and ')} handle ${fmtPct(pct(shareTop2, rows.length), 0)} of all grievances`}>
          {worstStuck && worstStuck.stuck > 0 && <>The most stuck grievances are with <CaseLink onClick={() => openOffice(worstStuck.label, worstStuck.rows)}>{worstStuck.label}</CaseLink> ({fmt(worstStuck.stuck)} past 21 days). </>}
          Specialist desks handle few cases but hold each for longest — sort by “Median days” to see them.
        </Callout>
      ) : (
        <Callout tone="warning" title={`${fmt(sai.length)} grievances went through SAI; the SAI office stage averages ${fmt(stageAvg[3], 0)} of the ${fmt(stageAvg.reduce((a, b) => a + b, 0), 0)} days`}>
          SAI HQ passes cases on within a day; the time is spent in the SAI divisions and centres.
          {' '}Another <CaseLink onClick={() => showCases({ title: 'About SAI, but not sent to SAI', rows: rows.filter((r) => r.saiRelation === 'About SAI, not sent to SAI'), preview: 'reply', description: 'Theme “SAI centres & infrastructure” or CPGRAMS category “SAI Work”, but handled by the Ministry without forwarding to SAI.' })}>{fmt(rows.filter((r) => r.saiRelation === 'About SAI, not sent to SAI').length)}</CaseLink> grievances are about SAI but were dealt with by the Ministry without sending them to SAI.{' '}
          <CaseLink onClick={() => showCases({ title: 'SAI grievances', preview: 'reply', tabs: [
            { label: 'Pending inside SAI', rows: sai.filter((r) => r.sai!.pending) },
            { label: 'All SAI cases', rows: sai },
          ] })}>Read the SAI grievances</CaseLink>.
        </Callout>
      )}

      {mode === 'sai' && (
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <ChartCard className="xl:col-span-2" title="The SAI journey" description="Average days at each stage for grievances that went through SAI.">
            <SegmentBar height={20} format={(v) => `${fmt(v, 1)}d`} segments={STAGES.map((s, i) => ({ key: s.key, label: s.label, value: stageAvg[i], color: s.color }))} />
          </ChartCard>
          <ChartCard title="Who sends cases to SAI" description="Ministry desk and its median days to forward.">
            <BarList compact items={senders.map((s) => ({ key: s.key ?? '–', value: s.rows.length, extra: [s.med == null ? '–' : `${fmt(s.med)}d`], color: 'var(--seq-450)' }))}
              valueHeader="Cases" extraHeaders={['To forward']} onSelect={(k) => showCases({ title: `Sent to SAI by ${k}`, rows: senders.find((s) => s.key === k)!.rows })} />
          </ChartCard>
        </div>
      )}

      <ChartCard title={mode === 'ministry' ? 'Office scorecard' : 'SAI office scorecard'}
        description={mode === 'ministry'
          ? 'Offices with 5 or more grievances. Red marks offices disposing fewer than half within 21 days, or with a median over 21 days.'
          : 'SAI offices with 2 or more grievances. “Days in SAI” = median days the office held the case.'}
        footer={<Legend items={[{ label: 'Stuck: pending more than 21 days', color: 'var(--status-critical)' }, { label: 'Untouched: no action for 14+ days', color: 'var(--status-warning)' }]} />}>
        <DataTable rows={table} columns={cols} rowKey={(r) => r.key} pageSize={15} dense initialSort={{ key: 'n', dir: 'desc' }} onRowClick={(r) => openOffice(r.label, r.rows)} />
      </ChartCard>

      <div className={mode === 'ministry' ? 'grid items-start gap-4 xl:grid-cols-2' : 'grid items-start gap-4'}>
        {mode === 'ministry' && <ChartCard title="Where files wait (file-days)" description={<><b className="text-foreground">File-days</b> = days a grievance file sat with an office before that office acted on it, added up over all grievances. Example: 3 files each held 10 days = 30 file-days. Pending files count the days since their last action.</>}
          table={{ columns: ['Office', 'Share of file-days', 'File-days', 'Grievances'], rows: waitOffices.map((o) => [office(o.code), Math.round(o.share * 10) / 10, o.days, o.n]) }}>
          <BarList valueFormat={(v) => `${v.toFixed(1)}%`} valueHeader="Share" extraHeaders={['File-days', 'Cases']} color="var(--series-2)"
            items={waitOffices.map((o) => ({ key: o.code, label: office(o.code), value: o.share, extra: [fmt(o.days), fmt(o.n)] }))}
            onSelect={(k) => openOffice(`Waited with ${office(k)}`, rows.filter((r) => waitBy.get(k)!.cases.has(r.id)))} />
        </ChartCard>}
        <ChartCard title="Stuck grievances by office" description="Pending more than 21 days, by the office holding the file now.">
          <BarList color="var(--status-critical)" valueHeader="Stuck" extraHeaders={['Over 60d', 'Untouched']}
            items={[...table].filter((r) => r.stuck).sort((a, b) => b.stuck - a.stuck).slice(0, 10).map((r) => ({
              key: r.key, label: r.label, value: r.stuck,
              extra: [fmt(r.rows.filter((x) => !x.disposed && (x.pendingAge ?? 0) > 60).length), fmt(r.untouched)],
            }))}
            onSelect={(k) => { const r = table.find((x) => x.key === k)!; showCases({ title: `Stuck with ${r.label}`, rows: r.rows.filter((x) => x.stuck), preview: 'grievance' }) }} />
        </ChartCard>
      </div>

      <MeasureNote items={[
        { term: 'Office', def: 'The office that recorded “Case disposed of”, or the office holding the file now if pending. SAI mode uses the last SAI office that handled the case.' },
        { term: 'Disposed ≤21d', def: 'Share of the grievances this office disposed of that were closed within 21 days of receipt.' },
        { term: 'File-days', def: 'For every grievance, the days between one action and the next are counted against the office that held the file in that period (the office that took the next action). Summed over all grievances, that is the office’s file-days. Pending files add the days since their last action to the office holding them. File-days share = the office’s file-days as a share of everyone’s.' },
        { term: 'Sent back', def: 'Times this office returned a grievance as “not pertaining to this office”.' },
        { term: 'Stuck / untouched', def: 'Stuck = pending more than 21 days since receipt. Untouched = no action recorded for 14 days or more.' },
        { term: 'SAI offices', def: `SAI HQ and the ${ds.saiOffices.length - 1} offices it forwards to (divisions, regional centres, stadiums). LNIPE and State sports bodies are not SAI.` },
      ]} />
    </>
  )
}
