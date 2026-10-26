import * as React from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, CornerDownLeft, FileText, Flag, Inbox, Send, ShieldCheck, Undo2, CheckCircle2, Clock3 } from 'lucide-react'
import type { Grievance } from '@/types'
import { useStore } from '@/store'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DaysPill, QualityPill, StatusPill } from './kit'
import { SegmentBar } from '@/charts/Composite'
import { fmt } from '@/data'
import { fmtDate } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { grievanceGist } from './CasePanel'

function KV({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-[13px] text-foreground">{children || '–'}</div>
    </div>
  )
}

const stepIcon = (a: string) => {
  const s = a.toLowerCase()
  if (s.includes('received')) return <Inbox className="h-3.5 w-3.5" />
  if (s.includes('not pertaining')) return <Undo2 className="h-3.5 w-3.5" />
  if (s.includes('disposed') && !s.includes('report')) return <CheckCircle2 className="h-3.5 w-3.5" />
  if (s.includes('report sent')) return <CornerDownLeft className="h-3.5 w-3.5" />
  if (s.includes('reminder')) return <Flag className="h-3.5 w-3.5" />
  return <Send className="h-3.5 w-3.5" />
}

export function CaseDialog({ item, onClose, onPrev, onNext, position }: {
  item: Grievance | null
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  position?: string
}) {
  const { office, ds, open } = useStore()
  const hasText = item?.description != null || item?.reply != null
  const saiSet = React.useMemo(() => new Set(ds.saiOffices), [ds])
  React.useEffect(() => {
    if (!item) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
      if (e.key === 'ArrowRight' && onNext) onNext()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [item, onPrev, onNext])

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0" hideClose>
        {item && (
          <>
            <div className="border-b bg-muted/30 px-6 pb-4 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <StatusPill disposed={item.disposed} />
                    <DaysPill days={item.disposed ? item.days : item.pendingAge} pending={!item.disposed} />
                    {item.misroutes > 0 && <Badge variant="critical">{item.misroutes} misroute{item.misroutes > 1 ? 's' : ''}</Badge>}
                    {item.sai && <Badge variant="info">Went through SAI</Badge>}
                    {item.campaign && <Badge variant="outline">{item.campaign}</Badge>}
                  </div>
                  <DialogTitle className="font-mono text-lg tracking-tight">{item.id}</DialogTitle>
                  <DialogDescription className="mt-0.5 text-[13px]">
                    Received {fmtDate(item.receipt)} via {item.source} · {item.channel} · {item.theme}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {position && <span className="mr-1 hidden text-[12px] text-muted-foreground sm:inline">{position}</span>}
                  <Button variant="outline" size="icon-sm" onClick={onPrev} disabled={!onPrev} aria-label="Previous case"><ChevronLeft /></Button>
                  <Button variant="outline" size="icon-sm" onClick={onNext} disabled={!onNext} aria-label="Next case"><ChevronRight /></Button>
                  <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
                </div>
              </div>
            </div>

            <Tabs defaultValue="summary" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-6 py-2">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="timeline">Movement ({item.steps.length} steps)</TabsTrigger>
                  {hasText && <TabsTrigger value="text">Grievance text</TabsTrigger>}
                  <TabsTrigger value="reply">Reply</TabsTrigger>
                </TabsList>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-6 py-5 scrollbar-thin">
                <TabsContent value="summary" className="mt-0 space-y-5">
                  {!hasText && (
                    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-good)]" />
                      <span>The grievance and reply text are not published on this public dashboard. Routing, timing and outcome are shown below{item.disposed ? <> · reply classified as <b className="text-foreground">{item.replyType}</b></> : null}.</span>
                    </div>
                  )}
                  {hasText && <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">What the citizen wrote</div>
                      <p className="line-clamp-[8] text-[13px] leading-relaxed">{grievanceGist(item, 1200) || 'No readable text (scanned or blank petition).'}</p>
                    </div>
                    <div className={cn('rounded-lg border p-4', item.disposed && 'border-[color:color-mix(in_srgb,var(--series-1)_35%,transparent)]')}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Reply sent{item.disposed && <Badge variant="secondary" className="normal-case tracking-normal">{item.replyType}</Badge>}
                      </div>
                      <p className="line-clamp-[8] whitespace-pre-wrap text-[13px] leading-relaxed">{item.disposed ? (item.reply?.trim() || '—') : 'No reply yet — the grievance is pending.'}</p>
                    </div>
                  </div>}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                    <KV label="Days to dispose">{item.disposed ? `${fmt(item.days)} days` : `Pending · ${fmt(item.pendingAge)} days old`}</KV>
                    <KV label="Manual transfers">{fmt(item.transfers)} <span className="text-muted-foreground">({fmt(item.offices)} offices)</span></KV>
                    <KV label={item.disposed ? 'Closed by' : 'Currently with'}>{item.owner}</KV>
                    <KV label="Reply quality"><QualityPill band={item.qualityBand} score={item.quality} /></KV>
                    <KV label="CPGRAMS category">{item.catL1}{item.catL2 ? ` › ${item.catL2}` : ''}</KV>
                    <KV label="Cause (officer)">{item.cause}</KV>
                    <KV label="Resolution recorded">{item.resolution}</KV>
                    <KV label="Language">{item.language}</KV>
                  </div>

                  {(item.refiledSame || item.followUpOf || item.refiledAny) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[color:color-mix(in_srgb,var(--status-warning)_55%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_8%,transparent)] px-4 py-3 text-[13px]">
                      {item.refiledSame && <span>The same citizen <b>filed again on this issue</b> after it was disposed: <button className="font-mono font-medium underline underline-offset-2" onClick={() => open(item.refiledSame!)}>{item.refiledSame}</button></span>}
                      {!item.refiledSame && item.refiledAny && <span>The same citizen filed another grievance after this one was disposed: <button className="font-mono font-medium underline underline-offset-2" onClick={() => open(item.refiledAny!)}>{item.refiledAny}</button></span>}
                      {item.followUpOf && <span>This repeats an earlier, already-disposed grievance: <button className="font-mono font-medium underline underline-offset-2" onClick={() => open(item.followUpOf!)}>{item.followUpOf}</button></span>}
                    </div>
                  )}

                  {item.sai && (
                    <div className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold">Journey through SAI</div>
                        <Badge variant={item.sai.pending ? 'warning' : 'secondary'}>{item.sai.outcome}</Badge>
                      </div>
                      <SegmentBar
                        format={(v) => `${fmt(v)}d`}
                        segments={[
                          { key: 'a', label: 'Citizen → Ministry', value: item.sai.dRecMin ?? 0, color: 'var(--seq-250)' },
                          { key: 'b', label: 'Ministry → SAI', value: item.sai.dMinSai ?? 0, color: 'var(--seq-450)' },
                          { key: 'c', label: 'SAI HQ → division', value: item.sai.dHq ?? 0, color: 'var(--series-7)' },
                          { key: 'd', label: 'Inside SAI division', value: item.sai.dDiv ?? 0, color: 'var(--series-2)' },
                          { key: 'e', label: 'Back at Ministry', value: item.sai.dAfter ?? 0, color: 'var(--neutral-mark)' },
                        ]}
                      />
                      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
                        <KV label="Sent to SAI by">{item.saiSender}</KV>
                        <KV label="Handled by">{item.saiHandler}</KV>
                        <KV label="SAI offices">{item.sai.offices?.split(' > ').map((c) => office(c)).join(' → ')}</KV>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border p-4">
                    <div className="mb-3 text-[13px] font-semibold">Where it came from</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                      <KV label="State / district">{item.state}{item.district ? ` · ${item.district}` : ''}</KV>
                      <KV label="Filings by the same citizen">{fmt(item.filings)}</KV>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-0">
                  <ol className="relative space-y-0">
                    {item.steps.map((s, i) => {
                      const bad = s.action.toLowerCase().includes('not pertaining')
                      const done = s.action.toLowerCase().includes('disposed of')
                      const inSai = (s.to && saiSet.has(s.to)) || (s.from && saiSet.has(s.from))
                      return (
                        <li key={i} className="relative flex gap-4 pb-4">
                          {i < item.steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-border" />}
                          <span className={cn('relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground',
                            bad && 'border-[var(--status-critical)] text-[var(--critical-ink)]', done && 'border-[var(--status-good)] text-[var(--good-ink)]')}>
                            {stepIcon(s.action)}
                          </span>
                          <div className={cn('min-w-0 flex-1 rounded-lg border px-3.5 py-2.5', bad && 'border-[color:color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_5%,transparent)]')}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[13px] font-medium">{s.action}</span>
                              <span className="text-[12px] text-muted-foreground">{fmtDate(s.date)}</span>
                              {s.gap != null && s.gap > 0 && (
                                <Badge variant={s.gap > 21 ? 'critical' : s.gap > 7 ? 'warning' : 'secondary'} className="gap-1"><Clock3 />{s.gap}d with {office(s.from)}</Badge>
                              )}
                              {inSai && <Badge variant="info">SAI</Badge>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                              <span className="text-foreground">{office(s.from)}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="text-foreground">{office(s.to)}</span>
                            </div>
                            {s.remarks && <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">{s.remarks}</p>}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </TabsContent>

                {hasText && (
                  <TabsContent value="text" className="mt-0">
                    <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-[13px] leading-relaxed">{item.description || 'No text'}</div>
                  </TabsContent>
                )}

                <TabsContent value="reply" className="mt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <KV label="Reply type">{item.replyType}</KV>
                    <KV label="Format">{item.replyFormat}</KV>
                    <KV label="Same text used">{item.replyReuse > 1 ? `${fmt(item.replyReuse)} times` : 'Once'}</KV>
                    <KV label="Quality"><QualityPill band={item.qualityBand} score={item.quality} /></KV>
                  </div>
                  {item.mismatch && (
                    <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--status-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_5%,transparent)] px-3.5 py-2.5 text-[13px]">
                      Recorded as <b>Fully Resolved</b>, but the reply deflects or carries no usable text.
                    </div>
                  )}
                  {hasText && <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-[13px] leading-relaxed">{item.reply || 'No reply yet — the grievance is pending.'}</div>}
                  {item.sai?.text && (
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" />SAI's own reply / report</div>
                      <div className="whitespace-pre-wrap rounded-lg border p-4 text-[13px] leading-relaxed">{item.sai.text}</div>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
