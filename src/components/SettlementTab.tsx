import { useMemo, useState } from 'react'
import {
  computeSettlement,
  formatKRW,
  hubTransfers,
  type ExpenseInput,
} from '../lib/settlement'
import type { Expense, Member } from '../types'

interface Props {
  members: Member[]
  expenses: Expense[]
}

export default function SettlementTab({ members, expenses }: Props) {
  const [mode, setMode] = useState<'minimal' | 'hub'>('minimal')
  const [showDetail, setShowDetail] = useState(false)

  const treasurer = members.find((m) => m.is_treasurer)
  const nameOf = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members],
  )

  const settlement = useMemo(() => {
    const inputs: ExpenseInput[] = expenses.map((e) => ({
      id: e.id,
      title: e.title,
      payerId: e.payer_id,
      amount: e.amount,
      shares: e.expense_shares.map((s) => ({
        memberId: s.member_id,
        amount: s.amount,
      })),
    }))
    return computeSettlement(
      members.map((m) => m.id),
      inputs,
      treasurer?.id ?? null,
    )
  }, [members, expenses, treasurer])

  if (expenses.length === 0) {
    return (
      <div className="tab-body">
        <div className="empty-state">
          <p>지출 기록이 없어 정산할 내용이 없습니다.</p>
        </div>
      </div>
    )
  }

  const transfers =
    mode === 'hub' && treasurer
      ? hubTransfers(settlement.net, treasurer.id)
      : settlement.transfers

  const sorted = [...members].sort(
    (a, b) => (settlement.net[b.id] ?? 0) - (settlement.net[a.id] ?? 0),
  )

  const expenseById = new Map(expenses.map((e) => [e.id, e]))

  return (
    <div className="tab-body">
      {settlement.warnings.length > 0 && (
        <div className="card warning-card">
          {settlement.warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
      )}

      <section className="card">
        <h3 className="section-title">사람별 정산</h3>
        <ul className="net-list">
          {sorted.map((m) => {
            const net = settlement.net[m.id] ?? 0
            return (
              <li key={m.id} className="net-row">
                <span className="net-name">
                  {m.name}
                  {m.is_treasurer && <span className="badge">총무</span>}
                </span>
                <span className="muted small">
                  냄 {formatKRW(settlement.paid[m.id] ?? 0)} · 부담{' '}
                  {formatKRW(settlement.owed[m.id] ?? 0)}
                </span>
                <span
                  className={
                    net > 0 ? 'net-amount pos' : net < 0 ? 'net-amount neg' : 'net-amount'
                  }
                >
                  {net > 0
                    ? `+${formatKRW(net)} 받음`
                    : net < 0
                      ? `${formatKRW(-net)} 보냄`
                      : '정산 완료'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <div className="field-row">
          <h3 className="section-title">송금 경로</h3>
          <div className="segment">
            <button
              className={mode === 'minimal' ? 'seg active' : 'seg'}
              onClick={() => setMode('minimal')}
            >
              최소 횟수
            </button>
            <button
              className={mode === 'hub' ? 'seg active' : 'seg'}
              disabled={!treasurer}
              title={treasurer ? '' : '멤버 탭에서 총무를 지정하면 사용할 수 있습니다'}
              onClick={() => setMode('hub')}
            >
              총무에게 모으기
            </button>
          </div>
        </div>

        {transfers.length === 0 ? (
          <p className="muted">모두 정산이 맞아 송금할 것이 없습니다. 🎉</p>
        ) : (
          <ul className="transfer-list">
            {transfers.map((t, i) => (
              <li key={i} className="transfer-row">
                <span className="transfer-people">
                  <strong>{nameOf.get(t.fromId) ?? '?'}</strong>
                  <span className="arrow">→</span>
                  <strong>{nameOf.get(t.toId) ?? '?'}</strong>
                </span>
                <span className="transfer-amount">{formatKRW(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small hint">
          총 {transfers.length}회 송금
          {mode === 'minimal' && ' (최소 횟수 기준)'}
        </p>
      </section>

      <section className="card">
        <button
          className="btn ghost small"
          onClick={() => setShowDetail(!showDetail)}
        >
          {showDetail ? '지출별 분담 내역 접기 ▲' : '지출별 분담 내역 (검산용) ▼'}
        </button>
        {showDetail && (
          <ul className="breakdown-list">
            {settlement.breakdowns.map((b) => {
              const e = expenseById.get(b.expenseId)
              if (!e) return null
              return (
                <li key={b.expenseId} className="breakdown-item">
                  <div className="field-row">
                    <strong>{e.title}</strong>
                    <span>{formatKRW(e.amount)}</span>
                  </div>
                  <ul>
                    {b.shares.map((s) => (
                      <li key={s.memberId} className="breakdown-share muted small">
                        <span>
                          {nameOf.get(s.memberId)}
                          {s.isAbsorber && ` (나머지 ${b.absorbedRemainder}원 흡수)`}
                        </span>
                        <span>{formatKRW(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
