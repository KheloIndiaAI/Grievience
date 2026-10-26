import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { fmt } from '@/data'

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  sort?: (row: T) => number | string | null | undefined
  align?: 'left' | 'right' | 'center'
  className?: string
  headClassName?: string
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

export function DataTable<T>({
  rows, columns, rowKey, onRowClick, pageSize = 15, initialSort, dense, maxHeight, emptyText = 'No records match the current filters.', footerNote,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (r: T) => string
  onRowClick?: (r: T, sorted: T[]) => void
  pageSize?: number | null
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  dense?: boolean
  maxHeight?: number
  emptyText?: string
  footerNote?: React.ReactNode
}) {
  const [sort, setSort] = React.useState(initialSort ?? null)
  const [page, setPage] = React.useState(0)
  React.useEffect(() => setPage(0), [rows.length, sort?.key, sort?.dir])

  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sort) return rows
    const f = col.sort
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = f(a), y = f(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (x < y ? -1 : x > y ? 1 : 0) * dir
    })
  }, [rows, sort, columns])

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const shown = pageSize ? sorted.slice(page * pageSize, page * pageSize + pageSize) : sorted

  const clickSort = (c: Column<T>) => {
    if (!c.sort) return
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: c.key, dir: 'desc' }))
  }

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-lg border scrollbar-thin" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-[1] bg-muted/90 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th key={c.key}
                  className={cn('whitespace-nowrap px-3 py-2 text-[12px] font-medium text-muted-foreground', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.hideBelow && hide[c.hideBelow], c.headClassName)}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button onClick={() => clickSort(c)} className={cn('inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', c.align === 'right' && 'flex-row-reverse')}>
                      {c.header}
                      {sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">{emptyText}</td></tr>
            )}
            {shown.map((r) => (
              <tr key={rowKey(r)} onClick={() => onRowClick?.(r, sorted)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(r, sorted) } }}
                className={cn('border-t transition-colors', onRowClick && 'cursor-pointer hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none')}>
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 align-middle', dense ? 'py-1.5' : 'py-2.5', c.align === 'right' ? 'text-right tabular' : c.align === 'center' ? 'text-center' : 'text-left', c.hideBelow && hide[c.hideBelow], c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(pageSize && sorted.length > pageSize) || footerNote ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span>{footerNote ?? <>Showing <b className="text-foreground">{fmt(page * (pageSize ?? 0) + 1)}–{fmt(Math.min(sorted.length, (page + 1) * (pageSize ?? 0)))}</b> of {fmt(sorted.length)}</>}</span>
          {pageSize && sorted.length > pageSize && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft /></Button>
              <span className="px-2 tabular">Page {page + 1} of {pages}</span>
              <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight /></Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
