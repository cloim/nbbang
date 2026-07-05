import { useState, type FormEvent } from 'react'
import { addMember, deleteMember, renameMember, setTreasurer } from '../lib/api'
import type { Expense, Member } from '../types'

interface Props {
  meetingId: string
  members: Member[]
  expenses: Expense[]
  onChanged: () => void
}

export default function MembersTab({ meetingId, members, expenses, onChanged }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      setError('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (members.some((m) => m.name === trimmed)) {
      setError('같은 이름의 멤버가 이미 있습니다.')
      return
    }
    await run(() => addMember(meetingId, trimmed))
    setName('')
  }

  function memberInUse(member: Member): boolean {
    return expenses.some(
      (e) =>
        e.payer_id === member.id ||
        e.expense_shares.some((s) => s.member_id === member.id),
    )
  }

  async function handleDelete(member: Member) {
    if (memberInUse(member)) {
      setError(
        `'${member.name}'은(는) 지출 기록에 포함되어 있어 삭제할 수 없습니다. 먼저 해당 지출을 수정하세요.`,
      )
      return
    }
    if (!confirm(`'${member.name}' 멤버를 삭제할까요?`)) return
    await run(() => deleteMember(member.id))
  }

  async function handleRename(member: Member) {
    const newName = prompt('새 이름', member.name)?.trim()
    if (!newName || newName === member.name) return
    await run(() => renameMember(member.id, newName))
  }

  async function handleTreasurer(member: Member) {
    await run(() => setTreasurer(meetingId, member.is_treasurer ? null : member.id))
  }

  return (
    <div className="tab-body">
      <form className="new-meeting" onSubmit={handleAdd}>
        <input
          placeholder="멤버 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
        />
        <button className="btn primary" type="submit" disabled={!name.trim()}>
          추가
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {members.length === 0 ? (
        <div className="empty-state">
          <p>참석 멤버를 먼저 추가하세요.</p>
          <p className="muted">멤버가 있어야 지출을 기록할 수 있습니다.</p>
        </div>
      ) : (
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.id} className="card member-card">
              <button
                className={m.is_treasurer ? 'star active' : 'star'}
                aria-label="총무 지정"
                title="총무 지정 (라운딩 흡수·허브 송금 대상)"
                onClick={() => handleTreasurer(m)}
              >
                ★
              </button>
              <button className="member-name" onClick={() => handleRename(m)}>
                {m.name}
                {m.is_treasurer && <span className="badge">총무</span>}
              </button>
              <button
                className="btn icon-btn"
                aria-label="멤버 삭제"
                onClick={() => handleDelete(m)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small hint">
        ★ 총무를 지정하면 1원 단위 나머지를 총무가 흡수하고, 정산에서 총무에게
        모아 보내는 방식을 선택할 수 있습니다. 이름을 누르면 수정됩니다.
      </p>
    </div>
  )
}
