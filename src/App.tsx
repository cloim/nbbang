import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Toaster } from 'sonner'
import { db } from './lib/db'
import LoginPage from './pages/LoginPage'
import MeetingsPage from './pages/MeetingsPage'
import MeetingPage from './pages/MeetingPage'
import GroupPage from './pages/GroupPage'
import GroupsPage from './pages/GroupsPage'
import SettingsPage from './pages/SettingsPage'
import BottomTabs, { Sidebar } from './components/BottomTabs'

export default function App() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = db.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="grid h-dvh place-items-center">
        <div className="size-8 animate-spin rounded-full border-3 border-line border-t-accent" role="status" aria-label="로딩 중" />
      </div>
    )
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      {session ? <div className="flex h-dvh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Routes>
            <Route path="/" element={<MeetingsPage />} />
            <Route path="/m/:id" element={<MeetingPage />} />
            <Route path="/g/:id" element={<GroupPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomTabs />
        </div>
      </div> : <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>}
      <Toaster position="top-center" richColors closeButton offset={16} toastOptions={{ style: { fontFamily: 'inherit' } }} />
    </Tooltip.Provider>
  )
}
