import { useMemo, useState } from 'react'
import { formatKRW } from '../lib/settlement'
import type { Expense, Member } from '../types'
import ExpenseForm from './ExpenseForm'

interface Props {
  meetingId: string
  members: Member[]
  expenses: Expense[]
  onChanged: () => void
  goMembers: () => void
}

export default function ExpensesTab({
  meetingId,
  members,
  expenses,
  onChanged,
  goMembers,
}: Props) {
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const nameOf = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members],
  )

  if (members.length === 0) {
    return (
      <div className="tab-body">
        <div className="empty-state">
          <p>멤버가 없어 지출을 기록할 수 없습니다.</p>
          <button className="btn primary" onClick={goMembers}>
            멤버 추가하러 가기
          </button>
        </div>
      </div>
    )
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="tab-body">
      {expenses.length === 0 ? (
        <div className="empty-state">
          <p>아직 지출 기록이 없습니다.</p>
          <p className="muted">아래 버튼으로 첫 지출을 추가하세요.</p>
        </div>
      ) : (
        <>
          <div className="total-bar">
            <span className="muted">총 지출</span>
            <strong>{formatKRW(total)}</strong>
          </div>
          <ul className="expense-list">
            {expenses.map((e) => {
              const hasCustom = e.expense_shares.some((s) => s.amount != null)
              return (
                <li key={e.id}>
                  <button className="card expense-card" onClick={() => setEditing(e)}>
                    <div className="expense-main">
                      <span className="expense-title">{e.title}</span>
                      <span className="expense-amount">{formatKRW(e.amount)}</span>
                    </div>
                    <div className="expense-sub muted small">
                      <span>{nameOf.get(e.payer_id) ?? '?'} 결제</span>
                      <span>
                        {e.expense_shares.length}명 참여
                        {hasCustom && ' · 금액 지정'}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')}>
        ＋ 지출 추가
      </button>

      {editing && (
        <ExpenseForm
          meetingId={meetingId}
          members={members}
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}
