import type { Group, Member } from '../types'

/**
 * 모임 멤버 목록 기준으로 그룹 데이터를 정제한다.
 * 탈퇴/삭제된 멤버는 제외하고, 1명의 멤버는 1개의 그룹에만 속하도록 정리한다.
 * 대표 지출자가 누락되었거나 목록에 없으면 첫 번째 멤버를 대표로 지정한다.
 */
export function cleanGroups(raw: unknown, members: Member[]): Group[] {
  const valid = new Set(members.map((m) => m.id))
  const assigned = new Set<string>()

  return (Array.isArray(raw) ? raw : []).flatMap((g) => {
    if (
      !g ||
      typeof g !== 'object' ||
      typeof (g as { id?: unknown }).id !== 'string' ||
      typeof (g as { name?: unknown }).name !== 'string' ||
      !Array.isArray((g as { memberIds?: unknown }).memberIds)
    ) {
      return []
    }

    const groupObj = g as {
      id: string
      name: string
      memberIds: unknown[]
      representativeId?: string
    }

    const ids = [...new Set(groupObj.memberIds)].filter(
      (id): id is string =>
        typeof id === 'string' && valid.has(id) && !assigned.has(id),
    )

    if (ids.length === 0) return []
    for (const id of ids) assigned.add(id)

    const repId =
      typeof groupObj.representativeId === 'string' &&
      ids.includes(groupObj.representativeId)
        ? groupObj.representativeId
        : ids[0]

    return [
      {
        id: groupObj.id,
        name: groupObj.name,
        memberIds: ids,
        representativeId: repId,
      },
    ]
  })
}

/**
 * 로그인한 모임 소유자의 user_metadata에서 해당 모임의 그룹 목록을 불러온다.
 */
export async function loadGroups(meetingId: string): Promise<Group[]> {
  const response = await fetch(`/api/settlement-groups/${meetingId}`, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('모임 정산 그룹을 불러오지 못했습니다.')
  return response.json() as Promise<Group[]>
}

/**
 * 해당 모임의 그룹 목록을 로그인한 사용자의 user_metadata에 저장한다.
 */
export async function saveGroups(
  meetingId: string,
  groups: Group[],
): Promise<void> {
  const response = await fetch(`/api/settlement-groups/${meetingId}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ groups }),
  })
  if (!response.ok) throw new Error('모임 정산 그룹을 저장하지 못했습니다.')
}

/**
 * 개인별 net 정산 금액을 그룹 대표자에게 합산하여 반환한다.
 * 그룹원들의 금액은 0으로 처리되고 대표자에게 합산액이 배정된다.
 */
export function groupNet(
  net: Record<string, number>,
  groups: Group[],
): Record<string, number> {
  const result: Record<string, number> = { ...net }
  for (const group of groups) {
    const sum = group.memberIds.reduce((total, id) => total + (net[id] ?? 0), 0)
    for (const id of group.memberIds) {
      result[id] = 0
    }
    result[group.representativeId] = sum
  }
  return result
}


