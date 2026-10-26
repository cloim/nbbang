import { useId, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { saveGroups } from '../lib/groups'
import { errorMessage } from '../lib/errors'
import { formatKRW } from '../lib/settlement'
import type { Group, Member } from '../types'
import ConfirmModal from './ConfirmModal'
import SelectControl from './SelectControl/SelectControl'
import FieldError from './ui/FieldError'
import { button, card, chip, input, label as labelClass, sectionTitle } from './ui/styles'

interface GroupManagerProps {
  meetingId: string
  members: Member[]
  groups: Group[]
  onGroupsChanged: (groups: Group[]) => void
}

type DraftField = 'name' | 'members' | 'representative'

export function GroupManager({
  meetingId,
  members,
  groups,
  onGroupsChanged,
}: GroupManagerProps) {
  const ids = useId()
  const [draft, setDraft] = useState<Group | null>(null)
  const [fieldError, setFieldError] = useState<{ field: DraftField; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingUnassign, setPendingUnassign] = useState<Group | null>(null)

  const used = new Set(
    groups.filter((g) => g.id !== draft?.id).flatMap((g) => g.memberIds),
  )
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '알 수 없음'

  async function persist(next: Group[], successMessage: string) {
    setBusy(true)
    try {
      await saveGroups(meetingId, next)
      onGroupsChanged(next)
      setDraft(null)
      toast.success(successMessage)
    } finally {
      setBusy(false)
    }
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    const name = draft.name.trim()
    if (!name) return setFieldError({ field: 'name', message: '그룹 이름을 입력하세요.' })
    if (groups.some((g) => g.id !== draft.id && g.name === name)) return setFieldError({ field: 'name', message: '같은 이름의 그룹이 있어요.' })
    if (!draft.memberIds.length) return setFieldError({ field: 'members', message: '그룹 멤버를 1명 이상 선택하세요.' })
    if (!draft.memberIds.includes(draft.representativeId)) return setFieldError({ field: 'representative', message: '그룹 멤버 중 대표 지출자를 선택하세요.' })
    persist([...groups.filter((g) => g.id !== draft.id), { ...draft, name }], '그룹을 저장했어요.').catch((err) => toast.error(errorMessage(err)))
  }

  function toggle(id: string) {
    if (fieldError?.field === 'members') setFieldError(null)
    setDraft((d) => {
      if (!d) return null
      const memberIds = d.memberIds.includes(id)
        ? d.memberIds.filter((x) => x !== id)
        : [...d.memberIds, id]
      return {
        ...d,
        memberIds,
        representativeId: memberIds.includes(d.representativeId)
          ? d.representativeId
          : (memberIds[0] ?? ''),
      }
    })
  }

  const errorFor = (field: DraftField) => fieldError?.field === field ? fieldError.message : undefined
  const errorId = (field: DraftField) => `${ids}-${field}-error`
  const invalidProps = (field: DraftField) => fieldError?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId(field) } : {}

  return (
    <section className={`${card} flex flex-col gap-3 p-4`} aria-labelledby={`${ids}-title`}>
      <div className="flex h-9 items-center justify-between gap-2">
        <h3 id={`${ids}-title`} className={`${sectionTitle} m-0`}>멤버 그룹</h3>
        {!draft && <button
          type="button"
          className={button.smallGhost}
          disabled={busy || !members.length}
          onClick={() => {
            setFieldError(null)
            setDraft({ id: crypto.randomUUID(), name: '', memberIds: [], representativeId: '' })
          }}
        >
          <Plus size={16} aria-hidden="true" />그룹 만들기
        </button>}
      </div>
      <p className="m-0 text-sm text-muted">
        그룹 대표가 그룹원들의 정산 금액을 모아 보내거나 받아요. 한 멤버는 한 그룹에만 속할 수 있어요.
      </p>

      {groups.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {groups.map((g) => (
            <li className="flex flex-col gap-2 rounded-xl border border-line p-3" key={g.id}>
              <div className="flex items-center justify-between gap-2">
                <strong className="min-w-0 truncate text-ink">{g.name}</strong>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className={button.smallGhost} disabled={busy || !!draft} onClick={() => { setFieldError(null); setDraft({ ...g, memberIds: [...g.memberIds] }) }}>수정</button>
                  <button type="button" className={`${button.smallGhost} text-neg hover:bg-neg-soft`} disabled={busy} onClick={() => setPendingUnassign(g)}>해제</button>
                </div>
              </div>
              <p className="m-0 text-sm text-muted">대표 지출자: <strong className="text-ink">{nameOf(g.representativeId)}</strong></p>
              <div className="flex flex-wrap gap-1.5">
                {g.memberIds.map((id) => <span key={id} className="rounded-full bg-subtle px-2.5 py-1 text-sm font-semibold text-ink">{nameOf(id)}</span>)}
              </div>
            </li>
          ))}
        </ul>
      ) : !draft && <p className="m-0 text-sm text-muted">아직 지정한 그룹이 없어요.</p>}

      {draft && (
        <form className="flex flex-col gap-4 rounded-xl border border-accent/25 bg-bg p-4" onSubmit={save}>
          <label className={labelClass}>
            그룹 이름
            <FieldError id={errorId('name')} message={errorFor('name')}>
              <input
                className={input}
                value={draft.name}
                maxLength={30}
                placeholder="예: 우리 가족"
                disabled={busy}
                autoFocus
                {...invalidProps('name')}
                onChange={(e) => { if (fieldError?.field === 'name') setFieldError(null); setDraft({ ...draft, name: e.target.value }) }}
              />
            </FieldError>
          </label>
          <FieldError id={errorId('members')} message={errorFor('members')}>
            <div role="group" aria-labelledby={`${ids}-members-label`} {...invalidProps('members')}>
              <span id={`${ids}-members-label`} className="mb-2 block text-sm font-semibold text-muted">그룹 멤버</span>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isSelected = draft.memberIds.includes(m.id)
                  const isOther = used.has(m.id)
                  return (
                    <button key={m.id} type="button" className={chip(isSelected)} disabled={busy || isOther} aria-pressed={isSelected} onClick={() => toggle(m.id)}>
                      {m.name}{isOther ? ' (다른 그룹)' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          </FieldError>
          <label className={labelClass}>
            대표 지출자
            <FieldError id={errorId('representative')} message={errorFor('representative')}>
              <SelectControl
                wrapperClassName="w-full"
                className={input}
                value={draft.representativeId}
                disabled={busy}
                {...invalidProps('representative')}
                onChange={(e) => { if (fieldError?.field === 'representative') setFieldError(null); setDraft({ ...draft, representativeId: e.target.value }) }}
              >
                <option value="">대표를 선택하세요</option>
                {members.filter((m) => draft.memberIds.includes(m.id)).map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}
              </SelectControl>
            </FieldError>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={button.ghost} disabled={busy} onClick={() => { setDraft(null); setFieldError(null) }}>취소</button>
            <button type="submit" className={button.primary} disabled={busy}>{busy ? '저장 중…' : '그룹 저장'}</button>
          </div>
        </form>
      )}

      {pendingUnassign && <ConfirmModal
        title="그룹 해제"
        message={`'${pendingUnassign.name}' 그룹을 해제할까요? 멤버와 지출 기록은 유지됩니다.`}
        confirmLabel="해제"
        onConfirm={() => persist(groups.filter((group) => group.id !== pendingUnassign.id), '그룹을 해제했어요.')}
        onClose={() => setPendingUnassign(null)}
      />}
    </section>
  )
}

interface PayerGroupsProps {
  groups: Group[]
  members: Member[]
  onSelect: (payerId: string) => void
}

// 그룹 대표를 결제자로 빠르게 고르는 보조 단축 버튼
export function PayerGroups({ groups, members, onSelect }: PayerGroupsProps) {
  if (!groups.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">그룹 대표로 고르기</span>
      {groups.map((g) => {
        const rep = members.find((m) => m.id === g.representativeId)
        return <button type="button" className={`${button.smallGhost} border border-line`} key={g.id} onClick={() => onSelect(g.representativeId)}>
          {g.name}: {rep?.name}
        </button>
      })}
    </div>
  )
}

interface GroupSummaryProps {
  groups: Group[]
  members: Member[]
  net: Record<string, number>
}

export function GroupSummary({ groups, members, net }: GroupSummaryProps) {
  if (!groups.length) return null
  return (
    <section className={`${card} p-4`}>
      <h3 className={`${sectionTitle} mb-1 mt-0`}>그룹별 정산</h3>
      <p className="mb-2 mt-0 text-sm text-muted">
        송금 경로에는 그룹 대표가 표시돼요. 그룹 안의 분담은 사람별 정산에서 확인하세요.
      </p>
      <ul className="m-0 list-none p-0">
        {groups.map((g) => {
          const sum = g.memberIds.reduce((total, id) => total + (net[id] ?? 0), 0)
          const rep = members.find((m) => m.id === g.representativeId)
          return (
            <li className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0" key={g.id}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-bold text-ink">{g.name}</span>
                <span className="text-sm text-muted">대표: {rep?.name}</span>
              </span>
              <NetAmount value={sum} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function NetAmount({ value }: { value: number }) {
  return <span className={`shrink-0 font-bold tabular-nums ${value > 0 ? 'text-pos' : value < 0 ? 'text-neg' : 'text-muted'}`}>
    {value > 0 ? `+${formatKRW(value)} 받음` : value < 0 ? `${formatKRW(-value)} 보냄` : '정산 완료'}
  </span>
}
