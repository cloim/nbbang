export interface SocialGroup {
  id: string
  owner_id: string
  name: string
  treasurer_name: string
  treasurer_account: string
  created_at: string
}

export interface Meeting {
  id: string
  owner_id: string
  group_id: string | null
  title: string
  treasurer_name: string
  treasurer_account: string
  created_at: string
}

export interface Member {
  id: string
  owner_id: string
  group_id: string | null
  name: string
  is_treasurer: boolean
  created_at: string
}

/** 만남 안에서 멤버를 묶는 정산 그룹 */
export interface Group {
  id: string
  name: string
  memberIds: string[]
  representativeId: string
}

export interface ExpenseShare {
  expense_id: string
  member_id: string
  amount: number | null
}

export interface Expense {
  id: string
  meeting_id: string
  title: string
  payer_id: string
  amount: number
  sort_order: number
  created_at: string
  expense_shares: ExpenseShare[]
}


