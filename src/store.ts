import { createContext, useContext } from 'react'
import type { Dataset, Grievance } from './types'

/** Fields that can be filtered (multi-select) or drilled into by clicking a chart. */
export const FILTER_FIELDS = {
  status: 'Status',
  owner: 'Office handling it',
  outcome: 'Outcome',
  divisionLabel: 'Division / holder',
  theme: 'Theme',
  source: 'Came from',
  state: 'State',
  saiLabel: 'SAI involvement',
  saiRelation: 'SAI-related?',
  saiHandler: 'SAI office',
  saiSender: 'Sent to SAI by',
  channel: 'Channel',
  catL1: 'CPGRAMS category',
  catL2: 'Sub-category',
  causeLabel: 'Cause (officer-tagged)',
  resolutionLabel: 'Resolution type',
  replyType: 'Reply type',
  replyFormat: 'Reply format',
  qualityBand: 'Reply quality',
  sla: '21-day deadline',
  transferBucket: 'Manual transfers',
  daysBucket: 'Days to dispose',
  pendingBucket: 'Pending age',
  misrouted: 'Misrouted',
  month: 'Month',
  weekday: 'Weekday',
  language: 'Language',
  campaignLabel: 'Campaign',
  holderName: 'Current holder',
  receipt: 'Receipt date',
  path: 'Movement path',
  cid: 'Complainant (anonymised)',
} as const

export type FilterField = keyof typeof FILTER_FIELDS

/** Shown inline in the filter bar; the rest live in the "More filters" panel. */
export const PRIMARY_FILTERS: FilterField[] = ['owner', 'theme', 'catL1', 'source']
export const PANEL_FILTERS: FilterField[] = [
  'status', 'saiRelation', 'saiHandler', 'state', 'catL2', 'sla', 'channel', 'replyType', 'qualityBand', 'month', 'campaignLabel', 'language',
]

export interface Filters {
  from: string
  to: string
  search: string
  sel: Partial<Record<FilterField, string[]>>
  excludeCampaigns: boolean
}

export const emptyFilters = (from: string, to: string): Filters => ({ from, to, search: '', sel: {}, excludeCampaigns: false })

export function applyFilters(rows: Grievance[], f: Filters, skip?: FilterField): Grievance[] {
  const q = f.search.trim().toLowerCase()
  const sets = (Object.entries(f.sel) as [FilterField, string[]][])
    .filter(([k, v]) => v && v.length && k !== skip)
    .map(([k, v]) => [k, new Set(v)] as const)
  return rows.filter((r) => {
    if (r.receipt < f.from || r.receipt > f.to) return false
    if (f.excludeCampaigns && r.campaign) return false
    for (const [k, s] of sets) {
      const v = (r as unknown as Record<string, unknown>)[k]
      if (!s.has(v == null ? '' : String(v))) return false
    }
    if (q && !r._search.includes(q)) return false
    return true
  })
}

export const PAGES = [
  { id: 'overview', label: 'Overview', question: 'Received, disposed and pending', group: 'Dashboard' },
  { id: 'flow', label: 'Grievance flow', question: 'Ministry and SAI, source to status', group: 'Dashboard' },
  { id: 'nature', label: 'Nature of grievances', question: 'What the grievances are about', group: 'Dashboard' },
  { id: 'routing', label: 'Routing & bounces', question: 'How grievances move between offices', group: 'Dashboard' },
  { id: 'divisions', label: 'Divisions & SAI', question: 'Workload and pending by office', group: 'Dashboard' },
] as const

export type PageId = (typeof PAGES)[number]['id']

export interface Store {
  ds: Dataset
  all: Grievance[]
  rows: Grievance[]
  filters: Filters
  setFilters: (f: Filters | ((p: Filters) => Filters)) => void
  toggle: (field: FilterField, value: string) => void
  setOnly: (field: FilterField, values: string[]) => void
  drill: (field: FilterField, value: string, page?: PageId) => void
  open: (id: string, list?: string[]) => void
  goto: (p: PageId) => void
  office: (code: string | null | undefined) => string
  /** Open the drill-down panel listing exactly these grievances. */
  showCases: (spec: CasePanelSpec) => void
}

export interface CasePanelSpec {
  title: string
  description?: string
  rows?: Grievance[]
  tabs?: { label: string; rows: Grievance[] }[]
  /** Which text to preview under each case */
  preview?: 'reply' | 'grievance'
}

export const StoreCtx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(StoreCtx)
