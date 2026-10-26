import { House, Settings, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const tabs = [
  { label: '홈', path: '/', Icon: House },
  { label: '모임', path: '/groups', Icon: Users },
  { label: '설정', path: '/settings', Icon: Settings },
]

function useSelectedPath() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/settings')) return '/settings'
  if (pathname.startsWith('/groups') || pathname.startsWith('/g/') || pathname.startsWith('/m/')) return '/groups'
  return '/'
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

// 넓은 화면: 로고와 주요 메뉴를 담는 왼쪽 사이드바
export function Sidebar() {
  const selected = useSelectedPath()
  return <aside className="hidden w-60 flex-none flex-col gap-6 border-r border-line bg-card px-4 py-5 lg:flex">
    <Link to="/" aria-label="엔빵 홈" className={`flex items-center gap-2 rounded-xl px-2 ${focusRing}`}>
      <img src="/nbbang-logo.png" alt="" className="size-10" />
      <img src="/nbbang-title.png" alt="" className="h-11 w-auto" />
    </Link>
    <nav aria-label="주요 메뉴" className="flex flex-col gap-1">
      {tabs.map(({ label, path, Icon }) => {
        const active = selected === path
        return <Link key={path} to={path} aria-current={active ? 'page' : undefined} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold ${focusRing} ${active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-subtle hover:text-ink'}`}>
          <Icon size={20} aria-hidden="true" />{label}
        </Link>
      })}
    </nav>
  </aside>
}

// 좁은 화면: 콘텐츠 아래에 붙는 하단 탭. 흐름 안에 두어 다른 요소를 가리지 않는다.
export default function BottomTabs() {
  const selected = useSelectedPath()
  return <nav className="flex flex-none justify-around border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="주요 메뉴">
    {tabs.map(({ label, path, Icon }) => {
      const active = selected === path
      return <Link key={path} to={path} aria-current={active ? 'page' : undefined} className={`flex h-16 min-w-20 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${focusRing} ${active ? 'text-accent' : 'text-muted hover:text-ink'}`}>
        <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? 'bg-accent-soft text-focus' : ''}`}><Icon size={20} aria-hidden="true" /></span>
        {label}
      </Link>
    })}
  </nav>
}
