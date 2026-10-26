type User = { id: string; email: string; user_metadata: Record<string, unknown> }
type Result<T = any> = { data: T; error: Error | null }
type Filter = { column: string; op: string; value: unknown }

const columns: Record<string, Set<string>> = {
  groups: new Set(['id','owner_id','name','treasurer_name','treasurer_account','created_at']),
  meetings: new Set(['id','owner_id','group_id','title','treasurer_name','treasurer_account','created_at']),
  members: new Set(['id','owner_id','group_id','name','is_treasurer','created_at']),
  meeting_members: new Set(['id','owner_id','meeting_id','member_id','created_at']),
  expenses: new Set(['id','meeting_id','title','payer_id','amount','sort_order','created_at']),
  expense_shares: new Set(['id','expense_id','member_id','amount']),
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || '요청을 처리하지 못했습니다.')
  return body as T
}

class Query {
  private op = 'select'
  private selected = '*'
  private values: Record<string, unknown> = {}
  private filters: Filter[] = []
  private sorts: { column: string; ascending: boolean }[] = []
  private maxRows?: number
  private returnRows = false
  private table: string
  constructor(table: string) { this.table = table }
  select(value = '*') { this.selected = value; this.returnRows = true; return this }
  insert(value: Record<string, unknown> | Record<string, unknown>[]) { this.op = 'insert'; this.values = Array.isArray(value) ? { __rows: value } : value; return this }
  update(value: Record<string, unknown>) { this.op = 'update'; this.values = value; return this }
  delete() { this.op = 'delete'; return this }
  eq(column: string, value: unknown) { this.filters.push({ column, op: 'eq', value }); return this }
  is(column: string, value: unknown) { this.filters.push({ column, op: 'is', value }); return this }
  in(column: string, value: unknown[]) { this.filters.push({ column, op: 'in', value }); return this }
  order(column: string, options?: { ascending?: boolean }) { this.sorts.push({ column, ascending: options?.ascending ?? true }); return this }
  limit(value: number) { this.maxRows = value; return this }
  async single() { const result = await this.execute(); return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error } }
  async maybeSingle() { return this.single() }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled, onrejected)
  }
  private async execute(): Promise<Result<unknown>> {
    try {
      const data = await request<unknown>('/api/data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ table: this.table, op: this.op, selected: this.selected, values: this.values, filters: this.filters, sorts: this.sorts, limit: this.maxRows, returning: this.returnRows }) })
      return { data, error: null }
    } catch (error) { return { data: null, error: error as Error } }
  }
}

export const db = {
  from(table: string) { if (!columns[table]) throw new Error('지원하지 않는 데이터입니다.'); return new Query(table) },
  auth: {
    async getUser() { try { const user = await request<User>('/api/auth/me'); return { data: { user }, error: null } } catch (error) { return { data: { user: null }, error: error as Error } } },
    async getSession() { try { const user = await request<User>('/api/auth/me'); return { data: { session: { user } }, error: null } } catch { return { data: { session: null }, error: null } } },
    onAuthStateChange(callback: (_event: string, session: { user: User } | null) => void) {
      const handler = () => { void this.getSession().then(({ data }) => callback('SIGNED_IN', data.session)) }
      window.addEventListener('nbbang-auth', handler)
      return { data: { subscription: { unsubscribe: () => window.removeEventListener('nbbang-auth', handler) } } }
    },
    async signOut() { await request('/api/auth/logout', { method: 'POST' }); window.dispatchEvent(new Event('nbbang-auth')) },
    async updateUser({ data }: { data: Record<string, unknown> }) { await request('/api/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ display_name: data.display_name, bank_account: data.bank_account }) }); return { error: null } },
  },
}

export type LocalUser = User
export { columns }


