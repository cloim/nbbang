import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { db, type LocalUser } from '../lib/db'
import TopBar from '../components/TopBar'
import { errorMessage } from '../lib/errors'
import { getUserProfile, saveUserProfile } from '../lib/profile'
import { button, card, input, label as labelClass } from '../components/ui/styles'

export default function SettingsPage() {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [{ data, error: userError }, profile] = await Promise.all([
          db.auth.getUser(),
          getUserProfile(),
        ])
        if (userError) throw userError
        setUser(data.user)
        setName(profile.name)
        setAccount(profile.account)
      } catch (err) { toast.error(errorMessage(err)) }
      finally { setLoading(false) }
    }
    void load()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await saveUserProfile({ name, account })
      const { data } = await db.auth.getUser()
      setUser(data.user)
      toast.success('내 정보를 저장했어요.')
    } catch (err) { toast.error(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <>
    <TopBar title="설정" subtitle="정산 이미지에 쓸 내 정보를 관리해요" />
    <main className="scroll-quiet min-h-0 flex-1 px-4 py-5 lg:px-8 lg:py-6">
      <form className={`${card} flex max-w-2xl flex-col gap-4 p-5`} onSubmit={(event) => void submit(event)}>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-base font-bold text-accent">내 정보</h2>
          <p className="m-0 text-sm text-muted">정산 이미지와 총무 정보에 표시할 이름과 계좌번호예요.</p>
        </div>
        {loading ? <div className="flex flex-col gap-4" aria-hidden="true">
          <div className="h-[4.5rem] animate-pulse rounded-xl bg-subtle" />
          <div className="h-[4.5rem] animate-pulse rounded-xl bg-subtle" />
        </div> : <>
          {user?.email && <p className="m-0 text-sm text-muted">로그인 계정 <strong className="ml-1 break-all text-ink">{user.email}</strong></p>}
          <label className={labelClass}>내 이름
            <input className={input} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="정산에 표시할 이름" />
          </label>
          <label className={labelClass}>내 계좌번호
            <input className={input} value={account} maxLength={80} onChange={(event) => setAccount(event.target.value)} placeholder="예: 토스뱅크 1000-0000-0000" />
          </label>
        </>}
        <div className="flex justify-end">
          <button className={button.primary} type="submit" disabled={busy || loading}>{busy ? '저장 중…' : '내 정보 저장'}</button>
        </div>
      </form>
    </main>
  </>
}
