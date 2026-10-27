export const THEME_SHORT: Record<string, string> = {
  'Sports Federation governance / recognition': 'Federation governance',
  'Selection / Trials / Team management': 'Selection & trials',
  'Insufficient text (scanned / blank)': 'Needs further analysis',
  'SAI centres / Infrastructure / Stadium / Hostel': 'SAI centres & infrastructure',
  'Corruption / Harassment / Vigilance': 'Corruption & vigilance',
  'Financial assistance / Scholarship / Funding': 'Financial assistance',
  'Other / Unclassified': 'Other / unclassified',
  'Jobs / Sports quota / Recruitment': 'Jobs & sports quota',
  'Awards / Cash incentives / Pension to sportspersons': 'Awards & cash incentives',
  'Certificates / Verification': 'Certificates',
  'Suggestions / Policy ideas / Sports promotion': 'Suggestions & policy',
  'Khelo India / Fit India schemes': 'Khelo India / Fit India',
  'Employee service matters (SAI/LNIPE/Ministry staff)': 'Staff service matters',
  'Doping (NADA/WADA)': 'Doping (NADA)',
  'Youth affairs (NSS / NYKS / My Bharat / Volunteers)': 'Youth affairs (NSS, NYKS)',
  'Para / Divyang sports': 'Para sports',
}

export const REPLY_SHORT: Record<string, string> = {
  'Substantive / action-taken reply': 'Substantive reply',
  'Deflection: State subject': '“State subject” deflection',
  'Attachment only (no text)': 'Attachment only',
  'Deflection: NSF / autonomous body': '“Federation decides” deflection',
  'Not pertaining / Not a grievance': 'Not pertaining / not a grievance',
  'Forwarded / under process': 'Forwarded / under process',
  'Very short / non-informative': 'Meaningless text (“.”)',
  'Duplicate / cross-referenced': 'Duplicate reference',
  'Seeking more information': 'Asks for more information',
  'No reply (pending)': 'No reply yet',
}

export const SOURCE_SHORT: Record<string, string> = {
  'Direct - Dept of Sports': 'Dept of Sports (direct)',
  "PMO (PM's Office)": 'PMO',
  'Direct - Dept of Youth Affairs': 'Dept of Youth Affairs',
  'Other Ministries (redirected in)': 'Other ministries',
  "President's Secretariat": "President's Secretariat",
  'DARPG / DPG (Cab Sectt)': 'DARPG',
}

export const CHANNEL_SHORT: Record<string, string> = {
  'Online (E)': 'Online portal',
  'Dak / physical letter (D)': 'Letter (Dak)',
  'Code C (CSC/Call centre)': 'CSC / call centre',
  'Code I': 'Other (code I)',
  'Code P': 'Other (code P)',
}

export const FORMAT_SHORT: Record<string, string> = {
  'Custom-written reply': 'Custom-written',
  'Standard template (identical text)': 'Template · identical',
  'Standard template (lightly edited)': 'Template · lightly edited',
  "No usable text (attachment / '.')": 'No usable text',
  'No reply (pending)': 'No reply yet',
}

/** Friendlier names for the office codes that appear most often. */
export const OFFICE_OVERRIDE: Record<string, string> = {
  C1TZN: 'Citizen',
  DSPRT: 'Dept of Sports (PG desk)',
  MOYAS: 'Dept of Youth Affairs',
  PMOPG: 'PMO',
  PRSEC: "President's Secretariat",
  DARPG: 'DARPG',
  SPIII: 'Governance 1',
  DEEP1: 'Governance 2',
  CHCH1: 'Autonomous Bodies (Ministry)',
  CHCH2: 'Khelo India (Ministry)',
  SPOT4: 'Welfare',
  SPCDN: 'Policy & Coordination (Cash)',
  AGWL1: 'Capacity Building',
  SPSAI: 'SAI HQ',
  DIRTD: 'TEAMS Division (SAI)',
  TOPSD: 'TOPS Division (SAI)',
  KHIND: 'Khelo India 1 (SAI)',
  KHELO: 'Khelo India 2 (SAI)',
  OPSDV: 'Operations Division (SAI)',
  RECUR: 'HRD-II Recruitment (SAI)',
  COADV: 'HRD-III Coaching (SAI)',
  PERDV: 'HRD-I Personnel (SAI)',
  FITIN: 'Fit India (SAI)',
  TAGG1: 'Target Asian Games Group (SAI)',
  INFDV: 'Engineering Division (SAI)',
  STDDV: 'Stadia Division (SAI)',
  ESDIV: 'GAPD-ES (SAI)',
  VGDVN: 'Vigilance Division (SAI)',
  RCBLR: 'SAI RC Bengaluru',
  RCPAT: 'SAI NSNIS Patiala',
  RCSNP: 'SAI RC Sonepat',
  RCKOL: 'SAI RC Kolkata',
  RCCHD: 'SAI RC Chandigarh',
  RCGDN: 'SAI RC Gandhinagar',
  RCLUK: 'SAI RC Lucknow',
  RCBHP: 'SAI RC Bhopal',
  RCTRI: 'SAI RC Thiruvananthapuram',
  RCMUM: 'SAI RC Mumbai',
  LNCPE: 'SAI LNCPE Thiruvananthapuram',
  SPMSP: 'SAI SPM Swimming Pool Complex',
  IGS02: 'SAI IG Stadium',
  JNS01: 'SAI JLN Stadium',
  MDCNS: 'SAI Dhyan Chand Stadium',
  KSSR3: 'SAI KSSR',
  LNIPE: 'LNIPE Gwalior',
}

export const DAY_BUCKETS = ['0-7', '8-15', '16-21', '22-30', '31-60', '61-90', '91-180', '>180']
export const DAY_BUCKET_LABEL: Record<string, string> = {
  '0-7': '0–7', '8-15': '8–15', '16-21': '16–21', '22-30': '22–30', '31-60': '31–60', '61-90': '61–90', '91-180': '91–180', '>180': '180+',
}
export const TRANSFER_BUCKETS = ['0', '1', '2', '3', '4-5', '6+']
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? m} ’${m.slice(2, 4)}`
export const monthLong = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`
}
export const fmtDateShort = (d: string | null | undefined) => {
  if (!d) return '–'
  const [, m, day] = d.split('-')
  return `${Number(day)} ${MONTHS[Number(m) - 1]}`
}

/** Theme shown last everywhere: the export has no usable text for these grievances. */
export const UNREAD_THEME = 'Needs further analysis'
export const themeOrder = <T,>(items: T[], key: (t: T) => string, by: (t: T) => number) =>
  [...items].sort((a, b) => (key(a) === UNREAD_THEME ? 1 : 0) - (key(b) === UNREAD_THEME ? 1 : 0) || by(b) - by(a))
