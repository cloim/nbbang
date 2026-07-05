import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMeeting, listExpenses, listMembers } from '../lib/api'
import type { Expense, Meeting, Member } from '../types'
import MembersTab from '../components/MembersTab'
import ExpensesTab from '../components/ExpensesTab'
import SettlementTab from '../components/SettlementTab'

type Tab = 'expenses' | 'members' | 'settlement'

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('expenses')

  const refresh = useCallback(async () => {
    if (!id) return
    try {
      const [m, mems, exps] = await Promise.all([
        getMeeting(id),
        listMembers(id),
        listExpenses(id),
      ])
      setMeeting(m)
      setMembers(mems)
      setExpenses(exps)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (loading) {
    return (
      <div className="page center-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="page center-page">
        <div className="empty-state">
          <p>모임을 찾을 수 없습니다.</p>
          <button className="btn primary" onClick={() => navigate('/')}>
            목록으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="app-header">
        <button className="btn icon-btn" aria-label="뒤로" onClick={() => navigate('/')}>
          ←
        </button>
        <h1 className="page-title">{meeting.title}</h1>
        <span style={{ width: 36 }} />
      </header>

      <nav className="tab-bar">
        <button
          className={tab === 'expenses' ? 'tab active' : 'tab'}
          onClick={() => setTab('expenses')}
        >
          지출 {expenses.length > 0 && <em>{expenses.length}</em>}
        </button>
        <button
          className={tab === 'members' ? 'tab active' : 'tab'}
          onClick={() => setTab('members')}
        >
          멤버 {members.length > 0 && <em>{members.length}</em>}
        </button>
        <button
          className={tab === 'settlement' ? 'tab active' : 'tab'}
          onClick={() => setTab('settlement')}
        >
          정산
        </button>
      </nav>

      {error && <p className="error-text">{error}</p>}

      {tab === 'expenses' && (
        <ExpensesTab
          meetingId={meeting.id}
          members={members}
          expenses={expenses}
          onChanged={refresh}
          goMembers={() => setTab('members')}
        />
      )}
      {tab === 'members' && (
        <MembersTab
          meetingId={meeting.id}
          members={members}
          expenses={expenses}
          onChanged={refresh}
        />
      )}
      {tab === 'settlement' && (
        <SettlementTab members={members} expenses={expenses} />
      )}
    </div>
  )
}
