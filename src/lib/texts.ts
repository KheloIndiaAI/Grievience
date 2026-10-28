import * as React from 'react'
import type { Dataset } from '@/types'

/* ---------------------------------------------------------------------------
   Public build: the grievance and reply text (personal details scrubbed offline
   by redact_dataset.py --texts) ships as data/texts.json, separate from the main
   dataset so the dashboard opens fast. It is fetched once, the first time a
   grievance list or a grievance is opened, and merged into the records.
   --------------------------------------------------------------------------- */

export type TextsState = 'idle' | 'loading' | 'ready' | 'none'

let state: TextsState = 'idle'
const subs = new Set<() => void>()
const set = (s: TextsState) => { state = s; subs.forEach((f) => f()) }

function load(ds: Dataset) {
  if (state !== 'idle') return
  set('loading')
  fetch('/data/texts.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((t: Record<string, { d?: string; r?: string }> | null) => {
      if (!t) return set('none')
      for (const r of ds.records) {
        const x = t[r.id]
        if (!x) continue
        r.description = x.d ?? null
        r.reply = x.r ?? null
        r._search += ' \u0001 ' + `${x.d ?? ''} ${x.r ?? ''}`.toLowerCase()
      }
      set('ready')
    })
    .catch(() => set('none'))
}

/** 'ready' once the scrubbed text is merged into the records; the internal dataset already has it. */
export function useTexts(ds: Dataset, enabled = true): TextsState {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    if (!ds.redacted || !enabled) return
    subs.add(rerender)
    load(ds)
    return () => { subs.delete(rerender) }
  }, [ds, enabled])
  return ds.redacted ? state : 'ready'
}
