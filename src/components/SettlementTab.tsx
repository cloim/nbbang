import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Download, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  computeSettlement,
  formatKRW,
  hubTransfers,
  simplifyDebts,
  type ExpenseInput,
} from '../lib/settlement'
import { groupNet } from '../lib/groups'
import { downloadSettlementImage } from '../lib/export'
import { errorMessage } from '../lib/errors'
import { GroupSummary, NetAmount } from './GroupManager'
import ImageSavePreview, { type PreviewImage } from './ImageSavePreview'
import { button, card, sectionTitle } from './ui/styles'
import type { Expense, Group, Member } from '../types'

interface Props {
  members: Member[]
  expenses: Expense[]
  groups?: Group[]
  meetingTitle?: string
  treasurerName?: string
  treasurerAccount?: string
}

export default function SettlementTab({
  members,
  expenses,
  groups = [],
  meetingTitle,
  treasurerName = '',
  treasurerAccount = '',
}: Props) {
  const [exporting, setExporting] = useState(false)
  const [exportPreview, setExportPreview] = useState<PreviewImage | null>(null)

  useEffect(() => {
    if (!exportPreview) return
    return () => {
      const url = exportPreview.url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
  }, [exportPreview])

  const [mode, setMode] = useState<'minimal' | 'hub'>('minimal')

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
      <div className="grid h-full place-items-center">
        <p className="m-0 text-center text-ink">지출 기록이 없어 정산할 내용이 없어요.<br /><span className="text-sm text-muted">지출 탭에서 지출을 추가하면 정산 결과가 여기에 나타나요.</span></p>
      </div>
    )
  }

  const effectiveNet = groupNet(settlement.net, groups)
  const hubId =
    groups.find((g) => g.memberIds.includes(treasurer?.id ?? ''))
      ?.representativeId ?? treasurer?.id

  const transfers =
    mode === 'hub' && hubId
      ? hubTransfers(effectiveNet, hubId)
      : simplifyDebts(effectiveNet)

  const sorted = [...members].sort(
    (a, b) => (settlement.net[b.id] ?? 0) - (settlement.net[a.id] ?? 0),
  )

  const expenseById = new Map(expenses.map((e) => [e.id, e]))

  async function handleExport() {
    setExporting(true)
    try {
      const saved = await downloadSettlementImage({
        title: meetingTitle,
        treasurerName,
        treasurerAccount,
        members,
        expenses,
        groups,
        result: settlement,
        transfers,
        mode: mode === 'hub' && treasurer ? 'hub' : 'minimal',
      })
      if (saved.method === 'preview') setExportPreview(saved)
      if (saved.method === 'picker') toast.success('정산 이미지를 저장했어요.')
    } catch (error) {
      toast.error(errorMessage(error), { action: { label: '다시 시도', onClick: () => void handleExport() } })
    } finally {
      setExporting(false)
    }
  }

  const segment = (active: boolean) =>
    `flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {exportPreview && (
        <ImageSavePreview
          image={exportPreview}
          onClose={() => setExportPreview(null)}
        />
      )}

      {settlement.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-warn-line bg-warn-bg p-4" role="note">
          {settlement.warnings.map((w, i) => (
            <p key={i} className="m-0 flex items-start gap-2 text-sm leading-relaxed text-ink"><TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#a16207]" aria-hidden="true" />{w}</p>
          ))}
        </div>
      )}

      {/* 사용자가 최종으로 알아야 하는 "누가 누구에게 얼마"를 가장 먼저 보여준다. */}
      <section className={`${card} p-4`} aria-labelledby="transfer-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="transfer-heading" className={`${sectionTitle} m-0`}>송금 경로</h2>
          <button type="button" className={button.primary} disabled={exporting} onClick={() => void handleExport()}>
            <Download size={17} aria-hidden="true" />{exporting ? '만드는 중…' : '이미지 저장'}
          </button>
        </div>
        <div className="mb-3 flex w-full rounded-xl bg-subtle p-1 sm:w-fit" role="group" aria-label="송금 방식">
          <button type="button" aria-pressed={mode === 'minimal'} className={`${segment(mode === 'minimal')} flex-1 justify-center`} onClick={() => setMode('minimal')}>최소 횟수</button>
          <button type="button" aria-pressed={mode === 'hub'} className={`${segment(mode === 'hub')} flex-1 justify-center`} disabled={!treasurer} aria-describedby={treasurer ? undefined : 'hub-hint'} onClick={() => setMode('hub')}>총무에게 모으기</button>
        </div>
        {!treasurer && <p id="hub-hint" className="mb-3 mt-0 text-sm text-muted">모임 멤버 탭에서 총무를 지정하면 '총무에게 모으기'를 쓸 수 있어요.</p>}

        {transfers.length === 0 ? (
          <p className="m-0 text-ink">모두 정산이 맞아 송금할 것이 없어요.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
                <span className="flex min-w-0 items-center gap-2 font-bold text-ink">
                  <span className="truncate">{nameOf.get(t.fromId) ?? '알 수 없음'}</span>
                  <ArrowRight size={18} className="shrink-0 text-focus" aria-hidden="true" /><span className="sr-only">에게</span>
                  <span className="truncate">{nameOf.get(t.toId) ?? '알 수 없음'}</span>
                </span>
                <span className="shrink-0 text-lg font-extrabold tabular-nums text-accent">{formatKRW(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mb-0 mt-2 text-sm text-muted">
          총 {transfers.length}회 송금{mode === 'minimal' && ' (최소 횟수 기준)'}
        </p>
      </section>

      <GroupSummary groups={groups} members={members} net={settlement.net} />

      <section className={`${card} p-4`} aria-labelledby="net-heading">
        <h2 id="net-heading" className={`${sectionTitle} mb-1 mt-0`}>사람별 정산</h2>
        <ul className="m-0 list-none p-0">
          {sorted.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  <span className="truncate">{m.name}</span>
                  {m.is_treasurer && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">총무</span>}
                </span>
                <span className="text-sm text-muted">
                  낸 금액 {formatKRW(settlement.paid[m.id] ?? 0)}, 부담 {formatKRW(settlement.owed[m.id] ?? 0)}
                </span>
              </span>
              <NetAmount value={settlement.net[m.id] ?? 0} />
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} p-4`} aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" className={`${sectionTitle} mb-1 mt-0`}>지출별 분담 내역</h2>
        <ul className="m-0 list-none p-0">
          {settlement.breakdowns.map((b) => {
            const e = expenseById.get(b.expenseId)
            if (!e) return null
            return (
              <li key={b.expenseId} className="border-b border-line py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-3 font-bold text-ink">
                  <span className="min-w-0 break-words">{e.title}</span>
                  <span className="shrink-0 tabular-nums">{formatKRW(e.amount)}</span>
                </div>
                <ul className="mt-1.5 list-none pl-3">
                  {b.shares.map((s) => (
                    <li key={s.memberId} className="flex justify-between gap-3 py-0.5 text-sm text-muted">
                      <span>
                        {nameOf.get(s.memberId)}
                        {s.isAbsorber && ` (나머지 ${b.absorbedRemainder}원 포함)`}
                      </span>
                      <span className="tabular-nums">{formatKRW(s.amount)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
