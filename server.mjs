import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
process.env.NODE_ENV ||= 'production'
import express from 'express'
import pg from 'pg'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OAuth2Client } from 'google-auth-library'

const { Pool } = pg
const app = express()
const port = Number(process.env.PORT || 47420)
const databaseUrl = process.env.DATABASE_URL || (() => {
  const user = encodeURIComponent(process.env.POSTGRES_USER || 'nbbang')
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || '')
  const database = encodeURIComponent(process.env.POSTGRES_DB || 'nbbang')
  const port = Number(process.env.POSTGRES_PORT || 47430)
  return password ? `postgres://${user}:${password}@127.0.0.1:${port}/${database}` : undefined
})()
const pool = new Pool({ connectionString: databaseUrl })
const google = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const tables = {
  groups: ['id','owner_id','name','treasurer_name','treasurer_account','created_at'],
  meetings: ['id','owner_id','group_id','title','treasurer_name','treasurer_account','created_at'],
  members: ['id','owner_id','group_id','name','is_treasurer','created_at'],
  meeting_members: ['id','owner_id','meeting_id','member_id','created_at'],
  expenses: ['id','meeting_id','title','payer_id','amount','sort_order','created_at'],
  expense_shares: ['id','expense_id','member_id','amount'],
}
const ownerTables = new Set(['groups','meetings','members','meeting_members'])
const cookieName = 'nbbang_session'
app.use(express.json({ limit: '1mb' }))
app.use((req, _res, next) => {
  const cookie = req.headers.cookie?.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${cookieName}=`))
  req.sessionToken = cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : ''
  return next()
})

async function auth(req, res, next) {
  if (!req.sessionToken) return res.status(401).json({ error: '로그인이 필요합니다.' })
  const hash = crypto.createHash('sha256').update(req.sessionToken).digest('hex')
  const result = await pool.query('SELECT u.id, u.email, u.display_name, u.bank_account, u.avatar_url FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [hash])
  if (!result.rowCount) return res.status(401).json({ error: '로그인이 만료되었습니다.' })
  req.user = result.rows[0]
  return await next()
}
const guarded = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next)

app.get('/api/config', (_req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' }))
app.get('/api/auth/me', guarded(async (req, res) => { await auth(req, res, () => res.json({ id: req.user.id, email: req.user.email, user_metadata: { display_name: req.user.display_name, bank_account: req.user.bank_account, avatar_url: req.user.avatar_url } })) }))
app.post('/api/auth/google', guarded(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: '서버에 GOOGLE_CLIENT_ID를 설정해야 Google 로그인을 사용할 수 있습니다.' })
  const ticket = await google.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email || !payload.email_verified) return res.status(401).json({ error: 'Google 계정을 확인하지 못했습니다.' })
  const upsert = await pool.query(`INSERT INTO users(google_sub,email,display_name,avatar_url) VALUES($1,$2,$3,$4)
    ON CONFLICT(email) DO UPDATE SET google_sub=COALESCE(users.google_sub,EXCLUDED.google_sub), avatar_url=EXCLUDED.avatar_url
    RETURNING id`, [payload.sub, payload.email, payload.name || '', payload.picture || ''])
  const token = crypto.randomBytes(32).toString('base64url')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'30 days\')', [hash, upsert.rows[0].id])
  res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 86400000, path: '/' }).json({ ok: true })
}))
app.post('/api/auth/logout', guarded(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.sessionToken).digest('hex')
  await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hash])
  res.clearCookie(cookieName, { path: '/' }).json({ ok: true })
}))
app.put('/api/profile', guarded(async (req, res) => {
  await auth(req, res, async () => {
    const result = await pool.query('UPDATE users SET display_name=$2,bank_account=$3 WHERE id=$1 RETURNING id,email,display_name,bank_account,avatar_url', [req.user.id, String(req.body.display_name || '').trim(), String(req.body.bank_account || '').trim()])
    res.json({ id: result.rows[0].id, email: result.rows[0].email, user_metadata: { display_name: result.rows[0].display_name, bank_account: result.rows[0].bank_account, avatar_url: result.rows[0].avatar_url } })
  })
}))
app.delete('/api/groups/:id', guarded(async (req, res) => {
  await auth(req, res, async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const group = await client.query('SELECT id FROM groups WHERE id=$1 AND owner_id=$2 FOR UPDATE', [req.params.id, req.user.id])
      if (!group.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: '모임을 찾을 수 없습니다.' })
      }
      await client.query('DELETE FROM meetings WHERE group_id=$1 AND owner_id=$2', [req.params.id, req.user.id])
      await client.query('DELETE FROM groups WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id])
      await client.query('COMMIT')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}))
app.get('/api/settlement-groups/:meetingId', guarded(async (req, res) => {
  await auth(req, res, () => {})
  const result = await pool.query('SELECT sg.groups FROM settlement_groups sg JOIN meetings m ON m.id=sg.meeting_id WHERE sg.meeting_id=$1 AND m.owner_id=$2', [req.params.meetingId, req.user.id])
  res.json(result.rows[0]?.groups || [])
}))
app.put('/api/settlement-groups/:meetingId', guarded(async (req, res) => {
  await auth(req, res, () => {})
  await pool.query(`INSERT INTO settlement_groups(meeting_id,groups) SELECT id,$3::jsonb FROM meetings WHERE id=$1 AND owner_id=$2
    ON CONFLICT(meeting_id) DO UPDATE SET groups=EXCLUDED.groups`, [req.params.meetingId, req.user.id, JSON.stringify(req.body.groups || [])])
  res.json({ ok: true })
}))
app.post('/api/data', guarded(async (req, res) => {
  await auth(req, res, async () => {
    const { table, op, values = {}, filters = [], sorts = [], limit, returning } = req.body
    const allowed = tables[table]
    if (!allowed || !['select','insert','update','delete'].includes(op)) return res.status(400).json({ error: '잘못된 데이터 요청입니다.' })
    const validColumn = (column) => allowed.includes(column)
    const where = []; const params = []
    const add = (value) => { params.push(value); return `$${params.length}` }
    if (ownerTables.has(table)) where.push(`owner_id=${add(req.user.id)}`)
    else if (table === 'expenses') where.push(`meeting_id IN (SELECT id FROM meetings WHERE owner_id=${add(req.user.id)})`)
    else if (table === 'expense_shares') where.push(`expense_id IN (SELECT e.id FROM expenses e JOIN meetings m ON m.id=e.meeting_id WHERE m.owner_id=${add(req.user.id)})`)
    for (const f of filters) {
      if (!validColumn(f.column) || !['eq','is','in'].includes(f.op)) return res.status(400).json({ error: '지원하지 않는 조건입니다.' })
      if (f.op === 'eq') where.push(`${f.column}=${add(f.value)}`)
      if (f.op === 'is') where.push(f.value === null ? `${f.column} IS NULL` : `${f.column} IS NOT NULL`)
      if (f.op === 'in') where.push(`${f.column}=ANY(${add(f.value)}::uuid[])`)
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
    let result
    if (op === 'insert') {
      const rows = values.__rows || [values]
      const inserted = []
      for (const row of rows) {
        const record = { ...row }
        if (ownerTables.has(table)) record.owner_id = req.user.id
        const keys = Object.keys(record).filter((key) => validColumn(key))
        if (keys.length !== Object.keys(record).length) throw new Error('지원하지 않는 필드입니다.')
        if (table === 'meetings' && record.group_id && !(await pool.query('SELECT 1 FROM groups WHERE id=$1 AND owner_id=$2', [record.group_id, req.user.id])).rowCount) return res.status(403).json({ error: '접근 권한이 없는 모임입니다.' })
        if (table === 'members' && record.group_id && !(await pool.query('SELECT 1 FROM groups WHERE id=$1 AND owner_id=$2', [record.group_id, req.user.id])).rowCount) return res.status(403).json({ error: '접근 권한이 없는 모임입니다.' })
        if (table === 'meeting_members') {
          const valid = await pool.query(`SELECT 1 FROM meetings m JOIN members mb ON mb.id=$2 AND mb.owner_id=$3 WHERE m.id=$1 AND m.owner_id=$3`, [record.meeting_id, record.member_id, req.user.id])
          if (!valid.rowCount) return res.status(403).json({ error: '참석자를 추가할 권한이 없습니다.' })
        }
        if (table === 'expenses') {
          const valid = await pool.query(`SELECT 1 FROM meetings m JOIN members mb ON mb.id=$2 AND mb.owner_id=$3 WHERE m.id=$1 AND m.owner_id=$3`, [record.meeting_id, record.payer_id, req.user.id])
          if (!valid.rowCount) return res.status(403).json({ error: '지출을 추가할 권한이 없습니다.' })
        }
        if (table === 'expense_shares') {
          const valid = await pool.query(`SELECT 1 FROM expenses e JOIN meetings m ON m.id=e.meeting_id AND m.owner_id=$3
            JOIN members mb ON mb.id=$2 AND mb.owner_id=$3 WHERE e.id=$1`, [record.expense_id, record.member_id, req.user.id])
          if (!valid.rowCount) return res.status(403).json({ error: '분담 내역을 추가할 권한이 없습니다.' })
        }
        const vals = keys.map((key) => record[key]); const placeholders = vals.map((_, index) => `$${index + 1}`)
        const sql = `INSERT INTO ${table}(${keys.join(',')}) VALUES(${placeholders.join(',')}) RETURNING *`
        inserted.push(...(await pool.query(sql, vals)).rows)
      }
      result = inserted
    } else if (op === 'select') {
      const sortSql = sorts.filter((s) => validColumn(s.column)).map((s) => `${s.column} ${s.ascending ? 'ASC' : 'DESC'}`).join(',')
      const limitSql = Number.isInteger(limit) ? ` LIMIT ${Math.max(0, Math.min(500, limit))}` : ''
      result = (await pool.query(`SELECT * FROM ${table}${whereSql}${sortSql ? ` ORDER BY ${sortSql}` : ''}${limitSql}`, params)).rows
      if (table === 'expenses' && String(req.body.selected || '').includes('expense_shares')) {
        for (const row of result) row.expense_shares = (await pool.query('SELECT expense_id,member_id,amount FROM expense_shares WHERE expense_id=$1 ORDER BY member_id', [row.id])).rows
      }
    } else if (op === 'update') {
      const keys = Object.keys(values)
      if (!keys.length || keys.some((key) => !validColumn(key) || key === 'owner_id')) throw new Error('지원하지 않는 필드입니다.')
      const assignments = keys.map((key) => `${key}=${add(values[key])}`).join(',')
      result = (await pool.query(`UPDATE ${table} SET ${assignments}${whereSql} RETURNING *`, params)).rows
    } else result = (await pool.query(`DELETE FROM ${table}${whereSql} RETURNING *`, params)).rows
    res.json(returning || op === 'select' ? result : null)
  })
}))

app.get('/api/health', guarded(async (_req, res) => { await pool.query('SELECT 1'); res.json({ ok: true }) }))
const root = path.dirname(fileURLToPath(import.meta.url))
app.use(express.static(path.join(root, 'dist')))
app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')))
// DB 오류 원문은 서버 로그에만 남기고, 사용자에게는 다시 시도할 수 있는 안내만 보낸다.
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: '일시적인 문제로 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' }) })

async function start() {
  for (let attempt = 0; ; attempt++) {
    try { await pool.query('SELECT 1'); break }
    catch (error) { if (attempt >= 29) throw error; await new Promise((resolve) => setTimeout(resolve, 2000)) }
  }
  app.listen(port, '0.0.0.0', () => console.log(`nBBang server listening on ${port}`))
}
start().catch((error) => { console.error('Database unavailable', error); process.exit(1) })
