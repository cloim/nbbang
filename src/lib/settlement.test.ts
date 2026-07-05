import { describe, expect, it } from 'vitest'
import {
  computeSettlement,
  hubTransfers,
  simplifyDebts,
  splitExpense,
  type ExpenseInput,
  type Transfer,
} from './settlement'

function applyTransfers(net: Record<string, number>, transfers: Transfer[]) {
  const result = { ...net }
  for (const t of transfers) {
    result[t.fromId] += t.amount
    result[t.toId] -= t.amount
  }
  return result
}

function expectSettled(net: Record<string, number>, transfers: Transfer[]) {
  const after = applyTransfers(net, transfers)
  for (const [id, n] of Object.entries(after)) {
    expect(n, `member ${id} not settled`).toBe(0)
  }
}

const equalShares = (ids: string[]) => ids.map((id) => ({ memberId: id, amount: null }))

describe('splitExpense', () => {
  it('나누어떨어지는 균등 분배', () => {
    const result = splitExpense({
      id: 'e1',
      title: '식당',
      payerId: 'a',
      amount: 30000,
      shares: equalShares(['a', 'b', 'c']),
    })
    expect(result.shares.map((s) => s.amount)).toEqual([10000, 10000, 10000])
    expect(result.absorbedRemainder).toBe(0)
    expect(result.warning).toBeUndefined()
  })

  it('라운딩 나머지는 총무가 흡수하고 총합이 보존된다', () => {
    const result = splitExpense(
      {
        id: 'e1',
        title: '카페',
        payerId: 'a',
        amount: 10000,
        shares: equalShares(['a', 'b', 'c']),
      },
      ['b'],
    )
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.amount]))
    expect(byId).toEqual({ a: 3333, b: 3334, c: 3333 })
    expect(result.absorbedRemainder).toBe(1)
    const total = result.shares.reduce((s, x) => s + x.amount, 0)
    expect(total).toBe(10000)
  })

  it('총무가 미참석이면 지출인이 흡수한다', () => {
    const result = splitExpense(
      {
        id: 'e1',
        title: '카페',
        payerId: 'c',
        amount: 10001,
        shares: equalShares(['b', 'c']),
      },
      ['treasurer-not-here', 'c'],
    )
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.amount]))
    expect(byId).toEqual({ b: 5000, c: 5001 })
  })

  it('고정 분담액(개인분 별도)과 균등 분배 혼합', () => {
    const result = splitExpense({
      id: 'e1',
      title: '술집',
      payerId: 'a',
      amount: 50000,
      shares: [
        { memberId: 'a', amount: 14000 },
        { memberId: 'b', amount: null },
        { memberId: 'c', amount: null },
      ],
    })
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.amount]))
    expect(byId).toEqual({ a: 14000, b: 18000, c: 18000 })
  })

  it('전원 고정 분담인데 합계가 총액과 다르면 경고', () => {
    const result = splitExpense({
      id: 'e1',
      title: '노래방',
      payerId: 'a',
      amount: 50000,
      shares: [
        { memberId: 'a', amount: 20000 },
        { memberId: 'b', amount: 20000 },
      ],
    })
    expect(result.warning).toBeTruthy()
    expect(result.shares.reduce((s, x) => s + x.amount, 0)).toBe(40000)
  })

  it('고정 분담 합계가 총액을 초과하면 균등 대상은 0원 + 경고', () => {
    const result = splitExpense({
      id: 'e1',
      title: '택시',
      payerId: 'a',
      amount: 10000,
      shares: [
        { memberId: 'a', amount: 15000 },
        { memberId: 'b', amount: null },
      ],
    })
    expect(result.warning).toBeTruthy()
    const byId = Object.fromEntries(result.shares.map((s) => [s.memberId, s.amount]))
    expect(byId.b).toBe(0)
  })
})

