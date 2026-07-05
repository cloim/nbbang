import { useMemo, useState } from 'react'
import { createExpense, deleteExpense, updateExpense } from '../lib/api'
import { formatKRW, splitExpense } from '../lib/settlement'
import type { Expense, Member } from '../types'

interface Props {
  meetingId: string
  members: Member[]
  expense: Expense | null
  onClose: () => void
  onSaved: () => void
}

export default function ExpenseForm({
  meetingId,
  members,
  expense,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amountStr, setAmountStr] = useState(
    expense ? String(expense.amount) : '',
  )
  const [payerId, setPayerId] = useState(expense?.payer_id ?? '')
  const [selected, setSelected] = useState<Set<string>>(() =>
    expense
      ? new Set(expense.expense_shares.map((s) => s.member_id))
      : new Set(members.map((m) => m.id)),
  )
  const [customMode, setCustomMode] = useState(
    expense?.expense_shares.some((s) => s.amount != null) ?? false,
  )
  const [customStr, setCustomStr] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const s of expense?.expense_shares ?? []) {
      if (s.amount != null) init[s.member_id] = String(s.amount)
    }
    return init
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const amount = parseAmount(amountStr)
  const treasurerId = members.find((m) => m.is_treasurer)?.id

  const shares = useMemo(() => {
    return members
      .filter((m) => selected.has(m.id))
      .map((m) => {
        const raw = customMode ? customStr[m.id]?.trim() : undefined
        return {
          memberId: m.id,
          amount: raw ? parseAmount(raw) : null,
        }
      })
  }, [members, selected, customMode, customStr])

  const hasInvalidCustom = useMemo(() => {
    if (!customMode) return false
    return [...selected].some((id) => {
      const raw = customStr[id]?.trim()
      return Boolean(raw) && parseAmount(raw!) == null
    })
  }, [customMode, selected, customStr])

  const preview = useMemo(() => {
    if (amount == null || amount <= 0 || shares.length === 0) return null
    if (hasInvalidCustom) return null
    return splitExpense(
      {
        id: 'preview',
        title: title || '지출',
        payerId,
        amount,
        shares,
      },
      [treasurerId, payerId].filter((x): x is string => Boolean(x)),
    )
  }, [amount, shares, title, payerId, treasurerId, hasInvalidCustom])

  const nameOf = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members],
  )

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function validate(): string | null {
    if (!title.trim()) return '지출처 이름을 입력하세요.'
    if (amount == null || amount <= 0) return '지출 금액을 올바르게 입력하세요.'
    if (!payerId) return '지출인(결제한 사람)을 선택하세요.'
    if (shares.length === 0) return '참여 인원을 1명 이상 선택하세요.'
    if (customMode) {
      for (const s of shares) {
        const raw = customStr[s.memberId]?.trim()
        if (raw && parseAmount(raw) == null) {
          return `${nameOf.get(s.memberId)}의 지정 금액이 올바르지 않습니다.`
        }
      }
      const fixed = shares.filter((s) => s.amount != null)
      const fixedSum = fixed.reduce((sum, s) => sum + (s.amount as number), 0)
      if (fixedSum > amount) {
        return `지정 금액 합계(${formatKRW(fixedSum)})가 총액(${formatKRW(amount)})을 초과합니다.`
      }
      if (fixed.length === shares.length && fixedSum !== amount) {
        return `전원 금액을 지정하면 합계가 총액과 같아야 합니다. (현재 ${formatKRW(fixedSum)})`
      }
    }
    return null
  }

  async function handleSave() {
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    setBusy(true)
    try {
      const payload = {
        title: title.trim(),
        payerId,
        amount: amount as number,
        shares,
      }
      if (expense) await updateExpense(expense.id, payload)
      else await createExpense(meetingId, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!expense) return
    if (!confirm(`'${expense.title}' 지출을 삭제할까요?`)) return
    setBusy(true)
    try {
      await deleteExpense(expense.id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{expense ? '지출 수정' : '지출 추가'}</h2>
          <button className="btn icon-btn" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <label>
          지출처
          <input
            placeholder="예: 1차 고깃집"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
          />
        </label>

        <label>
          지출 금액
          <input
            placeholder="0"
            inputMode="numeric"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field-label">지출인 (결제한 사람)</span>
          <div className="chips">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={payerId === m.id ? 'chip active' : 'chip'}
                onClick={() => setPayerId(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field-row">
            <span className="field-label">참여 인원 ({selected.size}명)</span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() =>
                setSelected(
                  selected.size === members.length
                    ? new Set()
                    : new Set(members.map((m) => m.id)),
                )
              }
            >
              {selected.size === members.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div className="chips">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={selected.has(m.id) ? 'chip active' : 'chip'}
                onClick={() => toggleMember(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={customMode}
            onChange={(e) => setCustomMode(e.target.checked)}
          />
          인원별 금액 직접 지정 (비워두면 남은 금액 균등 분배)
        </label>

        {customMode && (
          <div className="custom-amounts">
            {members
              .filter((m) => selected.has(m.id))
              .map((m) => (
                <label key={m.id} className="custom-amount-row">
                  <span>{m.name}</span>
                  <input
                    placeholder="균등"
                    inputMode="numeric"
                    value={customStr[m.id] ?? ''}
                    onChange={(e) =>
                      setCustomStr((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                  />
                </label>
              ))}
          </div>
        )}

        {preview && (
          <div className="preview">
            <span className="field-label">분담 미리보기</span>
            <ul>
              {preview.shares.map((s) => (
                <li key={s.memberId}>
                  <span>
                    {nameOf.get(s.memberId)}
                    {s.isAbsorber && (
                      <span className="badge subtle">나머지 {preview.absorbedRemainder}원 포함</span>
                    )}
                  </span>
                  <span>{formatKRW(s.amount)}</span>
                </li>
              ))}
            </ul>
            {preview.warning && <p className="error-text">{preview.warning}</p>}
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="sheet-actions">
          {expense && (
            <button className="btn danger" onClick={handleDelete} disabled={busy}>
              삭제
            </button>
          )}
          <button className="btn primary grow" onClick={handleSave} disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s원]/g, '')
  if (!/^\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isSafeInteger(n) ? n : null
}
