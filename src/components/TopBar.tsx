import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AvatarMenu from './AvatarMenu'
import IconButton from './ui/IconButton'

export interface Crumb {
  label: string
  to?: string
  state?: unknown
}

interface Props {
  title?: string
  subtitle?: string
  crumbs?: Crumb[]
  actions?: ReactNode
}

// 상위 페이지는 타이틀과 서브타이틀, 하위 페이지는 같은 높이의 breadcrumb를 보여준다.
// 상단바는 콘텐츠 스크롤 영역 밖에 있어 스크롤해도 현재 위치가 남는다.
export default function TopBar({ title, subtitle, crumbs, actions }: Props) {
  const navigate = useNavigate()
  const parent = crumbs ? [...crumbs].reverse().find((crumb) => crumb.to) : undefined

  return <header className="flex h-16 flex-none items-center gap-2 border-b border-line bg-bg px-4 lg:px-8">
    {parent?.to && <IconButton label={`${parent.label}(으)로 돌아가기`} className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-subtle lg:hidden" onClick={() => navigate(parent.to!, { state: parent.state })}>
      <ArrowLeft size={20} aria-hidden="true" />
    </IconButton>}
    {!crumbs && <Link to="/" className="shrink-0 lg:hidden" aria-label="홈으로"><img src="/nbbang-logo.png" alt="" className="size-9" /></Link>}
    <div className="min-w-0 flex-1">
      {crumbs ? <nav aria-label="현재 위치">
        <ol className="flex min-w-0 items-center gap-1 text-lg font-bold">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1
            return <Fragment key={`${crumb.label}-${index}`}>
              {/* 좁은 화면에서는 뒤로 가기 버튼이 상위 경로를 대신하므로 현재 항목만 남긴다. */}
              <li className={last ? 'min-w-0 truncate text-ink' : 'hidden max-w-56 truncate lg:block'} aria-current={last ? 'page' : undefined}>
                {last ? <h1 className="m-0 truncate text-lg font-bold">{crumb.label}</h1> : !crumb.to ? crumb.label : <Link to={crumb.to} state={crumb.state} className="rounded text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-focus">{crumb.label}</Link>}
              </li>
              {!last && <li aria-hidden="true" className="hidden shrink-0 text-muted lg:block"><ChevronRight size={18} /></li>}
            </Fragment>
          })}
        </ol>
      </nav> : <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="m-0 truncate text-lg font-bold text-ink">{title}</h1>
        {subtitle && <p className="m-0 hidden truncate text-sm text-muted sm:block">{subtitle}</p>}
      </div>}
    </div>
    {actions}
    <AvatarMenu />
  </header>
}
