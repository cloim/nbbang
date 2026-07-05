export interface Meeting {
  id: string
  owner_id: string
  title: string
  created_at: string
}

export interface Member {
  id: string
  meeting_id: string
  name: string
  is_treasurer: boolean
  created_at: string
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
  created_at: string
  expense_shares: ExpenseShare[]
}
