import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '../lib/errors'

type GoogleCredential = { credential: string }
type GoogleIdentity = { accounts: { id: { initialize: (options: { client_id: string; callback: (response: GoogleCredential) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, unknown>) => void } } }
declare global { interface Window { google?: GoogleIdentity } }

export default function LoginPage() {
  const [clientId, setClientId] = useState('')
    const [busy, setBusy] = useState(false)
  const [button, setButton] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/config').then((response) => response.json()).then((config) => setClientId(config.googleClientId || '')).catch(() => setClientId(''))
  }, [])

  useEffect(() => {
    if (!clientId || !button) return
    const render = () => {
      if (!window.google) return
      button.replaceChildren()
      window.google.accounts.id.renderButton(button, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: Math.min(320, button.clientWidth) })
    }
    const observer = new ResizeObserver(render)
    observer.observe(button)
    if (window.google) { window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => void login(credential) }); render(); return () => observer.disconnect() }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => { window.google?.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => void login(credential) }); render() }
    document.head.append(script)
    return () => { observer.disconnect(); script.remove() }
  }, [clientId, button])

  async function login(credential: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/auth/google', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential }) })
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Google 로그인을 완료하지 못했습니다.') }
      window.dispatchEvent(new Event('nbbang-auth'))
      window.location.assign('/')
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <main className="grid min-h-dvh place-items-center px-4">
    <div className="flex w-full max-w-sm flex-col items-center gap-6 py-6">
      <div className="flex items-center justify-center gap-3">
        <img className="size-16" src="/nbbang-logo.png" alt="" />
        <img className="h-20 w-auto" src="/nbbang-title.png" alt="엔빵, 총무의 비밀" />
      </div>
      <div className="flex min-h-12 w-full justify-center" ref={setButton} aria-busy={busy} />
      {!clientId && <p className="m-0 text-center text-sm text-muted">Google 로그인 설정을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>}
      {busy && <p className="m-0 text-sm text-muted" role="status">로그인 중이에요.</p>}
    </div>
  </main>
}
