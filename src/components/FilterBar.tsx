import * as React from 'react'
import { CalendarDays, ChevronDown, Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react'
import { useStore, FILTER_FIELDS, PRIMARY_FILTERS, PANEL_FILTERS, applyFilters, emptyFilters, type FilterField } from '@/store'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogTitle, DialogDescription, SheetContent, DialogTrigger } from '@/components/ui/dialog'
import { countBy, fmt } from '@/data'
import { cn } from '@/lib/utils'
import { fmtDate, monthLong, DAY_BUCKET_LABEL } from '@/lib/labels'

const valueLabel = (f: FilterField, v: string) => {
  if (f === 'month') return monthLong(v)
  if (f === 'daysBucket' || f === 'pendingBucket') return `${DAY_BUCKET_LABEL[v] ?? v} days`
  if (f === 'transferBucket') return `${v} transfer${v === '1' ? '' : 's'}`
  if (f === 'cid') return 'Selected complainant'
  if (f === 'path') return v.length > 40 ? v.slice(0, 40) + '…' : v
  return v
}

function FacetList({ field, onDone }: { field: FilterField; onDone?: () => void }) {
  const { all, filters, setOnly } = useStore()
  const [q, setQ] = React.useState('')
  const base = React.useMemo(() => applyFilters(all, filters, field), [all, filters, field])
  const counts = React.useMemo(() => {
    const c = countBy(base, (r) => {
      const v = (r as unknown as Record<string, unknown>)[field]
      return v == null ? null : String(v)
    })
    if (field === 'month') c.sort((a, b) => a.key.localeCompare(b.key))
    return c
  }, [base, field])
  const sel = new Set(filters.sel[field] ?? [])
  const list = counts.filter((c) => !q || valueLabel(field, c.key).toLowerCase().includes(q.toLowerCase()))
  const toggle = (v: string) => {
    const next = new Set(sel)
    next.has(v) ? next.delete(v) : next.add(v)
    setOnly(field, [...next])
  }
  return (
    <div className="flex max-h-[360px] flex-col">
      {counts.length > 8 && (
        <div className="border-b p-2">
          <div className="flex items-center gap-2 rounded-md border bg-background px-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${FILTER_FIELDS[field].toLowerCase()}…`}
              className="h-8 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto p-1 scrollbar-thin">
        {list.map((c) => (
          <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
            <Checkbox checked={sel.has(c.key)} onCheckedChange={() => toggle(c.key)} />
            <span className="min-w-0 flex-1 truncate" title={c.key}>{valueLabel(field, c.key)}</span>
            <span className="text-[12px] tabular text-muted-foreground">{fmt(c.count)}</span>
          </label>
        ))}
        {!list.length && <div className="p-3 text-center text-[12px] text-muted-foreground">No values</div>}
      </div>
      {(sel.size > 0 || onDone) && (
        <div className="flex items-center justify-between border-t p-2">
          <Button variant="ghost" size="xs" disabled={!sel.size} onClick={() => setOnly(field, [])}>Clear</Button>
          {onDone && <Button size="xs" onClick={onDone}>Done</Button>}
        </div>
      )}
    </div>
  )
}

function FacetButton({ field }: { field: FilterField }) {
  const { filters } = useStore()
  const [open, setOpen] = React.useState(false)
  const n = filters.sel[field]?.length ?? 0
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8 font-normal', n && 'border-primary/40 bg-accent text-accent-foreground')}>
          {FILTER_FIELDS[field]}
          {n > 0 && <span className="rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{n}</span>}
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px]"><FacetList field={field} onDone={() => setOpen(false)} /></PopoverContent>
    </Popover>
  )
}

function DateRange() {
  const { filters, setFilters, ds } = useStore()
  const min = React.useMemo(() => ds.records.reduce((m, r) => (r.receipt < m ? r.receipt : m), '9999'), [ds])
  const max = ds.asOf
  const last = React.useMemo(() => ds.records.reduce((m, r) => (r.receipt > m ? r.receipt : m), '0000'), [ds])
  const years = React.useMemo(() => [...new Set(ds.records.map((r) => r.receipt.slice(0, 4)))].sort(), [ds])
  const shift = (days: number) => {
    const d = new Date(max + 'T00:00:00')
    d.setDate(d.getDate() - days)
    return d.toISOString().slice(0, 10)
  }
  const presets = [
    { label: 'Whole period', from: min, to: max },
    { label: 'Last 30 days received', from: shift(29), to: max },
    { label: 'Last 90 days received', from: shift(89), to: max },
    ...years.map((y) => ({ label: `Received in ${y}`, from: `${y}-01-01`, to: y === last.slice(0, 4) ? max : `${y}-12-31` })),
  ]
  const isAll = filters.from === min && filters.to === max
  const cur = presets.find((p) => p.from === filters.from && p.to === filters.to)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8 font-normal', !isAll && 'border-primary/40 bg-accent text-accent-foreground')}>
          <CalendarDays className="opacity-60" />
          {cur ? cur.label : `${fmtDate(filters.from)} – ${fmtDate(filters.to)}`}
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-1">
        {presets.map((p) => (
          <button key={p.label} onClick={() => setFilters((f) => ({ ...f, from: p.from, to: p.to }))}
            className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-accent', cur?.label === p.label && 'font-semibold')}>
            {p.label}{cur?.label === p.label && <span className="text-primary">✓</span>}
          </button>
        ))}
        <div className="mt-1 grid grid-cols-2 gap-2 border-t p-2">
          <label className="text-[11px] text-muted-foreground">From
            <input type="date" value={filters.from} min={min} max={filters.to} onChange={(e) => e.target.value && setFilters((f) => ({ ...f, from: e.target.value }))}
              className="mt-1 h-8 w-full rounded-md border bg-background px-1.5 text-[12px] text-foreground" />
          </label>
          <label className="text-[11px] text-muted-foreground">To
            <input type="date" value={filters.to} min={filters.from} max={max} onChange={(e) => e.target.value && setFilters((f) => ({ ...f, to: e.target.value }))}
              className="mt-1 h-8 w-full rounded-md border bg-background px-1.5 text-[12px] text-foreground" />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MoreFilters() {
  const { filters } = useStore()
  const n = PANEL_FILTERS.reduce((s, f) => s + (filters.sel[f]?.length ? 1 : 0), 0)
  const [openField, setOpenField] = React.useState<FilterField | null>(null)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8 font-normal', n && 'border-primary/40 bg-accent text-accent-foreground')}>
          <SlidersHorizontal className="opacity-60" />More filters
          {n > 0 && <span className="rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{n}</span>}
        </Button>
      </DialogTrigger>
      <SheetContent>
        <div className="border-b p-5 pr-12">
          <DialogTitle className="text-base">More filters</DialogTitle>
          <DialogDescription className="mt-1 text-[13px]">Every filter applies to all pages. Counts update as you choose.</DialogDescription>
        </div>
        <div className="flex-1 space-y-1 overflow-auto p-3 scrollbar-thin">
          {[...PRIMARY_FILTERS, ...PANEL_FILTERS].map((f) => {
            const sel = filters.sel[f] ?? []
            const open = openField === f
            return (
              <div key={f} className={cn('rounded-lg border', open && 'border-primary/30 shadow-sm', PRIMARY_FILTERS.includes(f) && 'md:hidden')}>
                <button onClick={() => setOpenField(open ? null : f)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-medium">
                  <span>{FILTER_FIELDS[f]}</span>
                  <span className="flex items-center gap-2">
                    {sel.length > 0 && <span className="max-w-[160px] truncate text-[12px] font-normal text-primary">{sel.length === 1 ? valueLabel(f, sel[0]) : `${sel.length} selected`}</span>}
                    <ChevronDown className={cn('h-4 w-4 opacity-50 transition', open && 'rotate-180')} />
                  </span>
                </button>
                {open && <div className="border-t"><FacetList field={f} /></div>}
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Dialog>
  )
}

export function FilterBar() {
  const { filters, setFilters, setOnly, rows, all, ds } = useStore()
  const [q, setQ] = React.useState(filters.search)
  React.useEffect(() => setQ(filters.search), [filters.search])
  React.useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === q ? f : { ...f, search: q })), 250)
    return () => clearTimeout(t)
  }, [q, setFilters])
  const min = React.useMemo(() => ds.records.reduce((m, r) => (r.receipt < m ? r.receipt : m), '9999'), [ds])

  const chips = (Object.entries(filters.sel) as [FilterField, string[]][]).flatMap(([f, vs]) => (vs ?? []).map((v) => ({ f, v })))
  const dirty = chips.length > 0 || filters.search || filters.excludeCampaigns || filters.from !== min || filters.to !== ds.asOf

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases…"
            aria-label="Search grievances"
            className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-7 text-[13px] shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
          {q && <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <DateRange />
        <div className="hidden items-center gap-2 md:flex">
          {PRIMARY_FILTERS.map((f) => <FacetButton key={f} field={f} />)}
        </div>
        <MoreFilters />
        <label className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
          <Switch checked={!filters.excludeCampaigns} onCheckedChange={(v) => setFilters((f) => ({ ...f, excludeCampaigns: !v }))} aria-label="Include mass campaigns" />
          Include mass campaigns
        </label>
      </div>
      {(dirty || rows.length !== all.length) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] text-muted-foreground"><b className="tabular text-foreground">{fmt(rows.length)}</b> of {fmt(all.length)} grievances</span>
          {chips.map(({ f, v }) => (
            <span key={f + v} className="inline-flex items-center gap-1 rounded-md border bg-card py-0.5 pl-2 pr-1 text-[12px]">
              <span className="text-muted-foreground">{FILTER_FIELDS[f]}:</span>
              <span className="max-w-[220px] truncate font-medium">{valueLabel(f, v)}</span>
              <button onClick={() => setOnly(f, (filters.sel[f] ?? []).filter((x) => x !== v))} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Remove ${FILTER_FIELDS[f]} filter`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filters.excludeCampaigns && <span className="rounded-md border bg-card px-2 py-0.5 text-[12px]">Campaigns excluded</span>}
          {dirty && (
            <Button variant="ghost" size="xs" onClick={() => setFilters(emptyFilters(min, ds.asOf))}><RotateCcw />Reset all</Button>
          )}
        </div>
      )}
    </div>
  )
}
