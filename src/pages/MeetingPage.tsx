import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteMeeting, getMeeting, listExpenses, listMeetingMembers, listMembers, updateMeetingTitle } from '../lib/api'
import { cleanGroups, loadGroups } from '../lib/groups'
import { db } from '../lib/db'
import { errorMessage } from '../lib/errors'
import { getUserProfile, type UserProfile } from '../lib/profile'
import type { Expense, Group, Meeting, Member, SocialGroup } from '../types'
import ParticipantsTab from '../components/ParticipantsTab'
import ExpensesTab from '../components/ExpensesTab'
import SettlementTab from '../components/SettlementTab'
import TopBar, { type Crumb } from '../components/TopBar'
import ConfirmModal from '../components/ConfirmModal'
import RenameModal from '../components/RenameModal'
import MoreMenu from '../components/ui/MoreMenu'
import { button, tab as tabClass, tabList } from '../components/ui/styles'

type Tab = 'expenses' | 'members' | 'settlement'

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [parentGroup, setParentGroup] = useState<SocialGroup | null>(null)
  const [available, setAvailable] = useState<Member[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [profile, setProfile] = useState<UserProfile>({ name: '', account: '' })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('expenses')
  const [renaming, setRenaming] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!id) return
    try {
      const meetingInfo = await getMeeting(id)
      if (!meetingInfo) { setMeeting(null); return }
      const [participants, exps, rawGroups, myProfile, allMembers, groupResult] = await Promise.all([
        listMeetingMembers(id),
        listExpenses(id),
        loadGroups(id),
        getUserProfile(),
        meetingInfo.group_id ? listMembers(meetingInfo.group_id) : Promise.resolve([]),
        meetingInfo.group_id
          ? (async () => {
              const { data, error: groupError } = await db.from('groups').select('*').eq('id', meetingInfo.group_id).maybeSingle()
              if (groupError) throw groupError
              return data as SocialGroup | null
            })()
          : Promise.resolve(null),
      ])
      setMeeting(meetingInfo)
      setMembers(participants)
      setExpenses(exps)
      setGroups(cleanGroups(rawGroups, participants))
      setAvailable(meetingInfo.group_id ? allMembers : participants)
      setParentGroup(groupResult)
      setProfile(myProfile)
    } catch (err) {
      toast.error(errorMessage(err), { action: { label: '다시 시도', onClick: () => void refresh() } })
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { void refresh() }, [refresh])

  const crumbs: Crumb[] = meeting?.group_id
    ? [{ label: '모임', to: '/groups' }, { label: parentGroup?.name ?? '모임', to: `/g/${meeting.group_id}` }, { label: meeting.title }]
    : [{ label: '일회성 만남', to: '/groups', state: { tab: 'oneOffs' } }, { label: meeting?.title ?? (loading ? '불러오는 중' : '만남 없음') }]

  if (loading) return <>
    <TopBar crumbs={crumbs} />
    <main className="flex-1 px-4 py-4 lg:px-8"><div className="h-12 max-w-xl animate-pulse rounded-xl bg-subtle" /></main>
  </>
  if (!meeting) return <>
    <TopBar crumbs={crumbs} />
    <main className="grid flex-1 place-items-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="m-0 text-ink">만남을 찾을 수 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.</p>
        <Link to="/" className={button.primary}>홈으로</Link>
      </div>
    </main>
  </>

  async function removeMeeting(target: Meeting) {
    await deleteMeeting(target.id)
    toast.success('만남을 삭제했어요.')
    navigate(target.group_id ? `/g/${target.group_id}` : '/groups', target.group_id ? undefined : { state: { tab: 'oneOffs' } })
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'expenses', label: '지출', count: expenses.length },
    { key: 'members', label: '참석', count: members.length },
    { key: 'settlement', label: '정산' },
  ]

  return <>
    <TopBar
      crumbs={crumbs}
      actions={<MoreMenu label="만남 메뉴" items={[
        { label: '만남 이름 변경', icon: <Pencil size={16} aria-hidden="true" />, onSelect: () => setRenaming(true) },
        { label: '만남 삭제', icon: <Trash2 size={16} aria-hidden="true" />, danger: true, onSelect: () => setDeleteConfirmOpen(true) },
      ]} />}
    />
    <div className="flex-none px-4 pt-4 lg:px-8">
      <div className={`${tabList} max-w-3xl`} role="tablist" aria-label="만남 메뉴">
        {tabs.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={tabClass(tab === item.key)} onClick={() => setTab(item.key)}>
          {item.label}{item.count ? <span className="text-sm text-accent">{item.count}</span> : null}
        </button>)}
      </div>
    </div>

    {tab === 'expenses' && <ExpensesTab meetingId={meeting.id} members={members} expenses={expenses} groups={groups} onChanged={() => void refresh()} onReordered={setExpenses} goMembers={() => setTab('members')} />}
    {tab === 'members' && <main className="scroll-quiet min-h-0 flex-1 px-4 py-4 lg:px-8"><ParticipantsTab meetingId={meeting.id} available={available} participants={members} expenses={expenses} groups={groups} standalone={!meeting.group_id} onGroupsChanged={setGroups} onChanged={() => void refresh()} /></main>}
    {tab === 'settlement' && <main className="scroll-quiet min-h-0 flex-1 px-4 py-4 lg:px-8"><SettlementTab members={members} expenses={expenses} groups={groups} meetingTitle={meeting.title} treasurerName={profile.name} treasurerAccount={profile.account} /></main>}

    {deleteConfirmOpen && <ConfirmModal title="만남 삭제" message={`'${meeting.title}' 만남과 지출 기록을 삭제할까요?`} onConfirm={() => removeMeeting(meeting)} onClose={() => setDeleteConfirmOpen(false)} />}
    {renaming && <RenameModal title="만남 이름 변경" label="만남 이름" initial={meeting.title} maxLength={50} onClose={() => setRenaming(false)} onSave={async (title) => {
      await updateMeetingTitle(meeting.id, title)
      setMeeting({ ...meeting, title })
    }} />}
  </>
}
