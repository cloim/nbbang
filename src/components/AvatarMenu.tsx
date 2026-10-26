import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LogOut, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, type LocalUser } from '../lib/db'

export default function AvatarMenu() {
  const [user, setUser] = useState<LocalUser | null>(null)
  const navigate = useNavigate()
  useEffect(() => {
    void db.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: authListener } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => authListener.subscription.unsubscribe()
  }, [])

  // 사용자 정보를 받기 전에도 같은 크기의 자리를 잡아 상단바가 흔들리지 않게 한다.
  if (!user) return <span className="size-10 shrink-0 rounded-full bg-subtle" aria-hidden="true" />

  const name = String(user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || '사용자')
  const picture = typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : ''
  const initial = Array.from(name.trim())[0] ?? '나'
  const itemClass = 'flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-ink outline-none data-[highlighted]:bg-subtle'

  return <DropdownMenu.Root>
    <DropdownMenu.Trigger className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-accent/15 bg-accent-soft text-sm font-extrabold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" aria-label="계정 메뉴">
      {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : <span>{initial}</span>}
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={8} className="z-[1500] w-60 rounded-xl border border-line bg-card p-1.5 shadow-lg">
        <div className="flex flex-col gap-0.5 px-3 pb-2.5 pt-2">
          <strong className="truncate text-sm text-accent">{name}</strong>
          {user.email && <span className="truncate text-xs text-muted">{user.email}</span>}
        </div>
        <DropdownMenu.Separator className="mb-1 h-px bg-line" />
        <DropdownMenu.Item className={itemClass} onSelect={() => navigate('/settings')}><Settings size={16} aria-hidden="true" />계정 설정</DropdownMenu.Item>
        <DropdownMenu.Item className={itemClass} onSelect={() => void db.auth.signOut()}><LogOut size={16} aria-hidden="true" />로그아웃</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
}
