import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import TopBar from '../components/TopBar'
import { deleteMeeting, listGroups, listMeetings } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { Meeting, SocialGroup } from '../types'
import ConfirmModal from '../components/ConfirmModal'
import IconButton from '../components/ui/IconButton'
import { card, deleteIconButton, tab as tabClass, tabList } from '../components/ui/styles'

export default function GroupsPage() {
  const location = useLocation()
  const [groups, setGroups] = useState<SocialGroup[]>([])
  const [oneOffs, setOneOffs] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'groups' | 'oneOffs'>(() => (location.state as { tab?: string } | null)?.tab === 'oneOffs' ? 'oneOffs' : 'groups')
  const [pendingMeeting, setPendingMeeting] = useState<Meeting | null>(null)

  const load = useCallback(async () => {
    try {
      const [groupRows, meetings] = await Promise.all([listGroups(), listMeetings(null)])
      setGroups(groupRows)
      setOneOffs(meetings)
    } catch (err) {
      toast.error(errorMessage(err), { action: { label: '다시 시도', onClick: () => void load() } })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function removeMeeting(meeting: Meeting) {
    await deleteMeeting(meeting.id)
    setOneOffs((current) => current.filter((item) => item.id !== meeting.id))
    toast.success('만남을 삭제했어요.')
  }

  const linkClass = 'flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-focus'

  return <>
    <TopBar title="모임" subtitle="모임과 모임 외 만남을 관리해요" />
    <div className="flex-none px-4 pt-4 lg:px-8">
      <div className={`${tabList} max-w-xl`} role="tablist" aria-label="모임 목록">
        <button type="button" role="tab" aria-selected={tab === 'groups'} className={tabClass(tab === 'groups')} onClick={() => setTab('groups')}>모임 <span className="text-sm text-accent">{groups.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'oneOffs'} className={tabClass(tab === 'oneOffs')} onClick={() => setTab('oneOffs')}>모임 외 만남 <span className="text-sm text-accent">{oneOffs.length}</span></button>
      </div>
    </div>
    <main className="scroll-quiet min-h-0 flex-1 px-4 py-4 lg:px-8">
      {loading ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-hidden="true">{[0, 1, 2, 3].map((key) => <div key={key} className="h-16 animate-pulse rounded-2xl bg-subtle" />)}</div>
        : tab === 'groups' ? groups.length ? <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-2">
          {groups.map((group) => <li key={group.id} className={`${card} flex items-center pr-3 hover:border-accent/30`}>
            <Link to={`/g/${group.id}`} className={linkClass}><span className="truncate font-bold text-ink">{group.name}</span></Link>
            <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
          </li>)}
        </ul> : <p className="m-0 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">아직 만든 모임이 없어요. 홈에서 모임을 만들 수 있어요.</p>
        : oneOffs.length ? <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-2">
          {oneOffs.map((meeting) => <li key={meeting.id} className={`${card} flex items-center pr-2 hover:border-accent/30`}>
            <Link to={`/m/${meeting.id}`} className={linkClass}>
              <span className="truncate font-bold text-ink">{meeting.title}</span>
              <span className="text-sm text-muted">{new Date(meeting.created_at).toLocaleDateString('ko-KR')}</span>
            </Link>
            <IconButton label={`${meeting.title} 삭제`} className={deleteIconButton} onClick={() => setPendingMeeting(meeting)}><Trash2 size={18} aria-hidden="true" /></IconButton>
          </li>)}
        </ul> : <p className="m-0 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">모임 외 만남이 여기에 보여요.</p>}
    </main>
    {pendingMeeting && <ConfirmModal title="만남 삭제" message={`'${pendingMeeting.title}' 만남과 지출 기록을 삭제할까요?`} onConfirm={() => removeMeeting(pendingMeeting)} onClose={() => setPendingMeeting(null)} />}
  </>
}
