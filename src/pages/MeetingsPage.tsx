import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMeeting, deleteMeeting, listMeetings } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Meeting } from '../types'

export default function MeetingsPage() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setMeetings(await listMeetings())
      setError('')
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    try {
      const meeting = await createMeeting(trimmed)
      setTitle('')
      navigate(`/m/${meeting.id}`)
    } catch (err) {
      setError(toMessage(err))
    }
  }

  async function handleDelete(meeting: Meeting) {
    if (!confirm(`'${meeting.title}' 모임과 모든 기록을 삭제할까요?`)) return
    try {
      await deleteMeeting(meeting.id)
      refresh()
    } catch (err) {
      setError(toMessage(err))
    }
  }

  return (
    <div className="page">
      <header className="app-header">
        <h1 className="brand">nBBang</h1>
        <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>
          로그아웃
        </button>
      </header>

      <form className="new-meeting" onSubmit={handleCreate}>
        <input
          placeholder="새 모임 이름 (예: 3월 등산 모임)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
        />
        <button className="btn primary" type="submit" disabled={!title.trim()}>
          만들기
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <div className="center-page">
          <div className="spinner" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="empty-state">
          <p>아직 모임이 없습니다.</p>
          <p className="muted">위에서 첫 모임을 만들어보세요.</p>
        </div>
      ) : (
        <ul className="meeting-list">
          {meetings.map((m) => (
            <li key={m.id} className="card meeting-card">
              <button className="meeting-link" onClick={() => navigate(`/m/${m.id}`)}>
                <span className="meeting-title">{m.title}</span>
                <span className="muted small">
                  {new Date(m.created_at).toLocaleDateString('ko-KR')}
                </span>
              </button>
              <button
                className="btn icon-btn"
                aria-label="모임 삭제"
                onClick={() => handleDelete(m)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
