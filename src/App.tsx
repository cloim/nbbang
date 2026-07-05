import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import MeetingsPage from './pages/MeetingsPage'
import MeetingPage from './pages/MeetingPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) {
    return (
      <div className="page center-page">
        <div className="card setup-card">
          <h1>nBBang 설정 필요</h1>
          <p>
            Supabase 환경변수가 없습니다. <code>.env</code> 파일에 아래 값을
            설정하세요.
          </p>
          <pre>
            VITE_SUPABASE_URL=...{'\n'}VITE_SUPABASE_ANON_KEY=...
          </pre>
          <p>
            그리고 <code>supabase/schema.sql</code>을 Supabase SQL Editor에서
            실행하세요.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page center-page">
        <div className="spinner" aria-label="로딩 중" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={session ? <MeetingsPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/m/:id"
        element={session ? <MeetingPage /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
