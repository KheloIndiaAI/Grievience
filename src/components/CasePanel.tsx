import * as React from 'react'
import { Download, Search } from 'lucide-react'
import type { Grievance } from '@/types'
import { useStore, type CasePanelSpec } from '@/store'
import { Dialog, DialogTitle, DialogDescription, SheetContent } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DaysPill, StatusPill } from './kit'
import { downloadCSV, fmt, toExportRow } from '@/data'
import { fmtDate } from '@/lib/labels'
import { cn } from '@/lib/utils'

export const grievanceGist = (r: Grievance, max = 260) =>
  (r.description ?? '')
    .split('\n')
    .filter((l) => l.trim() && !l.includes('>>') && !/^[-\s]+$/.test(l) && !/^(to|sir|madam|respected|dear)[,:\s]/i.test(l.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, max)

const SORTS = {
  slow: { label: 'Longest wait first', fn: (a: Grievance, b: Grievance) => ((b.disposed ? b.days : b.pendingAge) ?? 0) - ((a.disposed ? a.days : a.pendingAge) ?? 0) },
  new: { label: 'Newest first', fn: (a: Grievance, b: Grievance) => b.receipt.localeCompare(a.receipt) },
  old: { label: 'Oldest first', fn: (a: Grievance, b: Grievance) => a.receipt.localeCompare(b.receipt) },
}

export function CasePanel({ spec, onClose }: { spec: CasePanelSpec | null; onClose: () => void }) {
  const { open } = useStore()
  const tabs = spec?.tabs ?? (spec ? [{ label: 'All', rows: spec.rows ?? [] }] : [])
  const [tab, setTab] = React.useState(0)
  const [q, setQ] = React.useState('')
  const [sort, setSort] = React.useState<keyof typeof SORTS>('slow')
  const [limit, setLimit] = React.useState(40)
  React.useEffect(() => { setTab(0); setQ(''); setLimit(40) }, [spec])

  const base = tabs[tab]?.rows ?? []
  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    return base.filter((r) => !s || r._search.includes(s)).sort(SORTS[sort].fn)
  }, [base, q, sort])
  const preview = spec?.preview ?? 'reply'

  return (
    <Dialog open={!!spec} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[min(680px,100vw)]">
        {spec && (
          <>
            <div className="border-b p-5 pr-12">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Grievances behind this number</div>
              <DialogTitle className="mt-1 text-lg leading-snug">{spec.title}</DialogTitle>
              {spec.description && <DialogDescription className="mt-1 text-[13px]">{spec.description}</DialogDescription>}
              {spec.tabs && (
                <Tabs value={String(tab)} onValueChange={(v) => setTab(Number(v))} className="mt-3">
                  <TabsList>
                    {spec.tabs.map((t, i) => <TabsTrigger key={t.label} value={String(i)}>{t.label} <span className="tabular text-muted-foreground">{fmt(t.rows.length)}</span></TabsTrigger>)}
                  </TabsList>
                </Tabs>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search within these cases…"
                    className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <Select value={sort} onValueChange={(v) => setSort(v as keyof typeof SORTS)}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(SORTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={!rows.length}
                  onClick={() => downloadCSV(`${spec.title.replace(/[^\w]+/g, '_').slice(0, 60)}.csv`, rows.map((r) => toExportRow(r)))}>
                  <Download />Export
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="px-5 py-2 text-[12px] text-muted-foreground"><b className="tabular text-foreground">{fmt(rows.length)}</b> grievance{rows.length === 1 ? '' : 's'} · click one to read it in full</div>
              <ul className="divide-y border-y">
                {rows.slice(0, limit).map((r) => (
                  <li key={r.id}>
                    <button onClick={() => open(r.id, rows.map((x) => x.id))}
                      className="block w-full px-5 py-3 text-left transition hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[12px] font-medium">{r.id}</span>
                        <span className="text-[12px] text-muted-foreground">{fmtDate(r.receipt)}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <StatusPill disposed={r.disposed} />
                          <DaysPill days={r.disposed ? r.days : r.pendingAge} pending={!r.disposed} />
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {r.disposed ? 'Closed by' : 'With'} <span className="text-foreground">{r.owner}</span> · {r.theme}
                        {r.misroutes > 0 && <Badge variant="critical" className="ml-1.5">bounced {r.misroutes}×</Badge>}
                      </div>
                      {preview === 'reply' && r.disposed ? (
                        <p className={cn('mt-1.5 line-clamp-2 rounded-md border-l-2 bg-muted/40 px-2.5 py-1.5 text-[12.5px] leading-relaxed',
                          r.answered ? 'border-[var(--series-1)]' : 'border-[var(--status-serious)]')}>
                          <span className="font-medium text-muted-foreground">Reply: </span>
                          {r.reply != null ? <>“{r.reply.trim() || '—'}”</> : <>{r.replyType} · {r.replyFormat}</>}
                        </p>
                      ) : (
                        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-foreground/80">
                          {r.description != null ? grievanceGist(r) || 'No readable grievance text.' : `${r.catL1}${r.catL2 ? ` › ${r.catL2}` : ''} · ${r.state}${r.district ? `, ${r.district}` : ''}`}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {rows.length > limit && (
                <div className="p-4 text-center"><Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 60)}>Show more ({fmt(rows.length - limit)} left)</Button></div>
              )}
              {!rows.length && <div className="p-10 text-center text-sm text-muted-foreground">No grievances here.</div>}
            </div>
          </>
        )}
      </SheetContent>
    </Dialog>
  )
}
