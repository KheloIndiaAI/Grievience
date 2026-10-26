import * as React from 'react'
import { Search } from 'lucide-react'
import { useStore } from '@/store'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { StatusPill } from './kit'
import { fmtDate } from '@/lib/labels'

/** Find any grievance by registration number (or text) and open it — independent of filters. */
export function QuickFind() {
  const { all, open } = useStore()
  const [q, setQ] = React.useState('')
  const [focus, setFocus] = React.useState(false)
  const hits = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 3) return []
    const byId = all.filter((r) => r.id.toLowerCase().includes(s))
    const byText = byId.length >= 8 ? [] : all.filter((r) => !r.id.toLowerCase().includes(s) && r._search.includes(s))
    return [...byId, ...byText].slice(0, 8)
  }, [q, all])
  const go = (id: string) => { open(id, hits.map((h) => h.id)); setQ(''); setFocus(false) }
  return (
    <Popover open={focus && q.trim().length >= 3}>
      <PopoverAnchor asChild>
        <div className="relative mr-1 hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hits[0]) {
                // release focus first, otherwise the dialog's focus-outside handler closes it immediately
                const id = hits[0].id
                e.currentTarget.blur()
                setTimeout(() => go(id), 0)
              }
              if (e.key === 'Escape') setQ('')
            }}
            placeholder="Find a case by registration no.…"
            aria-label="Find a case by registration number"
            className="h-8 w-[220px] rounded-md border border-input bg-card pl-8 pr-2 text-[12.5px] shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-[380px] p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {hits.length ? hits.map((r) => (
          <button key={r.id} onMouseDown={(e) => e.preventDefault()} onClick={() => go(r.id)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent">
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[12px] font-medium">{r.id}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground">{fmtDate(r.receipt)} · {r.owner} · {r.theme}</span>
            </span>
            <StatusPill disposed={r.disposed} />
          </button>
        )) : <div className="p-3 text-center text-[12px] text-muted-foreground">No grievance matches “{q}”.</div>}
      </PopoverContent>
    </Popover>
  )
}
