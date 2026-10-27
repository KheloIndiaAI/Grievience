import * as React from 'react'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { PageHeader, ChartCard, Section, MeasureNote, Callout, CaseLink, Kpi, KpiGrid, Legend } from '@/components/kit'
import { BarList } from '@/charts/BarList'
import { SegmentBar, HeatTable } from '@/charts/Composite'
import { DataTable, type Column } from '@/components/DataTable'
import { medianOf, pctOf, SLA } from '@/lib/exec'
import { countBy, fmt, fmtPct, groupBy, pct } from '@/data'
import { UNREAD_THEME, monthLabel, themeOrder } from '@/lib/labels'

/** How the grievance was closed, grouped for a theme-level view. */
const CLOSE_KIND = (r: Grievance) => {
  const t = r.replyType
  if (t === 'Substantive reply') return 'Reply on the issue'
  if (t.includes('State subject')) return '“State subject”'
  if (t.includes('Federation decides')) return '“Federation decides”'
  if (t.startsWith('Not pertaining')) return 'Not pertaining'
  if (t === 'Attachment only' || t.startsWith('Meaningless')) return 'No usable text'
  return 'Other (forwarded, duplicate…)'
}
const KINDS = ['Reply on the issue', '“State subject”', '“Federation decides”', 'Not pertaining', 'No usable text', 'Other (forwarded, duplicate…)']
const KIND_COLOR: Record<string, string> = {
  'Reply on the issue': 'var(--series-1)',
  '“State subject”': 'var(--series-4)',
  '“Federation decides”': 'var(--series-7)',
  'Not pertaining': 'var(--status-serious)',
  'No usable text': 'var(--status-critical)',
  'Other (forwarded, duplicate…)': 'var(--neutral-mark)',
}

