import * as React from 'react'
import {
  LayoutDashboard, Tags, Route, Building2, Search, Workflow, Menu, Moon, Sun, Database, Printer, ShieldCheck, ShieldAlert, Eye, EyeOff,
} from 'lucide-react'
import type { Dataset, Grievance } from './types'
import { loadData, fmt } from './data'
import { StoreCtx, emptyFilters, applyFilters, PAGES, type Filters, type FilterField, type PageId, type Store } from './store'
import { FilterBar } from './components/FilterBar'
import { CaseDialog } from './components/CaseDialog'
import { TooltipProvider, Hint } from './components/ui/tooltip'
import { Dialog, SheetContent, DialogTitle } from './components/ui/dialog'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'
import { fmtDate } from './lib/labels'

import { OverviewPage } from './pages/Overview'
import { NaturePage } from './pages/Nature'
import { FlowPage } from './pages/Flow'
import { RoutingPage } from './pages/Routing'
import { DivisionsPage } from './pages/Divisions'
import { CasePanel } from './components/CasePanel'
import { QuickFind } from './components/QuickFind'
import type { CasePanelSpec } from './store'

const ICONS: Record<PageId, React.ElementType> = {
  overview: LayoutDashboard, flow: Workflow, nature: Tags, routing: Route, divisions: Building2,
}

const readHash = (): PageId => {
  const h = window.location.hash.replace(/^#\/?/, '') as PageId
  return PAGES.some((p) => p.id === h) ? h : 'overview'
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0f2a4f] text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 18V11M12 18V6M18 18v-4" /></svg>
        <span className="absolute inset-x-0 bottom-0 flex h-[3px]"><span className="flex-1 bg-[#f2994a]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#2e9e4f]" /></span>
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[14px] font-semibold tracking-tight text-foreground">Grievance Analytics</div>
        <div className="truncate text-[11px] text-muted-foreground">MoYAS · CPGRAMS</div>
      </div>
    </div>
  )
}

