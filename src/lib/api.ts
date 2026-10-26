import { db } from './db'
import type { Expense, Meeting, Member, SocialGroup } from '../types'

export interface ExpensePayload {
  title: string
  payerId: string
  amount: number
  shares: { memberId: string; amount: number | null }[]
}

async function userId(): Promise<string> {
  const { data, error } = await db.auth.getUser()
  if (error || !data.user) throw error ?? new Error('로그인이 필요합니다.')
  return data.user.id
}

export async function listGroups(): Promise<SocialGroup[]> {
  const { data, error } = await db
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createGroup(
  name: string,
): Promise<SocialGroup> {
  const { data, error } = await db
    .from('groups')
    .insert({
      owner_id: await userId(),
      name,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateGroup(
  id: string,
  name: string,
  treasurerName: string,
  treasurerAccount: string,
): Promise<void> {
  const { error } = await db
    .from('groups')
    .update({ name, treasurer_name: treasurerName, treasurer_account: treasurerAccount })
    .eq('id', id)
  if (error) throw error
}

export async function deleteGroup(id: string): Promise<void> {
  const response = await fetch(`/api/groups/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
  if (response.ok) return
  const result = await response.json().catch(() => ({})) as { error?: string }
  throw new Error(result.error || '모임을 삭제하지 못했습니다.')
}

export async function listMeetings(groupId: string | null): Promise<Meeting[]> {
  let query = db.from('meetings').select('*')
  query = groupId ? query.eq('group_id', groupId) : query.is('group_id', null)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listRecentMeetings(limit = 4): Promise<Meeting[]> {
  const { data, error } = await db
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function createMeeting(
  title: string,
  groupId: string | null,
  treasurerName = '',
  treasurerAccount = '',
): Promise<Meeting> {
  const { data, error } = await db
    .from('meetings')
    .insert({
      title,
      group_id: groupId,
      treasurer_name: treasurerName,
      treasurer_account: treasurerAccount,
      owner_id: await userId(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await db.from('meetings').delete().eq('id', id)
  if (error) throw error
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data, error } = await db
    .from('meetings')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateMeetingTitle(id: string, title: string): Promise<void> {
  const { error } = await db.from('meetings').update({ title }).eq('id', id)
  if (error) throw error
}

export async function listMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await db
    .from('members')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function listMeetingMembers(meetingId: string): Promise<Member[]> {
  const { data, error } = await db
    .from('meeting_members')
    .select('member_id')
    .eq('meeting_id', meetingId)
  if (error) throw error
  const ids = data.map((row: { member_id: string }) => row.member_id)
  if (!ids.length) return []
  const result = await db.from('members').select('*').in('id', ids)
  if (result.error) throw result.error
  return result.data
}

export async function addMember(groupId: string, name: string): Promise<Member> {
  const { data, error } = await db
    .from('members')
    .insert({ owner_id: await userId(), group_id: groupId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addStandaloneMember(meetingId: string, name: string): Promise<Member> {
  const { data, error } = await db
    .from('members')
    .insert({ owner_id: await userId(), group_id: null, name })
    .select()
    .single()
  if (error) throw error
  await addMeetingMember(meetingId, data.id)
  return data
}

export async function addMeetingMember(meetingId: string, memberId: string): Promise<void> {
  const { error } = await db
    .from('meeting_members')
    .insert({ owner_id: await userId(), meeting_id: meetingId, member_id: memberId })
  if (error) throw error
}

export async function removeMeetingMember(meetingId: string, memberId: string): Promise<void> {
  const { error } = await db
    .from('meeting_members')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('member_id', memberId)
  if (error) throw error
  const member = await db.from('members').select('group_id').eq('id', memberId).maybeSingle()
  if (member.error) throw member.error
  if (member.data?.group_id == null) {
    const { error: deleteError } = await db.from('members').delete().eq('id', memberId)
    if (deleteError) throw deleteError
  }
}

export async function renameMember(id: string, name: string): Promise<void> {
  const { error } = await db.from('members').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await db.from('members').delete().eq('id', id)
  if (error) throw error
}

export async function setTreasurer(groupId: string, memberId: string | null): Promise<void> {
  const { error: clearError } = await db
    .from('members')
    .update({ is_treasurer: false })
    .eq('group_id', groupId)
  if (clearError) throw clearError
  if (memberId) {
    const { error } = await db
      .from('members')
      .update({ is_treasurer: true })
      .eq('id', memberId)
    if (error) throw error
  }
}

export async function setMeetingTreasurer(meetingId: string, memberId: string | null): Promise<void> {
  const participants = await listMeetingMembers(meetingId)
  const ids = participants.map((member) => member.id)
  if (!ids.length) return
  const { error: clearError } = await db
    .from('members')
    .update({ is_treasurer: false })
    .in('id', ids)
  if (clearError) throw clearError
  if (memberId) {
    const { error } = await db
      .from('members')
      .update({ is_treasurer: true })
      .eq('id', memberId)
    if (error) throw error
  }
}

export async function listExpenses(meetingId: string): Promise<Expense[]> {
  const { data, error } = await db
    .from('expenses')
    .select('*, expense_shares(*)')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createExpense(meetingId: string, payload: ExpensePayload): Promise<void> {
  const { data: last } = await db
    .from('expenses')
    .select('sort_order')
    .eq('meeting_id', meetingId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await db
    .from('expenses')
    .insert({
      meeting_id: meetingId,
      title: payload.title,
      payer_id: payload.payerId,
      amount: payload.amount,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select()
    .single()
  if (error) throw error
  await insertShares(data.id, payload.shares)
}

export async function updateExpense(expenseId: string, payload: ExpensePayload): Promise<void> {
  const { error } = await db
    .from('expenses')
    .update({ title: payload.title, payer_id: payload.payerId, amount: payload.amount })
    .eq('id', expenseId)
  if (error) throw error
  const { error: deleteError } = await db
    .from('expense_shares')
    .delete()
    .eq('expense_id', expenseId)
  if (deleteError) throw deleteError
  await insertShares(expenseId, payload.shares)
}

export async function reorderExpenses(expenses: Expense[]): Promise<void> {
  const results = await Promise.all(
    expenses.map((expense, index) =>
      db.from('expenses').update({ sort_order: index }).eq('id', expense.id),
    ),
  )
  const failure = results.find((result) => result.error)?.error
  if (failure) throw failure
}

async function insertShares(
  expenseId: string,
  shares: { memberId: string; amount: number | null }[],
): Promise<void> {
  const { error } = await db.from('expense_shares').insert(
    shares.map((share) => ({ expense_id: expenseId, member_id: share.memberId, amount: share.amount })),
  )
  if (error) throw error
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await db.from('expenses').delete().eq('id', id)
  if (error) throw error
}