export function NaturePage() {
  const { rows, showCases, all, ds } = useStore()
  const [cat, setCat] = React.useState<string | null>(null)
  const D = rows.filter((r) => r.disposed)
  const panel = (title: string, rs: Grievance[], description?: string, preview: 'reply' | 'grievance' = 'grievance') => showCases({ title, rows: rs, description, preview })
  const themePanel = (t: string) => {
    const rs = rows.filter((r) => r.theme === t)
    showCases({ title: `Theme: ${t}`, preview: 'grievance', tabs: [
      { label: 'All', rows: rs },
      { label: 'Pending', rows: rs.filter((r) => !r.disposed) },
      { label: 'Took > 21 days', rows: rs.filter((r) => r.disposed && (r.days ?? 0) > SLA) },
      { label: 'Filed again', rows: rs.filter((r) => r.refiledSame) },
    ] })
  }

  /* ---------------- themes */
  const themes = React.useMemo(() => themeOrder([...groupBy(rows, (r) => r.theme).entries()].map(([k, rs]) => {
    const d = rs.filter((r) => r.disposed)
    return {
      key: k, rows: rs, n: rs.length, share: pct(rs.length, rows.length),
      on: pctOf(d, (r) => (r.days ?? 999) <= SLA), med: medianOf(d, (r) => r.days),
      pending: rs.filter((r) => !r.disposed).length, bounced: pctOf(rs, (r) => r.misroutes > 0),
      refiled: rs.filter((r) => r.refiledSame).length,
    }
  }), (t) => t.key, (t) => t.n), [rows])
  const readable = themes.filter((t) => t.key !== UNREAD_THEME)
  const top3 = readable.slice(0, 3)
  const unread = rows.filter((r) => r.theme === UNREAD_THEME)
  const slowest = [...readable].filter((t) => t.n >= 10 && t.med != null).sort((a, b) => (b.med ?? 0) - (a.med ?? 0)).slice(0, 3)

  /* ---------------- categories */
  const cats = countBy(rows, (r) => r.catL1).sort((a, b) => (a.key === '(Not categorised)' ? 1 : 0) - (b.key === '(Not categorised)' ? 1 : 0) || b.count - a.count)
  const activeCat = cat ?? cats.find((c) => c.key !== '(Not categorised)')?.key ?? null
  const subs = countBy(rows.filter((r) => r.catL1 === activeCat), (r) => r.catL2 ?? 'No sub-category')

  /* ---------------- trend */
  const months = [...new Set(rows.map((r) => r.month))].sort()
  const heat = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(`${r.theme}|${r.month}`, (m.get(`${r.theme}|${r.month}`) ?? 0) + 1)
    return m
  }, [rows])

  /* ---------------- closing */
  const closeRows = themes.filter((t) => t.rows.some((r) => r.disposed)).slice(0, 12)

  /* ---------------- filed again */
  const refiled = D.filter((r) => r.refiledSame)
  const anyAgain = D.filter((r) => r.refiledAny)
  const byId = React.useMemo(() => new Map(all.map((r) => [r.id, r])), [all])
  const refThemes = themeOrder(countBy(refiled, (r) => r.theme), (x) => x.key, (x) => x.count)
  const refKinds = KINDS.map((k) => {
    const base = D.filter((r) => CLOSE_KIND(r) === k)
    const n = base.filter((r) => r.refiledSame).length
    return { key: k, n, rate: pct(n, base.length), base: base.length }
  })

  const themeCols: Column<(typeof themes)[number]>[] = [
    { key: 'key', header: 'Theme', className: 'whitespace-nowrap', sort: (t) => (t.key === UNREAD_THEME ? 'zzz' : t.key),
      cell: (t) => <span className={t.key === UNREAD_THEME ? 'italic text-muted-foreground' : 'font-medium'}>{t.key}{t.key === UNREAD_THEME && ' *'}</span> },
    { key: 'n', header: 'Grievances', align: 'right', cell: (t) => fmt(t.n), sort: (t) => (t.key === UNREAD_THEME ? -1 : t.n) },
    { key: 'share', header: 'Share', align: 'right', cell: (t) => fmtPct(t.share, 0), sort: (t) => t.share, hideBelow: 'sm' },
    { key: 'on', header: 'Disposed ≤21d', align: 'right', sort: (t) => t.on, cell: (t) => <span className={(t.on ?? 100) < 50 ? 'font-medium text-[var(--critical-ink)]' : ''}>{fmtPct(t.on, 0)}</span> },
    { key: 'med', header: 'Median days', align: 'right', sort: (t) => t.med, cell: (t) => <span className={(t.med ?? 0) > SLA ? 'font-medium text-[var(--critical-ink)]' : ''}>{t.med == null ? '–' : fmt(t.med)}</span> },
    { key: 'pending', header: 'Pending', align: 'right', cell: (t) => fmt(t.pending), sort: (t) => t.pending, hideBelow: 'md' },
    { key: 'bounced', header: 'Bounced', align: 'right', cell: (t) => fmtPct(t.bounced, 0), sort: (t) => t.bounced, hideBelow: 'md' },
    { key: 'refiled', header: 'Filed again', align: 'right', cell: (t) => fmt(t.refiled), sort: (t) => t.refiled, hideBelow: 'lg' },
  ]

  return (
    <>
      <PageHeader eyebrow="Nature of grievances" title="What the grievances are about"
        description="Themes are read from the grievance text; categories are what the citizen chose on CPGRAMS. Click any theme, category or bar to read the grievances." />

      <KpiGrid cols={4}>
        <Kpi label="Top three themes" value={fmtPct(top3.reduce((s, t) => s + t.share, 0), 0)} sub={top3.map((t) => t.key).join(' · ')} />
        <Kpi label="Slowest themes (median days)" value={slowest[0] ? fmt(slowest[0].med) : '–'} unit="days" tone="warning"
          sub={slowest.map((t) => `${t.key} ${fmt(t.med)}d`).join(' · ')} onClick={() => slowest[0] && themePanel(slowest[0].key)} />
        <Kpi label="No CPGRAMS category chosen" value={fmt(rows.filter((r) => r.catL1 === '(Not categorised)').length)}
          sub="Mostly PMO and letter petitions" onClick={() => panel('Grievances with no CPGRAMS category', rows.filter((r) => r.catL1 === '(Not categorised)'))} />
        <Kpi label="Filed again on the same issue" value={fmt(refiled.length)} sub={`after disposal · ${fmt(anyAgain.length)} filed again on any issue`}
          onClick={() => panel('Filed again on the same issue after disposal', refiled, 'Earlier grievance and its reply; open one to jump to the later filing.', 'reply')} />
      </KpiGrid>

      <ChartCard title="Themes" description="Sorted by number of grievances. Red marks themes where fewer than half are disposed within 21 days, or the median is over 21 days. Click a theme to read its grievances."
        footer={<>* {fmt(unread.length)} grievances need further analysis: the export has no usable text for them (see the end of this page).</>}>
        <DataTable rows={themes} columns={themeCols} rowKey={(t) => t.key} pageSize={null} dense initialSort={{ key: 'n', dir: 'desc' }} onRowClick={(t) => themePanel(t.key)} />
      </ChartCard>

      <Section title="Categories chosen by the citizen">
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <ChartCard title="CPGRAMS categories" description="Click a category to see its sub-categories on the right.">
            <BarList limit={12} valueHeader="Grievances" selected={activeCat ? [activeCat] : []}
              items={cats.map((c) => ({ key: c.key, value: c.count, color: c.key === '(Not categorised)' ? 'var(--neutral-mark)' : 'var(--series-1)' }))}
              onSelect={(k) => setCat(k)} />
          </ChartCard>
          <ChartCard title={activeCat ? `Sub-categories: ${activeCat}` : 'Sub-categories'} description="Click a sub-category to read its grievances. For “Sports Federations Related” these are the sports; football in 2026 is mostly the AIFF U-15 coach campaign.">
            <BarList limit={12} valueHeader="Grievances" color="var(--seq-450)"
              items={subs.map((s) => ({ key: s.key, label: s.key.charAt(0).toUpperCase() + s.key.slice(1), value: s.count }))}
              onSelect={(k) => panel(`${activeCat} › ${k}`, rows.filter((r) => r.catL1 === activeCat && (r.catL2 ?? 'No sub-category') === k))} />
          </ChartCard>
        </div>
          <ChartCard title="Themes month by month" description="Grievances received per theme and month. Darker = more. Shows rising or one-off issues. Click a cell to read them.">
            <HeatTable rows={readable.slice(0, 10).map((t) => t.key)} cols={months} value={(r, c) => heat.get(`${r}|${c}`) ?? 0} colLabel={(c) => monthLabel(c)}
              onCell={(r, c) => panel(`${r} — ${monthLabel(c)}`, rows.filter((x) => x.theme === r && x.month === c))} />
          </ChartCard>
      </Section>

      <Section title="How each theme was closed" description="What the final reply did, by theme. This shows which issues the Ministry acts on itself and which it refers elsewhere.">
        <ChartCard title="Closing reply by theme" description="Share of each theme’s disposed grievances. Hover a segment for the count; click a theme to read its grievances."
          footer={<Legend items={KINDS.map((k) => ({ label: k, color: KIND_COLOR[k] }))} />}
          table={{ columns: ['Theme', ...KINDS], rows: closeRows.map((t) => [t.key, ...KINDS.map((k) => t.rows.filter((r) => r.disposed && CLOSE_KIND(r) === k).length)]) }}>
          <div className="space-y-2.5">
            {closeRows.map((t) => {
              const d = t.rows.filter((r) => r.disposed)
              return (
                <button key={t.key} onClick={() => showCases({ title: `How “${t.key}” was closed`, preview: 'reply', tabs: KINDS.map((k) => ({ label: k, rows: d.filter((r) => CLOSE_KIND(r) === k) })).filter((x) => x.rows.length) })}
                  className="grid w-full grid-cols-1 items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent/50 md:grid-cols-[14rem_minmax(0,1fr)_3rem] md:gap-3">
                  <span className={t.key === UNREAD_THEME ? 'truncate text-[13px] italic text-muted-foreground' : 'truncate text-[13px]'}>{t.key}</span>
                  <SegmentBar showLabels={false} height={12} format={(v) => `${fmt(v)} (${fmtPct(pct(v, d.length), 0)})`}
                    segments={KINDS.map((k) => ({ key: k, label: k, value: d.filter((r) => CLOSE_KIND(r) === k).length, color: KIND_COLOR[k] }))} />
                  <span className="hidden text-right text-[12px] tabular text-muted-foreground md:block">{fmt(d.length)}</span>
                </button>
              )
            })}
          </div>
        </ChartCard>
      </Section>

      <Section title="Filed again after disposal" description="The same citizen came back after the earlier grievance was disposed.">
        <Callout tone="info" title={`${fmt(anyAgain.length)} disposed grievances were followed by another filing from the same citizen; ${fmt(refiled.length)} of these were on the same issue`}>
          “Same issue” means at least 20% of the meaningful words match. <CaseLink onClick={() => panel('Filed again on the same issue after disposal', refiled, 'Earlier grievance and its reply; open one to jump to the later filing.', 'reply')}>{ds.redacted ? `See the ${fmt(refiled.length)} grievances and how they were closed` : `Read the ${fmt(refiled.length)} grievances and the replies they got`}</CaseLink>.
        </Callout>
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <ChartCard title="Same-issue re-filings by theme" description="Theme of the earlier, disposed grievance.">
            <BarList valueHeader="Filed again" items={refThemes.map((x) => ({ key: x.key, value: x.count, muted: x.key === UNREAD_THEME }))}
              onSelect={(k) => panel(`Filed again — ${k}`, refiled.filter((r) => r.theme === k), undefined, 'reply')} />
          </ChartCard>
          <ChartCard title="Re-filing rate by the reply the citizen received" description="Of the grievances closed with each kind of reply, the share filed again on the same issue.">
            <BarList valueFormat={(v) => `${v.toFixed(1)}%`} valueHeader="Filed again" extraHeaders={['Cases', 'Replies']}
              items={refKinds.map((k) => ({ key: k.key, value: k.rate, color: KIND_COLOR[k.key], extra: [fmt(k.n), fmt(k.base)] }))}
              onSelect={(k) => panel(`Filed again after a “${k}” reply`, refiled.filter((r) => CLOSE_KIND(r) === k), undefined, 'reply')} />
          </ChartCard>
        </div>
        {refiled.some((r) => r.description != null) && (
          <ChartCard title="Examples" description="Earlier reply and the later grievance from the same citizen.">
            <div className="grid gap-3 lg:grid-cols-2">
              {refiled.filter((r) => (r.description?.length ?? 0) > 200).slice(0, 4).map((r) => {
                const later = byId.get(r.refiledSame!)
                return (
                  <div key={r.id} className="space-y-2 rounded-lg border p-3 text-[12.5px]">
                    <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                      <span>{r.theme}</span><span className="font-mono">{r.id} → {later?.id}</span>
                    </div>
                    <p className="line-clamp-2 rounded-md border-l-2 border-[var(--status-serious)] bg-muted/40 px-2.5 py-1.5"><b>Reply sent:</b> “{r.reply?.trim()}”</p>
                    <p className="line-clamp-3 text-muted-foreground"><b className="text-foreground">Filed again {later ? `${Math.max(0, Math.round((Date.parse(later.receipt) - Date.parse(r.disposalDate!)) / 86400000))} days later` : ''}:</b> {later?.description?.split('\n').filter((l) => l.trim() && !l.includes('>>') && !/^-+$/.test(l.trim())).join(' ').slice(0, 240)}</p>
                    <div className="flex gap-3 text-[12px]">
                      <CaseLink onClick={() => showCases({ title: 'Earlier and later grievance', preview: 'reply', rows: [r, ...(later ? [later] : [])] })}>Open both</CaseLink>
                    </div>
                  </div>
                )
              })}
            </div>
          </ChartCard>
        )}
      </Section>

      <Section title="Needs further analysis">
        <Callout tone="warning" title={`${fmt(unread.length)} grievances (${fmtPct(pct(unread.length, rows.length), 0)}) cannot be classified from this export`}>
          Their text reads “Additional information not provided” or “Petition not fully scanned”: they are mostly PMO and letter (Dak) petitions whose content sits in scanned attachments.
          {' '}Came from: {countBy(unread, (r) => r.source).slice(0, 3).map((x) => `${x.key} ${fmt(x.count)}`).join(' · ')}.
          {' '}Reading the attachments in CPGRAMS would let these be classified. <CaseLink onClick={() => panel('Grievances that need further analysis', unread)}>See the list</CaseLink>.
        </Callout>
      </Section>

      <MeasureNote items={[
        { term: 'Theme', def: 'Read from the grievance text with keyword rules (e.g. “selection”, “trial” → Selection & trials). Campaign petitions are themed by their known subject.' },
        { term: 'CPGRAMS category', def: 'The category and sub-category the citizen chose when filing. Blank for most PMO and letter petitions.' },
        { term: 'Closing reply', def: 'What the final reply did, classified from its text: a reply on the issue, a “State subject” or “federation decides” referral, not pertaining, no usable text (attachment only or “.”), or other.' },
        { term: 'Filed again on the same issue', def: 'Same mobile number; new grievance received on or after the disposal date of the earlier one; at least 20% of meaningful words shared. Citizens without a mobile number cannot be traced.' },
        { term: 'Needs further analysis', def: 'Grievances whose text in the export is a placeholder (scanned or blank petitions). They are shown last and kept out of theme comparisons.' },
      ]} />
    </>
  )
}
