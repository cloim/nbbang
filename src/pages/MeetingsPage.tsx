import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { createGroup, createMeeting, listGroups, listRecentMeetings } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { Meeting, SocialGroup } from '../types'
import TopBar from '../components/TopBar'
import { Modal } from '../components/Modal/Modal'
import { button, card, input, label as labelClass } from '../components/ui/styles'

type CreateKind = 'group' | 'once'

export default function MeetingsPage() {
  const navigate = useNavigate()
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([])
  const [groups, setGroups] = useState<SocialGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<CreateKind | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [meetings, groupRows] = await Promise.all([listRecentMeetings(), listGroups()])
      setRecentMeetings(meetings)
      setGroups(groupRows)
    } catch (err) {
      toast.error(errorMessage(err), { action: { label: '다시 시도', onClick: () => void refresh() } })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const groupName = new Map(groups.map((group) => [group.id, group.name]))

  return <>
    <TopBar title="홈" subtitle="최근 만남을 이어서 정산해요" />
    <main className="scroll-quiet min-h-0 flex-1 px-4 py-5 lg:px-8 lg:py-6">
      <div className="flex max-w-3xl flex-col gap-6">
        {/* 두 생성 버튼은 좁은 화면에서도 한 줄에 둔다. 공간이 부족하면 아이콘을 먼저 숨긴다. */}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" className={button.primary} onClick={() => setForm('group')}><Plus size={18} aria-hidden="true" className="hidden min-[400px]:block" />모임 만들기</button>
          <button type="button" className={button.secondary} onClick={() => setForm('once')}><Zap size={18} aria-hidden="true" className="hidden min-[400px]:block" />모임 외 만남 만들기</button>
        </div>

        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <div className="flex h-9 items-center justify-between">
            <h2 id="recent-heading" className="m-0 text-base font-bold text-accent">최근 만남</h2>
          </div>
          {loading ? <ListSkeleton /> : recentMeetings.length ? <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {recentMeetings.map((meeting) => <li key={meeting.id}>
              <Link to={`/m/${meeting.id}`} className={`${card} flex min-h-16 items-center gap-3 px-4 py-3 hover:border-accent/30 focus-visible:outline-2 focus-visible:outline-focus`}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-bold text-ink">{meeting.title}</span>
                  <span className="truncate text-sm text-muted">
                    {meeting.group_id ? groupName.get(meeting.group_id) ?? '모임' : '모임 외 만남'} | {new Date(meeting.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>)}
          </ul> : <p className="m-0 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">아직 만남이 없어요. 위 버튼으로 첫 만남을 만들어 보세요.</p>}
        </section>
      </div>
    </main>
    {form && <CreateModal kind={form} onClose={() => setForm(null)} onCreated={(path) => navigate(path)} />}
  </>
}

function ListSkeleton() {
  return <div className="flex flex-col gap-2.5" aria-hidden="true">
    {[0, 1, 2].map((key) => <div key={key} className="h-16 animate-pulse rounded-2xl bg-subtle" />)}
  </div>
}

function CreateModal({ kind, onClose, onCreated }: { kind: CreateKind; onClose: () => void; onCreated: (path: string) => void }) {
  const formId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const title = name.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title || busy) return
    setBusy(true)
    try {
      if (kind === 'group') {
        const group = await createGroup(title)
        onCreated(`/g/${group.id}`)
      } else {
        const meeting = await createMeeting(title, null)
        onCreated(`/m/${meeting.id}`)
      }
    } catch (err) {
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  return <Modal
    isOpen
    size="sm"
    draggable={false}
    title={kind === 'group' ? '새 모임' : '모임 외 만남'}
    initialFocusRef={inputRef}
    onClose={() => { if (!busy) onClose() }}
    footer={<>
      <button type="button" className={button.ghost} disabled={busy} onClick={onClose}>취소</button>
      <button type="submit" form={formId} className={button.primary} disabled={!title || busy}>{busy ? '만드는 중…' : kind === 'group' ? '모임 만들기' : '만남 만들기'}</button>
    </>}
  >
    <form id={formId} onSubmit={(event) => void submit(event)}>
      <label className={labelClass}>
        {kind === 'group' ? '모임 이름' : '만남 이름'}
        <input ref={inputRef} className={input} value={name} maxLength={50} disabled={busy} onChange={(event) => setName(event.target.value)} placeholder={kind === 'group' ? '예: 주말 등산 모임' : '예: 10월 번개 모임'} />
      </label>
    </form>
  </Modal>
}
