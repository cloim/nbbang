import { useId, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createExpense, deleteExpense, updateExpense } from '../lib/api'
import { formatKRW, splitExpense } from '../lib/settlement'
import { errorMessage } from '../lib/errors'
import type { Expense, Group, Member } from '../types'
import { PayerGroups } from './GroupManager'
import ConfirmModal from './ConfirmModal'
import { Modal } from './Modal/Modal'
import FieldError from './ui/FieldError'
import { button, chip, input, label as labelClass } from './ui/styles'

interface Props {
  meetingId: string
  members: Member[]
  expense: Expense | null
  groups?: Group[]
  onClose: () => void
  onSaved: () => void
}

type FieldKey = 'title' | 'amount' | 'payer' | 'shares' | 'custom'

export default function ExpenseForm({
  meetingId,
  members,
  expense,
  groups = [],
  onClose,
  onSaved,
}: Props) {
  const ids = useId()
  const titleRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const payerRef = useRef<HTMLDivElement>(null)
  const sharesRef = useRef<HTMLDivElement>(null)
  const customRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amountStr, setAmountStr] = useState(
    expense ? formatAmountInput(String(expense.amount)) : '',
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
      if (s.amount != null) init[s.member_id] = formatAmountInput(String(s.amount))
    }
    return init
  })
  const [fieldError, setFieldError] = useState<{ field: FieldKey; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

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

  // 입력이 바뀌면 그 필드의 오류는 바로 걷어낸다.
  function edited(field: FieldKey) {
    setDirty(true)
    if (fieldError?.field === field) setFieldError(null)
  }

  function toggleMember(id: string) {
    edited('shares')
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function validate(): { field: FieldKey; message: string } | null {
    if (!title.trim()) return { field: 'title', message: '지출처 이름을 입력하세요.' }
    if (amount == null || amount <= 0) return { field: 'amount', message: '지출 금액을 숫자로 입력하세요.' }
    if (!payerId) return { field: 'payer', message: '결제한 사람을 선택하세요.' }
    if (shares.length === 0) return { field: 'shares', message: '참여 인원을 1명 이상 선택하세요.' }
    if (customMode) {
      for (const s of shares) {
        const raw = customStr[s.memberId]?.trim()
        if (raw && parseAmount(raw) == null) {
          return { field: 'custom', message: `${nameOf.get(s.memberId)}의 지정 금액이 올바르지 않아요.` }
        }
      }
      const fixed = shares.filter((s) => s.amount != null)
      const fixedSum = fixed.reduce((sum, s) => sum + (s.amount as number), 0)
      if (fixedSum > amount) {
        return { field: 'custom', message: `지정 금액 합계(${formatKRW(fixedSum)})가 총액(${formatKRW(amount)})보다 커요.` }
      }
      if (fixed.length === shares.length && fixedSum !== amount) {
        return { field: 'custom', message: `전원 금액을 지정하면 합계가 총액과 같아야 해요. (현재 ${formatKRW(fixedSum)})` }
      }
    }
    return null
  }

  async function handleSave() {
    const problem = validate()
    if (problem) {
      setFieldError(problem)
      const target = { title: titleRef, amount: amountRef, payer: payerRef, shares: sharesRef, custom: customRef }[problem.field].current
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      if (target instanceof HTMLInputElement) target.focus()
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
      toast.success(expense ? '지출을 수정했어요.' : '지출을 추가했어요.')
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!expense) return
    await deleteExpense(expense.id)
    toast.success('지출을 삭제했어요.')
    onSaved()
  }

  // 입력한 내용이 있으면 실수로 닫아 잃지 않도록 한 번 묻는다.
  function requestClose() {
    if (busy) return
    if (dirty) setConfirmDiscardOpen(true)
    else onClose()
  }

  const errorFor = (field: FieldKey) => fieldError?.field === field ? fieldError.message : undefined
  const errorId = (field: FieldKey) => `${ids}-${field}-error`
  const invalidProps = (field: FieldKey) => fieldError?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId(field) } : {}
  const groupLabel = 'mb-2 block text-sm font-semibold text-muted'

  return (
    <>
      <Modal
        isOpen
        size="md"
        title={expense ? '지출 수정' : '지출 추가'}
        initialFocusRef={titleRef}
        onClose={requestClose}
        footer={<div className="flex w-full items-center gap-2.5">
          {expense && <button type="button" className={button.danger} onClick={() => setConfirmDeleteOpen(true)} disabled={busy}><Trash2 size={17} aria-hidden="true" />삭제</button>}
          <span className="flex-1" />
          <button type="button" className={button.ghost} onClick={requestClose} disabled={busy}>취소</button>
          <button type="button" className={button.primary} onClick={() => void handleSave()} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        </div>}
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem]">
            <label className={labelClass}>
              지출처
              <FieldError id={errorId('title')} message={errorFor('title')}>
                <input ref={titleRef} className={input} placeholder="예: 1차 고깃집" value={title} maxLength={50} {...invalidProps('title')} onChange={(e) => { edited('title'); setTitle(e.target.value) }} />
              </FieldError>
            </label>
            <label className={labelClass}>
              지출 금액
              <FieldError id={errorId('amount')} message={errorFor('amount')}>
                <div className="relative">
                  <input
                    ref={amountRef}
                    className={`${input} pr-9 text-right tabular-nums`}
                    placeholder="0"
                    inputMode="numeric"
                    value={amountStr}
                    {...invalidProps('amount')}
                    onChange={(e) => { edited('amount'); setAmountStr(formatAmountInput(e.target.value)) }}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-ink" aria-hidden="true">원</span>
                </div>
              </FieldError>
            </label>
          </div>

          <FieldError id={errorId('payer')} message={errorFor('payer')}>
            <div ref={payerRef} role="group" aria-labelledby={`${ids}-payer-label`} {...invalidProps('payer')}>
              <span id={`${ids}-payer-label`} className={groupLabel}>결제한 사람</span>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button key={m.id} type="button" aria-pressed={payerId === m.id} className={chip(payerId === m.id)} onClick={() => { edited('payer'); setPayerId(m.id) }}>
                    {m.name}
                  </button>
                ))}
              </div>
              <PayerGroups groups={groups} members={members} onSelect={(id) => { edited('payer'); setPayerId(id) }} />
            </div>
          </FieldError>

          <FieldError id={errorId('shares')} message={errorFor('shares')}>
            <div ref={sharesRef} role="group" aria-labelledby={`${ids}-shares-label`} {...invalidProps('shares')}>
              <div className="mb-2 flex h-9 items-center justify-between gap-2">
                <span id={`${ids}-shares-label`} className="text-sm font-semibold text-muted">참여 인원 ({selected.size}명)</span>
                <button
                  type="button"
                  className={button.smallGhost}
                  onClick={() => {
                    edited('shares')
                    setSelected(selected.size === members.length ? new Set() : new Set(members.map((m) => m.id)))
                  }}
                >
                  {selected.size === members.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button key={m.id} type="button" aria-pressed={selected.has(m.id)} className={chip(selected.has(m.id))} onClick={() => toggleMember(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          </FieldError>

          <div className="flex flex-col gap-1">
            <label className="flex h-9 items-center gap-2.5 text-[0.95rem] font-semibold text-ink">
              <input
                type="checkbox"
                className="size-[18px] accent-accent"
                checked={customMode}
                onChange={(e) => { edited('custom'); setCustomMode(e.target.checked) }}
              />
              금액 직접 지정
            </label>
            <p className="m-0 pl-7 text-sm text-muted">비워 둔 사람은 남은 금액을 똑같이 나눠요.</p>
          </div>

          {customMode && (
            <FieldError id={errorId('custom')} message={errorFor('custom')}>
              <div ref={customRef} className="flex flex-col gap-2" {...invalidProps('custom')}>
                {members
                  .filter((m) => selected.has(m.id))
                  .map((m) => (
                    <label key={m.id} className="flex items-center gap-3 text-[0.95rem] font-semibold text-ink">
                      <span className="w-28 shrink-0 truncate">{m.name}</span>
                      <input
                        className={`${input} text-right tabular-nums`}
                        placeholder="균등"
                        inputMode="numeric"
                        value={customStr[m.id] ?? ''}
                        onChange={(e) => {
                          edited('custom')
                          setCustomStr((prev) => ({ ...prev, [m.id]: formatAmountInput(e.target.value) }))
                        }}
                      />
                    </label>
                  ))}
              </div>
            </FieldError>
          )}

          {preview && (
            <section className="rounded-xl border border-line bg-bg p-4" aria-label="분담 미리보기">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-muted">
                <span>분담 미리보기</span>
                {customMode && <span>직접 지정 합계 <strong className="text-ink">{formatKRW(shares.reduce((sum, share) => sum + (share.amount ?? 0), 0))}</strong></span>}
              </div>
              <ul className="m-0 list-none p-0">
                {preview.shares.map((s) => (
                  <li key={s.memberId} className="flex items-center justify-between gap-3 py-1.5 text-[0.95rem]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{nameOf.get(s.memberId)}</span>
                      {s.isAbsorber && <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">나머지 {preview.absorbedRemainder}원 포함</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatKRW(s.amount)}</span>
                  </li>
                ))}
              </ul>
              {preview.warning && <p className="mb-0 mt-2 text-sm text-neg">{preview.warning}</p>}
            </section>
          )}
        </div>
      </Modal>
      {confirmDeleteOpen && expense && <ConfirmModal title="지출 삭제" message={`'${expense.title}' 지출을 삭제할까요?`} onConfirm={handleDelete} onClose={() => setConfirmDeleteOpen(false)} />}
      {confirmDiscardOpen && <ConfirmModal title="입력 취소" message="입력한 내용이 저장되지 않아요. 닫을까요?" confirmLabel="닫기" onConfirm={onClose} onClose={() => setConfirmDiscardOpen(false)} />}
    </>
  )
}

// 큰 금액을 잘못 읽지 않도록 입력하는 동안 천 단위 쉼표를 넣는다.
function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 15)
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s원]/g, '')
  if (!/^\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isSafeInteger(n) ? n : null
}
