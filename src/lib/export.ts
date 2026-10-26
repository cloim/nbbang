import type { Expense, Group, Member } from '../types'
import type { Settlement, Transfer } from './settlement'
import { formatKRW } from './settlement'

const money = (value: number | null | undefined) => formatKRW(value ?? 0)
const balance = (value: number) =>
  value > 0
    ? `+${money(value)} 받음`
    : value < 0
      ? `${money(-value)} 보냄`
      : '정산 완료'
const color = (value: number) =>
  value > 0 ? '#16836b' : value < 0 ? '#dc4b55' : '#64748b'
const FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface CreateSettlementCanvasParams {
  title?: string
  treasurerName?: string
  treasurerAccount?: string
  members: Member[]
  expenses: Expense[]
  groups: Group[]
  result: Settlement
  transfers: Transfer[]
  mode: 'minimal' | 'hub'
}

interface CanvasRow {
  x?: number
  y: number
  text?: string
  size?: number
  weight?: number
  ink?: string
  align?: CanvasTextAlign
  rule?: boolean
}

export async function createSettlementCanvas({
  title,
  treasurerName,
  treasurerAccount,
  members,
  expenses,
  groups,
  result,
  transfers,
  mode,
}: CreateSettlementCanvasParams): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready
  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이 브라우저에서 이미지 생성을 지원하지 않습니다.')

  const width = 900
  const padding = 48
  const contentWidth = width - padding * 2
  const rows: CanvasRow[] = []
  let y = 48

  function text(
    value: string | number,
    {
      size = 22,
      weight = 400,
      ink = '#172b42',
      right,
      gap = 10,
    }: {
      size?: number
      weight?: number
      ink?: string
      right?: string
      gap?: number
    } = {},
  ) {
    if (!ctx) return
    ctx.font = `${weight} ${size}px ${FONT}`
    const available = right == null ? contentWidth : contentWidth - 270
    const lines: string[] = []
    let line = ''
    for (const ch of String(value ?? '')) {
      if (
        ch === '\n' ||
        (line && ctx.measureText(line + ch).width > available)
      ) {
        lines.push(line)
        line = ch === '\n' ? '' : ch
      } else {
        line += ch
      }
    }
    lines.push(line)
    const top = y
    for (const lineVal of lines) {
      rows.push({ x: padding, y, text: lineVal, size, weight, ink })
      y += size * 1.5
    }
    if (right != null) {
      rows.push({
        x: width - padding,
        y: top,
        text: right,
        size,
        weight: 600,
        ink,
        align: 'right',
      })
    }
    y += gap
  }

  function section(label: string) {
    y += 22
    rows.push({ rule: true, y })
    y += 25
    text(label, { size: 25, weight: 700, gap: 14 })
  }

  const names = new Map(members.map((member) => [member.id, member.name]))
  const name = (id: string) => names.get(id) ?? '알 수 없는 멤버'

  text('nBBang · 정산 결과', { size: 19, weight: 700, ink: '#16836b' })
  text(title || '모임 정산', { size: 34, weight: 750, gap: 14 })
  if (treasurerAccount) {
    text(`총무 ${treasurerName || '미지정'} · 계좌 ${treasurerAccount}`, {
      size: 19,
      weight: 600,
      ink: '#64748b',
      gap: 18,
    })
  }
  text(
    `총 지출 ${money(expenses.reduce((sum, expense) => sum + expense.amount, 0))}`,
    {
      size: 27,
      weight: 700,
    },
  )
  text(
    `${members.length}명 · 지출 ${expenses.length}건 · ${new Date().toLocaleDateString('ko-KR')}`,
    { size: 18, ink: '#64748b' },
  )

  for (const warning of result.warnings) {
    text(`확인: ${warning}`, { size: 18, ink: '#b45309' })
  }

  if (groups.length > 0) {
    section('그룹별 정산')
    text('그룹원 금액을 합산하여 대표가 보내거나 받습니다.', {
      size: 18,
      ink: '#64748b',
    })
    for (const group of groups) {
      const net = group.memberIds.reduce(
        (sum, id) => sum + (result.net[id] ?? 0),
        0,
      )
      text(group.name, { weight: 650, right: balance(net), ink: color(net) })
      text(
        `대표: ${name(group.representativeId)} · 멤버: ${group.memberIds.map(name).join(', ')}`,
        { size: 18, ink: '#64748b', gap: 18 },
      )
    }
  }

  section('사람별 정산')
  for (const member of [...members].sort(
    (a, b) => (result.net[b.id] ?? 0) - (result.net[a.id] ?? 0),
  )) {
    const net = result.net[member.id] ?? 0
    text(member.name + (member.is_treasurer ? ' · 총무' : ''), {
      weight: 650,
      right: balance(net),
      ink: color(net),
    })
    text(
      `냄 ${money(result.paid[member.id])} · 부담 ${money(result.owed[member.id])}`,
      {
        size: 18,
        ink: '#64748b',
        gap: 18,
      },
    )
  }

  section('송금 경로')
  text(
    `${mode === 'hub' ? '총무에게 모으기' : '최소 횟수'} · 총 ${transfers.length}회 송금`,
    {
      size: 18,
      ink: '#64748b',
    },
  )
  if (!transfers.length) {
    text('모두 정산이 맞아 송금할 것이 없습니다.', { size: 21 })
  }
  for (const transfer of transfers) {
    text(`${name(transfer.fromId)} → ${name(transfer.toId)}`, {
      weight: 600,
      right: money(transfer.amount),
      gap: 18,
    })
  }

  section('지출별 분담 내역')
  for (const breakdown of result.breakdowns) {
    const expense = expenses.find((item) => item.id === breakdown.expenseId)
    if (!expense) continue
    text(expense.title, { weight: 650, right: money(expense.amount) })
    text(`결제: ${name(expense.payer_id)} · 참여 ${breakdown.shares.length}명`, {
      size: 18,
      ink: '#64748b',
    })
    for (const share of breakdown.shares) {
      text(
        name(share.memberId) +
          (share.isAbsorber
            ? ` (나머지 ${breakdown.absorbedRemainder}원 포함)`
            : ''),
        { size: 18, right: money(share.amount), ink: '#64748b', gap: 5 },
      )
    }
    y += 14
  }

  y += 24
  text('nBBang · 함께 쓰고, 깔끔하게 나누기', { size: 17, ink: '#94a3b8' })

  const height = Math.ceil(y + 38)
  const scale = Math.min(
    2,
    16000 / height,
    Math.sqrt(16000000 / (width * height)),
  )
  if (scale < 0.5) {
    throw new Error(
      '정산 내역이 너무 길어 한 장의 이미지로 저장할 수 없습니다. 모임을 나누어 다시 시도하세요.',
    )
  }

  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이 브라우저에서 이미지 생성을 지원하지 않습니다.')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.textBaseline = 'top'

  for (const row of rows) {
    if (row.rule) {
      ctx.fillStyle = '#e2e8f0'
      ctx.fillRect(padding, row.y, contentWidth, 1)
      continue
    }
    ctx.font = `${row.weight ?? 400} ${row.size ?? 22}px ${FONT}`
    ctx.fillStyle = row.ink ?? '#172b42'
    ctx.textAlign = row.align ?? 'left'
    if (row.text != null && row.x != null) {
      ctx.fillText(row.text, row.x, row.y)
    }
  }
  return canvas
}

