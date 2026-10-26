import { describe, expect, it } from 'vitest'
import { cleanGroups, groupNet } from './groups'
import type { Group, Member } from '../types'

describe('cleanGroups', () => {
  const members: Member[] = [
    { id: 'm1', owner_id: 'u1', group_id: 'g1', name: '철수', is_treasurer: true, created_at: '' },
    { id: 'm2', owner_id: 'u1', group_id: 'g1', name: '영희', is_treasurer: false, created_at: '' },
    { id: 'm3', owner_id: 'u1', group_id: 'g1', name: '민수', is_treasurer: false, created_at: '' },
    { id: 'm4', owner_id: 'u1', group_id: 'g1', name: '수진', is_treasurer: false, created_at: '' },
  ]

  it('유효한 그룹 데이터를 보존한다', () => {
    const raw: Group[] = [
      { id: 'g1', name: '가족', memberIds: ['m1', 'm2'], representativeId: 'm1' },
    ]
    const cleaned = cleanGroups(raw, members)
    expect(cleaned).toEqual([
      { id: 'g1', name: '가족', memberIds: ['m1', 'm2'], representativeId: 'm1' },
    ])
  })

  it('존재하지 않는 멤버를 제거하고 대표가 없으면 첫 멤버로 지정한다', () => {
    const raw = [
      { id: 'g1', name: '가족', memberIds: ['m99', 'm2'], representativeId: 'm99' },
    ]
    const cleaned = cleanGroups(raw, members)
    expect(cleaned).toEqual([
      { id: 'g1', name: '가족', memberIds: ['m2'], representativeId: 'm2' },
    ])
  })

  it('유효한 멤버가 하나도 없는 그룹은 제외한다', () => {
    const raw = [
      { id: 'g1', name: '유령그룹', memberIds: ['m88', 'm99'], representativeId: 'm88' },
    ]
    const cleaned = cleanGroups(raw, members)
    expect(cleaned).toEqual([])
  })

  it('중복 배정된 멤버는 첫 번째 그룹에만 배정한다', () => {
    const raw = [
      { id: 'g1', name: '그룹1', memberIds: ['m1', 'm2'], representativeId: 'm1' },
      { id: 'g2', name: '그룹2', memberIds: ['m2', 'm3'], representativeId: 'm2' },
    ]
    const cleaned = cleanGroups(raw, members)
    expect(cleaned).toEqual([
      { id: 'g1', name: '그룹1', memberIds: ['m1', 'm2'], representativeId: 'm1' },
      { id: 'g2', name: '그룹2', memberIds: ['m3'], representativeId: 'm3' },
    ])
  })
})

describe('groupNet', () => {
  it('그룹 대표에게 그룹원들의 net 정산 금액을 합산하고 그룹원은 0으로 만든다', () => {
    const net = {
      m1: 10000,
      m2: -3000,
      m3: -4000,
      m4: -3000,
    }
    const groups: Group[] = [
      { id: 'g1', name: '가족', memberIds: ['m1', 'm2'], representativeId: 'm1' },
    ]
    const result = groupNet(net, groups)
    expect(result).toEqual({
      m1: 7000, // 10000 + (-3000)
      m2: 0,
      m3: -4000,
      m4: -3000,
    })
  })

  it('그룹이 적용된 net을 송금 경로 계산 알고리즘에 전달하면 완전히 정산된다', () => {
    const net = {
      m1: 15000,
      m2: -5000,
      m3: -4000,
      m4: -6000,
    }
    const groups: Group[] = [
      { id: 'g1', name: '부부', memberIds: ['m1', 'm2'], representativeId: 'm1' },
      { id: 'g2', name: '친구', memberIds: ['m3', 'm4'], representativeId: 'm3' },
    ]
    const effective = groupNet(net, groups)
    expect(effective.m1).toBe(10000) // 15000 + (-5000)
    expect(effective.m2).toBe(0)
    expect(effective.m3).toBe(-10000) // -4000 + (-6000)
    expect(effective.m4).toBe(0)
  })
})


