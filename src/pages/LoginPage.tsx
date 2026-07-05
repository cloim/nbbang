import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setNotice('가입 확인 메일을 보냈습니다. 메일함을 확인해주세요.')
        }
      }
    } catch (err) {
      setError(toKoreanAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page center-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1 className="brand">
          nBBang <span className="brand-sub">모임 정산</span>
        </h1>
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        {notice && <p className="notice-text">{notice}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '처리 중…' : mode === 'signin' ? '로그인' : '회원가입'}
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError('')
            setNotice('')
          }}
        >
          {mode === 'signin' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>
      </form>
    </div>
  )
}

function toKoreanAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('Invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (message.includes('already registered')) {
    return '이미 가입된 이메일입니다.'
  }
  if (message.includes('Password should be')) {
    return '비밀번호는 6자 이상이어야 합니다.'
  }
  if (message.includes('Email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.'
  }
  return message
}
