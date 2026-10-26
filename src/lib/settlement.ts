export interface ShareInput {
  memberId: string
  /** null이면 균등 분배 대상, 값이 있으면 고정 분담액 */
  amount: number | null
}

export interface ExpenseInput {
  id: string
  title: string
  payerId: string
  amount: number
  shares: ShareInput[]
}

export interface Transfer {
  fromId: string
  toId: string
  amount: number
}

export interface ShareResult {
  memberId: string
  amount: number
  isAbsorber: boolean
}

export interface ExpenseBreakdown {
  expenseId: string
  shares: ShareResult[]
  /** 균등 분배에서 나누어떨어지지 않아 흡수자가 추가 부담한 금액 */
  absorbedRemainder: number
  warning?: string
}

export interface Settlement {
  /** memberId -> 부담해야 할 총액 */
  owed: Record<string, number>
  /** memberId -> 실제 지불한 총액 */
  paid: Record<string, number>
  /** memberId -> paid - owed. 양수면 받을 돈, 음수면 낼 돈 */
  net: Record<string, number>
  transfers: Transfer[]
  breakdowns: ExpenseBreakdown[]
  warnings: string[]
}

/**
 * 지출 하나를 인별 분담액으로 확정한다. 총합은 항상 정확히 보존된다.
 * 균등 분배에서 남는 나머지는 absorberPriority(총무 -> 지출인) 순서로
 * 균등 분배 참여자 중 첫 번째 해당자가 흡수한다.
 */
export function splitExpense(
  expense: ExpenseInput,
  absorberPriority: string[] = [],
): ExpenseBreakdown {
  const fixed = expense.shares.filter((s) => s.amount != null)
  const equal = expense.shares.filter((s) => s.amount == null)
  const fixedSum = fixed.reduce((sum, s) => sum + (s.amount as number), 0)

  if (equal.length === 0) {
    const breakdown: ExpenseBreakdown = {
      expenseId: expense.id,
      shares: fixed.map((s) => ({
        memberId: s.memberId,
        amount: s.amount as number,
        isAbsorber: false,
      })),
      absorbedRemainder: 0,
    }
    if (fixedSum !== expense.amount) {
      breakdown.warning = `'${expense.title}' 지정 금액 합계(${fixedSum.toLocaleString()}원)가 총액(${expense.amount.toLocaleString()}원)과 다릅니다. 지정 금액 기준으로 정산합니다.`
    }
    return breakdown
  }

  const remainder = expense.amount - fixedSum
  let warning: string | undefined
  let distributable = remainder
  if (remainder < 0) {
    warning = `'${expense.title}' 지정 금액 합계가 총액을 초과합니다. 초과분은 균등 분배에서 제외했습니다.`
    distributable = 0
  }

  const base = Math.floor(distributable / equal.length)
  const leftover = distributable - base * equal.length

  const equalIds = equal.map((s) => s.memberId)
  const absorberId =
    absorberPriority.find((id) => equalIds.includes(id)) ?? equalIds[0]

  const shares: ShareResult[] = expense.shares.map((s) => {
    if (s.amount != null) {
      return { memberId: s.memberId, amount: s.amount, isAbsorber: false }
    }
    const isAbsorber = s.memberId === absorberId
    return {
      memberId: s.memberId,
      amount: base + (isAbsorber ? leftover : 0),
      isAbsorber: isAbsorber && leftover > 0,
    }
  })

  return { expenseId: expense.id, shares, absorbedRemainder: leftover, warning }
}

/**
 * 전체 정산 계산. sum(net) === 0 불변식을 항상 유지한다.
 * (지불액은 확정 분담액 합계 기준으로 집계하므로 입력 불일치가 있어도 보존된다)
 */
