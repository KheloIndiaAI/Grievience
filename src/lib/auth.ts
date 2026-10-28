/* ---------------------------------------------------------------------------
   Sign-in screen in front of the dashboard. The site is static (no backend), so
   only a hash of the credentials ships in the bundle and the check runs in the
   browser; it keeps casual visitors out but is not access control for the data
   files themselves. The sign-in lasts until the browser tab is closed.
   --------------------------------------------------------------------------- */

const SALT = 'grievience-login-v1'
// sha256(`${SALT}|${user id in lower case}|${password}`)
const ACCOUNTS = new Set(['f87630d5448ab982f972066f5f52e82e7f811ed55d67e613f420ef378e598a3c'])
const KEY = 'grv-auth'

async function digest(user: string, pass: string) {
  const bytes = new TextEncoder().encode(`${SALT}|${user.trim().toLowerCase()}|${pass}`)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function isSignedIn() {
  try { return ACCOUNTS.has(sessionStorage.getItem(KEY) ?? '') } catch { return false }
}

export async function signIn(user: string, pass: string) {
  const h = await digest(user, pass)
  if (!ACCOUNTS.has(h)) return false
  try { sessionStorage.setItem(KEY, h) } catch { /* ignore: signed in for this page load only */ }
  return true
}

export function signOut() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  window.location.reload()
}
