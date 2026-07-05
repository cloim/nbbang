import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const SHOTS = process.env.SHOT_DIR ?? 'smoke-shots'
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error('E2E_EMAIL, E2E_PASSWORD 환경변수가 필요합니다')
  process.exit(1)
}
mkdirSync(SHOTS, { recursive: true })

const MEMBERS = ['민우', '서연', '준호']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('dialog', (d) => d.accept())

let failed = false
async function step(name, fn) {
  if (failed) return
  try {
    await fn()
    console.log(`OK   ${name}`)
  } catch (e) {
    failed = true
    console.error(`FAIL ${name}: ${e.message}`)
    await page.screenshot({ path: `${SHOTS}/FAIL-${name}.png`, fullPage: true })
  }
}

async function expectText(text) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 8000 })
}

async function addExpense(title, amount, payer, participants, custom = {}) {
  await page.getByRole('button', { name: '지출 추가' }).click()
  await page.getByPlaceholder('예: 1차 고깃집').fill(title)
  await page.getByPlaceholder('0', { exact: true }).fill(String(amount))
  const payerField = page.locator('.field', { hasText: '지출인' })
  await payerField.getByRole('button', { name: payer, exact: true }).click()
  const partField = page.locator('.field', { hasText: '참여 인원' })
  for (const name of MEMBERS) {
    if (!participants.includes(name)) {
      await partField.getByRole('button', { name, exact: true }).click()
    }
  }
  if (Object.keys(custom).length > 0) {
    await page.locator('.switch-row input').check()
    for (const [name, amt] of Object.entries(custom)) {
      await page
        .locator('.custom-amount-row', { hasText: name })
        .locator('input')
        .fill(String(amt))
    }
  }
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.locator('.sheet').waitFor({ state: 'detached', timeout: 8000 })
}

await step('01-login', async () => {
  await page.goto(BASE)
  await page.fill('input[type=email]', EMAIL)
  await page.fill('input[type=password]', PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.getByPlaceholder('새 모임 이름').waitFor({ timeout: 10000 })
  await page.screenshot({ path: `${SHOTS}/01-meetings.png` })
})

await step('02-create-meeting', async () => {
  await page.getByPlaceholder('새 모임 이름').fill('정산 테스트 모임')
  await page.getByRole('button', { name: '만들기' }).click()
  await expectText('멤버가 없어 지출을 기록할 수 없습니다')
})

await step('03-add-members', async () => {
  await page.getByRole('button', { name: '멤버 추가하러 가기' }).click()
  for (const name of MEMBERS) {
    await page.getByPlaceholder('멤버 이름').fill(name)
    await page.getByRole('button', { name: '추가', exact: true }).click()
    await page.locator('.member-card', { hasText: name }).waitFor()
  }
  await page.locator('.member-card', { hasText: '민우' }).locator('.star').click()
  await page.locator('.member-card', { hasText: '민우' }).getByText('총무').waitFor()
  await page.screenshot({ path: `${SHOTS}/02-members.png` })
})

await step('04-add-expenses', async () => {
  await page.getByRole('button', { name: /^지출/ }).first().click()
  await addExpense('1차 식당', 40000, '민우', MEMBERS)
  await addExpense('카페', 30000, '서연', ['민우', '서연'])
  await addExpense('택시', 10000, '준호', MEMBERS, { 준호: 4000 })
  await expectText('총 지출')
  await expectText('80,000원')
  await page.screenshot({ path: `${SHOTS}/03-expenses.png`, fullPage: true })
})

await step('05-settlement', async () => {
  await page.getByRole('button', { name: '정산', exact: true }).click()
  await expectText('사람별 정산')
  // 기대값: 민우 +8,666 / 서연 -1,333 / 준호 -7,333, 송금 2회
  await expectText('+8,666원 받음')
  await expectText('1,333원 보냄')
  await expectText('7,333원 보냄')
  await expectText('총 2회 송금')
  await page.getByRole('button', { name: /지출별 분담 내역/ }).click()
  await expectText('나머지 1원 흡수')
  await page.screenshot({ path: `${SHOTS}/04-settlement.png`, fullPage: true })
})

await step('06-hub-mode', async () => {
  await page.getByRole('button', { name: '총무에게 모으기' }).click()
  await expectText('총 2회 송금')
  await page.screenshot({ path: `${SHOTS}/05-settlement-hub.png` })
})

await step('07-edit-resettle', async () => {
  await page.getByRole('button', { name: /^지출/ }).first().click()
  await page.locator('.expense-card', { hasText: '카페' }).click()
  await page.getByPlaceholder('0', { exact: true }).fill('20000')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.locator('.sheet').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: '정산', exact: true }).click()
  // 재정산 기대값: 민우 +13,666 / 서연 -6,333 / 준호 -7,333
  await expectText('+13,666원 받음')
  await expectText('6,333원 보냄')
  await expectText('7,333원 보냄')
  await page.screenshot({ path: `${SHOTS}/06-resettled.png`, fullPage: true })
})

await step('08-delete-meeting', async () => {
  await page.getByRole('button', { name: '뒤로' }).click()
  await page.getByPlaceholder('새 모임 이름').waitFor()
  await page.getByRole('button', { name: '모임 삭제' }).first().click()
  await page
    .locator('.meeting-card', { hasText: '정산 테스트 모임' })
    .waitFor({ state: 'detached', timeout: 8000 })
})

await browser.close()
if (failed) {
  process.exit(1)
}
console.log('ALL PASSED')