describe('computeSettlement', () => {
  it('지출처별 참석자/지출인이 달라도 정확히 정산된다', () => {
    const members = ['a', 'b', 'c', 'd']
    const expenses: ExpenseInput[] = [
      {
        id: 'e1',
        title: '1차 식당',
        payerId: 'a',
        amount: 40000,
        shares: equalShares(['a', 'b', 'c', 'd']),
      },
      {
        id: 'e2',
        title: '2차 술집',
        payerId: 'b',
        amount: 30000,
        shares: equalShares(['a', 'b', 'c']),
      },
      {
        id: 'e3',
        title: '택시',
        payerId: 'c',
        amount: 8000,
        shares: equalShares(['c', 'd']),
      },
    ]
    const s = computeSettlement(members, expenses)

    expect(s.owed).toEqual({ a: 20000, b: 20000, c: 24000, d: 14000 })
    expect(s.paid).toEqual({ a: 40000, b: 30000, c: 8000, d: 0 })
    expect(s.net).toEqual({ a: 20000, b: 10000, c: -16000, d: -14000 })

    const netSum = Object.values(s.net).reduce((x, y) => x + y, 0)
    expect(netSum).toBe(0)
    expectSettled(s.net, s.transfers)
    expect(s.warnings).toEqual([])
  })

  it('라운딩이 있어도 net 총합은 항상 0', () => {
    const members = ['a', 'b', 'c', 'd', 'e']
    const expenses: ExpenseInput[] = [
      { id: 'e1', title: 'x', payerId: 'a', amount: 10007, shares: equalShares(['a', 'b', 'c']) },
      { id: 'e2', title: 'y', payerId: 'b', amount: 33334, shares: equalShares(['b', 'c', 'd', 'e']) },
      { id: 'e3', title: 'z', payerId: 'e', amount: 999, shares: equalShares(['a', 'e']) },
    ]
    const s = computeSettlement(members, expenses, 'c')
    const netSum = Object.values(s.net).reduce((x, y) => x + y, 0)
    expect(netSum).toBe(0)
    expectSettled(s.net, s.transfers)
  })

  it('지출이 없으면 송금도 없다', () => {
    const s = computeSettlement(['a', 'b'], [])
    expect(s.transfers).toEqual([])
    expect(s.net).toEqual({ a: 0, b: 0 })
  })
})

describe('simplifyDebts', () => {
  it('단순 케이스: 1회 송금', () => {
    const transfers = simplifyDebts({ a: 5000, b: -5000 })
    expect(transfers).toEqual([{ fromId: 'b', toId: 'a', amount: 5000 }])
  })

  it('greedy가 놓치는 0합 그룹을 DP가 찾아 최소 횟수를 보장한다', () => {
    // {b:+3, c:-3}, {a:+4, d:-2, e:-2} 로 분할하면 3회.
    // 큰 금액 우선 greedy는 (a,+4)-(b... 매칭이 어긋나 4회가 된다.
    const net = { a: 4000, b: 3000, c: -3000, d: -2000, e: -2000 }
    const transfers = simplifyDebts(net)
    expect(transfers.length).toBe(3)
    expectSettled(net, transfers)
  })

  it('n-1회가 최선인 경우 n-1회를 반환한다', () => {
    const net = { a: 5000, b: 4000, c: -3000, d: -3000, e: -3000 }
    const transfers = simplifyDebts(net)
    expect(transfers.length).toBe(4)
    expectSettled(net, transfers)
  })

  it('net이 0인 사람은 송금에 등장하지 않는다', () => {
    const net = { a: 1000, b: -1000, c: 0 }
    const transfers = simplifyDebts(net)
    for (const t of transfers) {
      expect(t.fromId).not.toBe('c')
      expect(t.toId).not.toBe('c')
    }
  })

  it('15명 이상도 정확히 정산된다 (greedy fallback)', () => {
    const net: Record<string, number> = {}
    let sum = 0
    for (let i = 0; i < 17; i++) {
      const v = (i + 1) * 111 * (i % 2 === 0 ? 1 : -1)
      net[`m${i}`] = v
      sum += v
    }
    net.balancer = -sum
    const transfers = simplifyDebts(net)
    expectSettled(net, transfers)
  })
})

describe('hubTransfers', () => {
  it('모든 채무자는 허브에게, 허브는 채권자에게 보낸다', () => {
    const net = { hub: 1000, a: 5000, b: -4000, c: -2000 }
    const transfers = hubTransfers(net, 'hub')
    expect(transfers).toEqual([
      { fromId: 'b', toId: 'hub', amount: 4000 },
      { fromId: 'c', toId: 'hub', amount: 2000 },
      { fromId: 'hub', toId: 'a', amount: 5000 },
    ])
    expectSettled(net, transfers)
  })

  it('허브가 채무자여도 정산이 맞는다', () => {
    const net = { hub: -3000, a: 3000 }
    const transfers = hubTransfers(net, 'hub')
    expectSettled(net, transfers)
  })
})
