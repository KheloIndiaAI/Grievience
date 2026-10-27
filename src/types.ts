export interface Step {
  n: number
  action: string
  date: string
  from: string | null
  to: string | null
  /** officer notes — absent in the public (redacted) dataset */
  remarks?: string
  gap: number | null
}

export interface SaiJourney {
  entry: string
  sender: string | null
  entryOffice: string | null
  handler: string | null
  dRecMin: number | null
  dMinSai: number | null
  dRecSai: number | null
  dHq: number | null
  dDiv: number | null
  dIn: number | null
  dAfter: number | null
  outcome: string
  pending: boolean
  hops: number | null
  offices: string | null
  /** SAI report text — absent in the public dataset */
  text?: string | null
}

export interface Grievance {
  id: string
  // Personal data: present only in the INTERNAL export, stripped from the public dataset
  // by data-pipeline/redact_dataset.py. Never rely on these in public-facing UI.
  name?: string | null
  mobile?: string | null
  email?: string | null
  address?: string | null
  /** anonymised complainant key (HMAC of mobile, per-release); public dataset only */
  cid?: string | null
  district: string | null
  state: string
  receipt: string
  month: string
  weekday: string
  source: string
  channel: string
  receivedBy: string | null
  nodal: string | null
  division: string | null
  holder: string | null
  idleDays: number | null
  catL1: string
  catL2: string | null
  theme: string
  themeFull: string
  language: string
  campaign: string | null
  disposed: boolean
  disposalDate: string | null
  days: number | null
  daysAtMinistry: number | null
  pendingAge: number | null
  transfers: number
  hops: number
  misroutes: number
  offices: number
  reminders: number
  interim: number
  path: string
  agree: string | null
  cause: string | null
  resolution: string | null
  replyType: string
  replyLen: number
  replyReuse: number
  template: boolean
  specifics: boolean
  overlap: number | null
  quality: number | null
  qualityBand: string | null
  mismatch: boolean
  filings: number
  /** complaint / reply text — internal dataset only */
  description?: string | null
  reply?: string | null
  replyFormat: string
  replyFamily: number
  sai: SaiJourney | null
  steps: Step[]
  // ---- derived on load
  status: 'Disposed' | 'Pending'
  sla: 'Within 21 days' | 'Beyond 21 days' | 'Pending'
  daysBucket: string | null
  pendingBucket: string | null
  transferBucket: string
  divisionLabel: string
  holderName: string | null
  campaignLabel: string
  causeLabel: string
  resolutionLabel: string
  misrouted: 'Misrouted' | 'Not misrouted'
  saiLabel: 'Went through SAI' | 'Did not go to SAI'
  saiHandler: string | null
  saiSender: string | null
  sourceShort: string
  pathNamed: string
  // ---- executive
  ownerCode: string | null
  owner: string
  answered: boolean
  genuine21: boolean
  outOfMandate: boolean
  noText: boolean
  stuck: boolean
  untouched: boolean
  repeatFiling: boolean
  outcome: 'Pending' | 'Answered' | 'Deflected / out of mandate' | 'No usable text' | 'Other reply'
  daysToDesk: number | null
  daysAtDesk: number | null
  refiledAny: string | null
  refiledSame: string | null
  followUpOf: string | null
  saiRelation: 'Sent to SAI' | 'About SAI, not sent to SAI' | 'Not SAI-related'
  _search: string
}

export interface Dataset {
  /** true for the public build: no personal data or free text, re-filing fields precomputed */
  redacted?: boolean
  /** years whose CPGRAMS pull is incomplete */
  coverage?: { label: string; pulled: number; listed: number }[]
  asOf: string
  slaDays: number
  offices: Record<string, string>
  saiOffices: string[]
  records: Grievance[]
}
