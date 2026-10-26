import { useId, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { addMeetingMember, addStandaloneMember, removeMeetingMember } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { Expense, Group, Member } from '../types'
import { GroupManager } from './GroupManager'
import FieldError from './ui/FieldError'
import { button, card, chip, input, sectionTitle } from './ui/styles'

interface Props {
  meetingId: string
  available: Member[]
  participants: Member[]
  expenses: Expense[]
  groups: Group[]
  standalone: boolean
  onGroupsChanged: (groups: Group[]) => void
  onChanged: () => void
}

export default function ParticipantsTab({ meetingId, available, participants, expenses, groups, standalone, onGroupsChanged, onChanged }: Props) {
  const errorId = useId()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [busy, setBusy] = useState(false)

  async function toggle(member: Member) {
    const active = participants.some((person) => person.id === member.id)
    if (active && expenses.some((expense) => expense.payer_id === member.id || expense.expense_shares.some((share) => share.member_id === member.id))) {
      toast.error(`${member.name} 님은 지출 기록에 포함되어 있어 참석에서 뺄 수 없어요. 해당 지출을 먼저 수정하세요.`)
      return
    }
    setBusy(true)
    try {
      if (active) await removeMeetingMember(meetingId, member.id)
      else await addMeetingMember(meetingId, member.id)
      onChanged()
    } catch (e) { toast.error(errorMessage(e)) }
    finally { setBusy(false) }
  }

  async function addOneOffMember(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (participants.some((member) => member.name === trimmed)) return setNameError('같은 이름의 참석자가 이미 있어요.')
    setBusy(true)
    try { await addStandaloneMember(meetingId, trimmed); setName(''); onChanged() }
    catch (err) { toast.error(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <div className="flex max-w-3xl flex-col gap-4">
    <section className={`${card} flex flex-col gap-3 p-4`}>
      <div className="flex h-9 items-center justify-between gap-2">
        <h2 className={`${sectionTitle} m-0`}>참석 멤버</h2>
        <span className="text-sm font-semibold text-muted">{participants.length}명</span>
      </div>
      <p className="m-0 text-sm text-muted">{standalone ? '이번 만남의 참석자를 추가하세요.' : '모임 멤버를 눌러 이번 만남의 참석 여부를 바꾸세요.'}</p>
      {standalone && <form className="flex gap-2" onSubmit={(e) => void addOneOffMember(e)}>
        <FieldError id={errorId} message={nameError} className="min-w-0 flex-1">
          <input
            className={input}
            aria-label="참석자 이름"
            value={name}
            maxLength={30}
            placeholder="참석자 이름"
            {...(nameError ? { 'aria-invalid': true, 'aria-describedby': errorId } : {})}
            onChange={(e) => { setNameError(''); setName(e.target.value) }}
          />
        </FieldError>
        <button type="submit" className={button.primary} disabled={!name.trim() || busy}><Plus size={18} aria-hidden="true" />추가</button>
      </form>}
      <div className="flex flex-wrap gap-2">
        {(standalone ? participants : available).map((member) => {
          const selected = participants.some((person) => person.id === member.id)
          return <button
            type="button"
            key={member.id}
            className={chip(selected)}
            disabled={busy}
            aria-pressed={selected}
            aria-label={standalone ? `${member.name} 참석 취소` : undefined}
            onClick={() => void toggle(member)}
          >
            {member.name}
            {member.is_treasurer && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${selected ? 'bg-white/20' : 'bg-subtle'}`}>총무</span>}
            {standalone && <X size={15} className="ml-1" aria-hidden="true" />}
          </button>
        })}
      </div>
    </section>
    {participants.length > 0 && <GroupManager meetingId={meetingId} members={participants} groups={groups} onGroupsChanged={onGroupsChanged} />}
  </div>
}
