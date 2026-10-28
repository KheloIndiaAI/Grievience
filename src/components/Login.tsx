import * as React from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Brand } from '@/App'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { isSignedIn, signIn } from '@/lib/auth'

/** Renders the dashboard only after a successful sign-in, so the data is not fetched before it. */
export function Gate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = React.useState(isSignedIn)
  return ok ? <>{children}</> : <Login onDone={() => setOk(true)} />
}

function Login({ onDone }: { onDone: () => void }) {
  const [user, setUser] = React.useState('')
  const [pass, setPass] = React.useState('')
  const [show, setShow] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user.trim() || !pass) return setErr('Enter your user ID and password.')
    setBusy(true)
    const good = await signIn(user, pass)
    setBusy(false)
    if (good) onDone()
    else { setErr('User ID or password is incorrect.'); setPass('') }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-4 flex justify-center [&>div]:px-0"><Brand /></div>
        <form onSubmit={submit} className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Khel Samadhaan grievance dashboard</p>
          <label className="mt-5 block text-[12.5px] font-medium" htmlFor="login-user">User ID</label>
          <Input id="login-user" className="mt-1.5" autoComplete="username" autoFocus value={user}
            onChange={(e) => { setUser(e.target.value); setErr('') }} />
          <label className="mt-4 block text-[12.5px] font-medium" htmlFor="login-pass">Password</label>
          <div className="relative mt-1.5">
            <Input id="login-pass" type={show ? 'text' : 'password'} className="pr-10" autoComplete="current-password" value={pass}
              onChange={(e) => { setPass(e.target.value); setErr('') }} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {err && <p role="alert" className="mt-3 text-[12.5px] text-[var(--status-serious)]">{err}</p>}
          <Button type="submit" className="mt-5 w-full" disabled={busy}><LogIn />{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </div>
    </div>
  )
}