export type DownloadResult =
  | { method: 'cancelled' }
  | { method: 'picker'; filename: string }
  | { method: 'preview'; filename: string; url: string; writeFailed?: boolean }

export async function downloadSettlementImage(
  data: CreateSettlementCanvasParams,
): Promise<DownloadResult> {
  const rawTitle = String(data.title || '모임').slice(0, 70)
  const title = Array.from(rawTitle)
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code < 32 || '\\/:*?"<>|'.includes(ch)) return '_'
      return ch
    })
    .join('')
  const filename = `${title}_정산결과.png`

  let handle: FileSystemFileHandle | undefined
  const win = window as unknown as {
    showSaveFilePicker?: (options: {
      suggestedName: string
      types: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<FileSystemFileHandle>
  }

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [
          { description: 'PNG 이미지', accept: { 'image/png': ['.png'] } },
        ],
      })
    } catch (error: unknown) {
      const err = error as Error
      if (err.name === 'AbortError') return { method: 'cancelled' }
      if (
        err.name !== 'SecurityError' &&
        err.name !== 'NotSupportedError' &&
        err.name !== 'NotAllowedError'
      ) {
        throw error
      }
    }
  }

  const canvas = await createSettlementCanvas(data)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(
              new Error('이미지 생성에 실패했습니다. 다시 시도하세요.'),
            ),
      'image/png',
    ),
  )

  if (handle) {
    let stream: FileSystemWritableFileStream | undefined
    try {
      stream = await handle.createWritable()
      await stream.write(blob)
      await stream.close()
      return { method: 'picker', filename }
    } catch {
      try {
        await stream?.abort()
      } catch {}
      return {
        method: 'preview',
        filename,
        url: URL.createObjectURL(blob),
        writeFailed: true,
      }
    }
  }

  return { method: 'preview', filename, url: URL.createObjectURL(blob) }
}


