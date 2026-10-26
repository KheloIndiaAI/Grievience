import * as React from 'react'
import { cn } from '@/lib/utils'
import { fmt } from '@/data'
import { Hint } from '@/components/ui/tooltip'

export interface BarItem {
  key: string
  label?: React.ReactNode
  value: number
  color?: string
  /** Extra right-hand columns (already formatted) */
  extra?: React.ReactNode[]
  tooltip?: React.ReactNode
  muted?: boolean
}

/**
 * Ranked horizontal bars rendered in HTML so long labels never get clipped.
 * Click a row to drill (filters the dashboard).
 */
export function BarList({
  items, onSelect, selected, valueFormat = (v) => fmt(v), extraHeaders, valueHeader, max, color = 'var(--series-1)', limit, labelWidth = 'minmax(0,1fr)', compact,
}: {
  items: BarItem[]
  onSelect?: (key: string) => void
  selected?: string[]
  valueFormat?: (v: number) => string
  extraHeaders?: string[]
  valueHeader?: string
  max?: number
  color?: string
  limit?: number
  labelWidth?: string
  compact?: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const shown = limit && !expanded ? items.slice(0, limit) : items
  const m = max ?? Math.max(1, ...items.map((i) => i.value))
  const sel = new Set(selected ?? [])
  const cols = `${labelWidth} 3.25rem${extraHeaders ? ' ' + extraHeaders.map(() => '4.25rem').join(' ') : ''}`
  return (
    <div className="space-y-1">
      {(valueHeader || extraHeaders) && (
        <div className="grid items-end gap-x-3 px-2 pb-1 text-[11px] font-medium text-muted-foreground" style={{ gridTemplateColumns: cols }}>
          <span />
          <span className="text-right">{valueHeader}</span>
          {extraHeaders?.map((h) => <span key={h} className="text-right leading-tight">{h}</span>)}
        </div>
      )}
      {shown.map((it) => {
        const active = sel.has(it.key)
        const row = (
          <button
            key={it.key}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(it.key)}
            className={cn(
              'group grid w-full items-center gap-x-3 rounded-md px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              compact ? 'py-1' : 'py-1.5',
              onSelect && 'hover:bg-accent/60 cursor-pointer',
              active && 'bg-accent',
            )}
            style={{ gridTemplateColumns: cols }}
          >
            <span className="relative min-w-0">
              <span className="relative z-[1] block truncate pb-1 text-[13px] text-foreground" title={typeof it.label === 'string' ? it.label : it.key}>{it.label ?? it.key}</span>
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className={cn('block h-full rounded-full transition-[width] duration-500', it.muted && 'opacity-40')}
                  style={{ width: `${Math.max(1.5, (it.value / m) * 100)}%`, background: it.color ?? color }}
                />
              </span>
            </span>
            <span className="text-right text-[13px] font-medium tabular text-foreground">{valueFormat(it.value)}</span>
            {it.extra?.map((e, i) => <span key={i} className="text-right text-[12px] tabular text-muted-foreground">{e}</span>)}
          </button>
        )
        return it.tooltip ? <Hint key={it.key} label={it.tooltip}>{row}</Hint> : row
      })}
      {limit && items.length > limit && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 w-full rounded-md py-1.5 text-center text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground">
          {expanded ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  )
}