function Nav({ page, goto, pending, saiPending }: { page: PageId; goto: (p: PageId) => void; pending: number; saiPending: number }) {
  const groups = [...new Set(PAGES.map((p) => p.group))]
  return (
    <nav className="space-y-5 px-3 pb-4" aria-label="Dashboard pages">
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">{g}</div>
          <ul className="space-y-0.5">
            {PAGES.filter((p) => p.group === g).map((p) => {
              const Icon = ICONS[p.id]
              const active = page === p.id
              return (
                <li key={p.id}>
                  <button
                    onClick={() => goto(p.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-sidebar-accent text-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-card text-[11px] font-semibold tabular">{PAGES.findIndex((x) => x.id === p.id) + 1}</span>
                    <span className="min-w-0 flex-1 text-left leading-tight">
                      <span className="flex items-center gap-1.5"><Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />{p.label}</span>
                      <span className="block truncate text-[11.5px] font-normal text-muted-foreground">{p.question}</span>
                    </span>
                    {p.id === 'divisions' && pending > 0 && <span className="rounded-full bg-[color-mix(in_srgb,var(--status-critical)_14%,transparent)] px-1.5 text-[10.5px] font-semibold tabular text-[var(--critical-ink)]">{pending}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

const maxReceipt = (ds: Dataset) => ds.records.reduce((m, r) => (r.receipt > m ? r.receipt : m), '0000')

function SidebarFooter({ ds }: { ds: Dataset }) {
  const min = ds.records.reduce((m, r) => (r.receipt < m ? r.receipt : m), '9999')
  return (
    <div className="m-3 rounded-lg border bg-background/60 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><Database className="h-3.5 w-3.5" />Data source</div>
      CPGRAMS export · {fmt(ds.records.length)} grievances received {fmtDate(min)} – {fmtDate(maxReceipt(ds))}, status as of {fmtDate(ds.asOf)}. Deadline used: {ds.slaDays} days.
      {ds.coverage?.map((c) => <span key={c.label}> {c.label} is a partial pull: {fmt(c.pulled)} of {fmt(c.listed)} grievances.</span>)}
      {ds.redacted ? (
        <div className="mt-2 flex items-start gap-1.5 border-t pt-2">
          <ShieldCheck className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[var(--status-good)]" />
          <span>Public view. Complainant names, contact details and the text of grievances and replies are not published.</span>
        </div>
      ) : (
        <div className="mt-2 flex items-start gap-1.5 border-t pt-2">
          <ShieldAlert className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[var(--status-serious)]" />
          <span><b className="font-medium text-foreground">Internal view.</b> Includes grievance and reply text and complainant details. For official use only; do not share screenshots or exports outside the Ministry.</span>
        </div>
      )}
    </div>
  )
}

export function App() {
  const [ds, setDs] = React.useState<Dataset | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState<PageId>(readHash)
  const [filters, setFilters] = React.useState<Filters | null>(null)
  const [openList, setOpenList] = React.useState<{ id: string; list: string[] } | null>(null)
  const [panel, setPanel] = React.useState<CasePanelSpec | null>(null)
  const [dark, setDark] = React.useState(() => document.documentElement.classList.contains('dark'))
  const [navOpen, setNavOpen] = React.useState(false)
  const mainRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    loadData().then((d) => {
      setDs(d)
      const min = d.records.reduce((m, r) => (r.receipt < m ? r.receipt : m), '9999')
      setFilters(emptyFilters(min, d.asOf))
    }).catch((e) => setError(e.message || 'Failed to load data'))
    const onHash = () => setPage(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])

  const rows = React.useMemo(() => (ds && filters ? applyFilters(ds.records, filters) : []), [ds, filters])
  const byId = React.useMemo(() => new Map((ds?.records ?? []).map((r) => [r.id, r])), [ds])

  const goto = React.useCallback((p: PageId) => {
    window.location.hash = `/${p}`
    setPage(p)
    setNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [])

  const [showPII, setShowPII] = React.useState(false)
  const store: Store | null = React.useMemo(() => {
    if (!ds || !filters) return null
    const setOnly = (field: FilterField, values: string[]) => setFilters((p) => p && ({ ...p, sel: { ...p.sel, [field]: values } }))
    return {
      ds, all: ds.records, rows, filters, showPII: !ds.redacted && showPII,
      setFilters: (f) => setFilters((p) => (typeof f === 'function' ? f(p!) : f)),
      toggle: (field, value) => setFilters((p) => {
        if (!p) return p
        const cur = p.sel[field] ?? []
        return { ...p, sel: { ...p.sel, [field]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] } }
      }),
      setOnly,
      drill: (field, value, to) => {
        setFilters((p) => {
          if (!p) return p
          const cur = p.sel[field] ?? []
          const only = cur.length === 1 && cur[0] === value
          return { ...p, sel: { ...p.sel, [field]: only ? [] : [value] } }
        })
        if (to) goto(to)
      },
      open: (id, list) => setOpenList({ id, list: list ?? [id] }),
      goto,
      office: (c) => (c ? ds.offices[c] || c : '–'),
      showCases: (spec) => setPanel(spec),
    }
  }, [ds, filters, rows, goto, showPII])

  if (error) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><h2 className="text-lg font-semibold">Could not load the dashboard</h2><p className="mt-1 text-sm text-muted-foreground">{error}</p></div></div>
  }
  if (!store || !ds) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          Loading grievance records…
        </div>
      </div>
    )
  }

  const current: Grievance | null = openList ? byId.get(openList.id) ?? null : null
  const idx = openList ? openList.list.indexOf(openList.id) : -1
  const pendingN = ds.records.filter((r) => r.stuck).length
  const saiPendingN = ds.records.filter((r) => r.sai?.pending).length
  const meta = PAGES.find((p) => p.id === page)!

  const Page = { overview: OverviewPage, flow: FlowPage, nature: NaturePage, routing: RoutingPage, divisions: DivisionsPage }[page]

  return (
    <StoreCtx.Provider value={store}>
      <TooltipProvider delayDuration={150}>
        <div className="min-h-screen bg-background">
          {/* sidebar (desktop) */}
          <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
            <Brand />
            <div className="flex-1 overflow-y-auto scrollbar-thin"><Nav page={page} goto={goto} pending={pendingN} saiPending={saiPendingN} /></div>
            <SidebarFooter ds={ds} />
          </aside>
          {/* sidebar (mobile) */}
          <Dialog open={navOpen} onOpenChange={setNavOpen}>
            <SheetContent side="left" className="w-[272px] bg-sidebar p-0">
              <DialogTitle className="sr-only">Navigation</DialogTitle>
              <Brand />
              <div className="flex-1 overflow-y-auto"><Nav page={page} goto={goto} pending={pendingN} saiPending={saiPendingN} /></div>
              <SidebarFooter ds={ds} />
            </SheetContent>
          </Dialog>

          <div className="print-full lg:pl-[256px]">
            <header className="no-print sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
              <div className="flex h-12 items-center gap-2 px-4 lg:px-8">
                <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open navigation"><Menu /></Button>
                <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
                  <span className="truncate font-medium">{meta.label}</span>
                  <span className="hidden truncate text-muted-foreground xl:inline">· {meta.question}</span>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <QuickFind />
                  <Hint label="Print this screen / save as PDF">
                    <Button variant="ghost" size="icon-sm" onClick={() => window.print()} aria-label="Print"><Printer /></Button>
                  </Hint>
                  {!ds.redacted && (
                    <Hint label={showPII ? 'Hide complainant names and contacts' : 'Show complainant names and contacts'}>
                      <Button variant={showPII ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowPII((v) => !v)} aria-pressed={showPII} aria-label="Personal details">
                        {showPII ? <Eye /> : <EyeOff />}<span className="hidden 2xl:inline">{showPII ? 'Personal details shown' : 'Personal details hidden'}</span>
                      </Button>
                    </Hint>
                  )}
                  <span className="mr-2 hidden items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2.5 py-0.5 text-[11.5px] text-muted-foreground xl:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-good)]" />Data as of {fmtDate(ds.asOf)}
                  </span>
                  <Hint label={dark ? 'Light theme' : 'Dark theme'}>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button>
                  </Hint>
                </div>
              </div>
              <div className="border-t px-4 py-2.5 lg:px-8"><FilterBar /></div>
            </header>

            <main ref={mainRef} key={page} className="mx-auto max-w-[1440px] animate-fade-in space-y-6 px-4 pb-16 pt-6 lg:px-8">
              <Page />
            </main>
          </div>
        </div>

        <CasePanel spec={panel} onClose={() => setPanel(null)} />
        <CaseDialog
          item={current}
          onClose={() => setOpenList(null)}
          position={openList && openList.list.length > 1 ? `${idx + 1} of ${openList.list.length}` : undefined}
          onPrev={openList && idx > 0 ? () => setOpenList({ ...openList, id: openList.list[idx - 1] }) : undefined}
          onNext={openList && idx >= 0 && idx < openList.list.length - 1 ? () => setOpenList({ ...openList, id: openList.list[idx + 1] }) : undefined}
        />
      </TooltipProvider>
    </StoreCtx.Provider>
  )
}