export function computeSettlement(
  memberIds: string[],
  expenses: ExpenseInput[],
  treasurerId?: string | null,
): Settlement {
  const owed: Record<string, number> = {}
  const paid: Record<string, number> = {}
  for (const id of memberIds) {
    owed[id] = 0
    paid[id] = 0
  }

  const warnings: string[] = []
  const breakdowns: ExpenseBreakdown[] = []

  for (const expense of expenses) {
    const priority = [treasurerId, expense.payerId].filter(
      (id): id is string => id != null,
    )
    const breakdown = splitExpense(expense, priority)
    breakdowns.push(breakdown)
    if (breakdown.warning) warnings.push(breakdown.warning)

    const effectiveAmount = breakdown.shares.reduce((sum, s) => sum + s.amount, 0)
    paid[expense.payerId] = (paid[expense.payerId] ?? 0) + effectiveAmount
    for (const share of breakdown.shares) {
      owed[share.memberId] = (owed[share.memberId] ?? 0) + share.amount
    }
  }

  const net: Record<string, number> = {}
  const ids = new Set([...memberIds, ...Object.keys(owed), ...Object.keys(paid)])
  for (const id of ids) {
    net[id] = (paid[id] ?? 0) - (owed[id] ?? 0)
  }

  return {
    owed,
    paid,
    net,
    transfers: simplifyDebts(net),
    breakdowns,
    warnings,
  }
}

interface Person {
  id: string
  net: number
}

/**
 * 최소 송금 횟수 경로 산정.
 * 인원이 14명 이하면 부분집합 DP로 0합 그룹 개수를 최대화해
 * 진짜 최소 송금 횟수를 보장하고, 그 이상이면 greedy로 처리한다.
 */
export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const people: Person[] = Object.entries(net)
    .filter(([, n]) => n !== 0)
    .map(([id, n]) => ({ id, net: n }))

  if (people.length === 0) return []

  const groups =
    people.length <= 14 ? partitionZeroSumGroups(people) : [people]

  const transfers: Transfer[] = []
  for (const group of groups) {
    transfers.push(...greedyTransfers(group))
  }
  return transfers
}

/** 0합 부분집합 개수를 최대화하는 분할 (bitmask DP, O(3^n)) */
function partitionZeroSumGroups(people: Person[]): Person[][] {
  const n = people.length
  const full = (1 << n) - 1

  const lowIdx = new Int8Array(1 << n)
  for (let i = 0; i < n; i++) lowIdx[1 << i] = i

  const sums = new Float64Array(1 << n)
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask
    sums[mask] = sums[mask ^ low] + people[lowIdx[low]].net
  }

  const dp = new Int8Array(1 << n).fill(-1)
  const choice = new Int32Array(1 << n)
  dp[0] = 0

  for (let mask = 1; mask <= full; mask++) {
    if (sums[mask] !== 0) continue
    const low = mask & -mask
    for (let sub = mask; sub > 0; sub = (sub - 1) & mask) {
      if (!(sub & low)) continue
      if (sums[sub] !== 0) continue
      const rest = mask ^ sub
      if (dp[rest] < 0) continue
      if (dp[rest] + 1 > dp[mask]) {
        dp[mask] = dp[rest] + 1
        choice[mask] = sub
      }
    }
  }

  const groups: Person[][] = []
  let mask = full
  while (mask > 0) {
    const sub = choice[mask]
    const group: Person[] = []
    for (let i = 0; i < n; i++) {
      if (sub & (1 << i)) group.push(people[i])
    }
    groups.push(group)
    mask ^= sub
  }
  return groups
}

/** 그룹 내에서 큰 금액부터 매칭 (0합 그룹이면 정확히 인원-1 회 이하) */
function greedyTransfers(group: Person[]): Transfer[] {
  const creditors = group
    .filter((p) => p.net > 0)
    .map((p) => ({ ...p }))
    .sort((a, b) => b.net - a.net)
  const debtors = group
    .filter((p) => p.net < 0)
    .map((p) => ({ id: p.id, net: -p.net }))
    .sort((a, b) => b.net - a.net)

  const transfers: Transfer[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]
    const d = debtors[di]
    const amount = Math.min(c.net, d.net)
    if (amount > 0) {
      transfers.push({ fromId: d.id, toId: c.id, amount })
    }
    c.net -= amount
    d.net -= amount
    if (c.net === 0) ci++
    if (d.net === 0) di++
  }
  return transfers
}

/**
 * 허브(총무) 송금 모드: 모든 채무자가 허브에게 보내고, 허브가 채권자에게 지급한다.
 */
export function hubTransfers(
  net: Record<string, number>,
  hubId: string,
): Transfer[] {
  const transfers: Transfer[] = []
  for (const [id, n] of Object.entries(net)) {
    if (id === hubId || n >= 0) continue
    transfers.push({ fromId: id, toId: hubId, amount: -n })
  }
  for (const [id, n] of Object.entries(net)) {
    if (id === hubId || n <= 0) continue
    transfers.push({ fromId: hubId, toId: id, amount: n })
  }
  return transfers
}

export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}


