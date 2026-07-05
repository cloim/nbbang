import { supabase } from './supabase'
import type { Expense, Meeting, Member } from '../types'

export interface ExpensePayload {
  title: string
  payerId: string
  amount: number
  shares: { memberId: string; amount: number | null }[]
}

export async function listMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createMeeting(title: string): Promise<Meeting> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw userError ?? new Error('로그인이 필요합니다')
  const { data, error } = await supabase
    .from('meetings')
    .insert({ title, owner_id: userData.user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) throw error
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listMembers(meetingId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function addMember(meetingId: string, name: string): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .insert({ meeting_id: meetingId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameMember(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('members').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('id', id)
  if (error) throw error
}

export async function setTreasurer(
  meetingId: string,
  memberId: string | null,
): Promise<void> {
  const { error: clearError } = await supabase
    .from('members')
    .update({ is_treasurer: false })
    .eq('meeting_id', meetingId)
  if (clearError) throw clearError
  if (memberId) {
    const { error } = await supabase
      .from('members')
      .update({ is_treasurer: true })
      .eq('id', memberId)
    if (error) throw error
  }
}

export async function listExpenses(meetingId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_shares(*)')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createExpense(
  meetingId: string,
  payload: ExpensePayload,
): Promise<void> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      meeting_id: meetingId,
      title: payload.title,
      payer_id: payload.payerId,
      amount: payload.amount,
    })
    .select()
    .single()
  if (error) throw error
  await insertShares(data.id, payload.shares)
}

export async function updateExpense(
  expenseId: string,
  payload: ExpensePayload,
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      title: payload.title,
      payer_id: payload.payerId,
      amount: payload.amount,
    })
    .eq('id', expenseId)
  if (error) throw error
  const { error: deleteError } = await supabase
    .from('expense_shares')
    .delete()
    .eq('expense_id', expenseId)
  if (deleteError) throw deleteError
  await insertShares(expenseId, payload.shares)
}

async function insertShares(
  expenseId: string,
  shares: { memberId: string; amount: number | null }[],
): Promise<void> {
  const rows = shares.map((s) => ({
    expense_id: expenseId,
    member_id: s.memberId,
    amount: s.amount,
  }))
  const { error } = await supabase.from('expense_shares').insert(rows)
  if (error) throw error
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}
