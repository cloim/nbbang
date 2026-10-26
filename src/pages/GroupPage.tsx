import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { addMember, createMeeting, deleteGroup, deleteMember, deleteMeeting, listMeetings, listMembers, renameMember, setTreasurer, updateGroup } from '../lib/api'
import { db } from '../lib/db'
import { errorMessage } from '../lib/errors'
import TopBar from '../components/TopBar'
import ConfirmModal from '../components/ConfirmModal'
import RenameModal from '../components/RenameModal'
import MoreMenu from '../components/ui/MoreMenu'
import IconButton from '../components/ui/IconButton'
import { button, card, deleteIconButton, iconButton, input, tab as tabClass, tabList } from '../components/ui/styles'
import type { Meeting, Member, SocialGroup } from '../types'

type PendingDelete =
  | { type: 'member'; member: Member }
  | { type: 'meeting'; meeting: Meeting }
  | { type: 'group'; group: SocialGroup }

export default function GroupPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<SocialGroup | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [memberName, setMemberName] = useState('')
  const [meetingName, setMeetingName] = useState('')
  const [busy, setBusy] = useState(false)
  const [renamingGroup, setRenamingGroup] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [memberBeingRenamed, setMemberBeingRenamed] = useState<Member | null>(null)
  const [tab, setTab] = useState<'meetings' | 'members'>('meetings')

  const refresh = useCallback(async () => {
    if (!id) return
    try {
      const [meetingsInGroup, membersInGroup] = await Promise.all([listMeetings(id), listMembers(id)])
      setMeetings(meetingsInGroup)
      setMembers([...membersInGroup].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')))
      const { data, error: groupError } = await db.from('groups').select('*').eq('id', id).maybeSingle()
      if (groupError) throw groupError
      setGroup(data)
    } catch (err) {
      toast.error(errorMessage(err), { action: { label: '다시 시도', onClick: () => void refresh() } })
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { void refresh() }, [refresh])

  async function addNewMember(e: FormEvent) {
    e.preventDefault()
    const name = memberName.trim()
    if (!id || !name || busy) return
    setBusy(true)
    try {
      await addMember(id, name)
      setMemberName('')
      await refresh()
      toast.success(`${name} 멤버를 추가했어요.`)
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function createEncounter(e: FormEvent) {
    e.preventDefault()
    if (!id || !meetingName.trim() || busy) return
    setBusy(true)
    try {
      const meeting = await createMeeting(meetingName.trim(), id)
      navigate(`/m/${meeting.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  async function chooseTreasurer(member: Member) {
    if (!id || member.is_treasurer) return
    try {
      await setTreasurer(id, member.id)
      await refresh()
      toast.success(`${member.name} 님을 총무로 지정했어요.`)
    } catch (err) { toast.error(errorMessage(err)) }
  }

  async function confirmDelete(target: PendingDelete) {
    if (!id) return
    if (target.type === 'member') {
      await deleteMember(target.member.id)
      await refresh()
      toast.success(`${target.member.name} 멤버를 삭제했어요.`)
    } else if (target.type === 'meeting') {
      await deleteMeeting(target.meeting.id)
      await refresh()
      toast.success('만남을 삭제했어요.')
    } else {
      await deleteGroup(id)
      toast.success('모임을 삭제했어요.')
      navigate('/groups')
    }
  }

  if (loading) return <>
    <TopBar crumbs={[{ label: '모임', to: '/groups' }, { label: '불러오는 중' }]} />
    <main className="flex-1 px-4 py-4 lg:px-8"><div className="h-11 max-w-xl animate-pulse rounded-xl bg-subtle" /></main>
  </>
  if (!group) return <>
    <TopBar crumbs={[{ label: '모임', to: '/groups' }, { label: '모임 없음' }]} />
    <main className="grid flex-1 place-items-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="m-0 text-ink">모임을 찾을 수 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.</p>
        <Link to="/groups" className={button.primary}>모임 목록으로</Link>
      </div>
    </main>
  </>

  const pendingDeleteMessage = pendingDelete?.type === 'member'
    ? `${pendingDelete.member.name} 멤버를 모임에서 삭제할까요?`
    : pendingDelete?.type === 'meeting'
      ? `'${pendingDelete.meeting.title}' 만남과 지출 기록을 삭제할까요?`
      : pendingDelete?.type === 'group'
        ? `'${pendingDelete.group.name}' 모임과 멤버, 모든 만남, 지출 및 정산 내역을 삭제합니다. 계속할까요?`
        : ''

  return <>
    <TopBar
      crumbs={[{ label: '모임', to: '/groups' }, { label: group.name }]}
      actions={<MoreMenu label="모임 메뉴" items={[
        { label: '모임 이름 변경', icon: <Pencil size={16} aria-hidden="true" />, onSelect: () => setRenamingGroup(true) },
        { label: '모임 삭제', icon: <Trash2 size={16} aria-hidden="true" />, danger: true, onSelect: () => setPendingDelete({ type: 'group', group }) },
      ]} />}
    />

    <div className="flex flex-none flex-col gap-3 px-4 pt-4 lg:px-8">
      <div className={`${tabList} max-w-xl`} role="tablist" aria-label="모임 상세 메뉴">
        <button type="button" role="tab" aria-selected={tab === 'meetings'} className={tabClass(tab === 'meetings')} onClick={() => setTab('meetings')}>만남 <span className="text-sm text-accent">{meetings.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'members'} className={tabClass(tab === 'members')} onClick={() => setTab('members')}>멤버 <span className="text-sm text-accent">{members.length}</span></button>
      </div>
      {tab === 'meetings'
        ? <form className="flex max-w-3xl gap-2" onSubmit={(e) => void createEncounter(e)}>
          <input className={input} aria-label="새 만남 이름" value={meetingName} maxLength={50} disabled={busy} onChange={(e) => setMeetingName(e.target.value)} placeholder="새 만남 이름 (예: 10월 저녁 모임)" />
          <button type="submit" className={button.primary} disabled={!meetingName.trim() || busy}><Plus size={18} aria-hidden="true" />만남 추가</button>
        </form>
        : <form className="flex max-w-3xl gap-2" onSubmit={(e) => void addNewMember(e)}>
          <input className={input} aria-label="새 멤버 이름" value={memberName} maxLength={30} disabled={busy} onChange={(e) => setMemberName(e.target.value)} placeholder="멤버 이름" />
          <button type="submit" className={button.primary} disabled={!memberName.trim() || busy}><Plus size={18} aria-hidden="true" />추가</button>
        </form>}
    </div>

    <main className="scroll-quiet min-h-0 flex-1 px-4 py-4 lg:px-8">
      {tab === 'meetings' ? meetings.length ? <ul className="m-0 grid max-w-3xl list-none grid-cols-1 gap-3 p-0">
        {meetings.map((meeting) => <li key={meeting.id} className={`${card} flex items-center pr-2 hover:border-accent/30`}>
          <Link to={`/m/${meeting.id}`} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-focus">
            <span className="truncate font-bold text-ink">{meeting.title}</span>
            <span className="text-sm text-muted">{new Date(meeting.created_at).toLocaleDateString('ko-KR')}</span>
          </Link>
          <IconButton label={`${meeting.title} 삭제`} className={deleteIconButton} onClick={() => setPendingDelete({ type: 'meeting', meeting })}><Trash2 size={18} aria-hidden="true" /></IconButton>
        </li>)}
      </ul> : <p className="m-0 max-w-3xl rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">아직 만남 기록이 없어요. 위에서 첫 만남을 추가하고 참석자를 선택하세요.</p>
        : members.length ? <ul className="m-0 grid max-w-3xl list-none grid-cols-1 gap-3 p-0">
          {members.map((member) => <li key={member.id} className={`${card} flex min-h-16 items-center gap-1 py-2 pl-4 pr-2`}>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{member.name}</span>
            <button
              type="button"
              aria-pressed={member.is_treasurer}
              aria-label={member.is_treasurer ? `${member.name} 님은 현재 총무` : `${member.name} 님을 총무로 지정`}
              onClick={() => void chooseTreasurer(member)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${member.is_treasurer ? 'cursor-default bg-accent text-white' : 'border border-line text-muted hover:border-accent/40 hover:text-accent'}`}
            >{member.is_treasurer ? '총무' : '총무 지정'}</button>
            <IconButton label={`${member.name} 이름 변경`} className={iconButton} onClick={() => setMemberBeingRenamed(member)}><Pencil size={17} aria-hidden="true" /></IconButton>
            <IconButton label={`${member.name} 삭제`} className={deleteIconButton} onClick={() => setPendingDelete({ type: 'member', member })}><Trash2 size={18} aria-hidden="true" /></IconButton>
          </li>)}
        </ul> : <p className="m-0 max-w-3xl rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">아직 멤버가 없어요. 위에서 멤버 이름을 추가하세요.</p>}
      {tab === 'members' && members.length > 0 && !members.some((member) => member.is_treasurer) && <p className="mb-0 mt-3 max-w-3xl text-sm text-muted">총무를 지정하면 정산에서 '총무에게 모으기'를 쓸 수 있어요.</p>}
    </main>

    {pendingDelete && <ConfirmModal title={pendingDelete.type === 'group' ? '모임 삭제' : pendingDelete.type === 'meeting' ? '만남 삭제' : '멤버 삭제'} message={pendingDeleteMessage} onConfirm={() => confirmDelete(pendingDelete)} onClose={() => setPendingDelete(null)} />}
    {renamingGroup && <RenameModal title="모임 이름 변경" label="모임 이름" initial={group.name} maxLength={50} onClose={() => setRenamingGroup(false)} onSave={async (name) => {
      await updateGroup(group.id, name, group.treasurer_name, group.treasurer_account)
      setGroup({ ...group, name })
    }} />}
    {memberBeingRenamed && <RenameModal title="멤버 이름 변경" label="멤버 이름" initial={memberBeingRenamed.name} maxLength={30} onClose={() => setMemberBeingRenamed(null)} onSave={async (name) => {
      await renameMember(memberBeingRenamed.id, name)
      await refresh()
    }} />}
  </>
}
