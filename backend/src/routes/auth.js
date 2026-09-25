import { Router } from 'express'
import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { run, queryOne, transaction } from '../db.js'
import { ok, err } from '../utils/response.js'
import { signToken } from '../utils/auth.js'
import { rateLimit } from '../utils/rateLimit.js'

const router = Router()

// ═══════════════════════════════════════════════════════
// 验证码：服务端生成 → 校验 → 一次性消费
// 原来只判断 `code.length >= 4`，等于任何人用任意 4 位数字
// 就能登录/注册任意手机号 —— 那不是验证码，是摆设。
// ═══════════════════════════════════════════════════════
/** phone -> { code, expiresAt, tries } */
const codeStore = new Map()
const CODE_TTL_MS = 5 * 60_000
const MAX_VERIFY_TRIES = 5

/** 开发便利开关：仅非生产环境、且显式配置 AUTH_DEV_CODE 时生效（默认关闭）。
 *  生产环境无条件忽略该变量。 */
const DEV_CODE = process.env.NODE_ENV === 'production'
  ? ''
  : String(process.env.AUTH_DEV_CODE || '').trim()

// 定期清理过期验证码，避免 Map 无限增长
const codeSweeper = setInterval(() => {
  const now = Date.now()
  for (const [phone, rec] of codeStore) {
    if (now > rec.expiresAt) codeStore.delete(phone)
  }
}, 60_000)
codeSweeper.unref?.()

/**
 * 校验验证码（不通过时返回原因）。
 * 规则：必须先获取 → 未过期 → 未超尝试次数 → 比对成功 → 立即销毁（一次性）。
 */
function verifyCode(phone, input) {
  const code = String(input || '').trim()
  if (!code) return { ok: false, message: '请输入验证码' }

  // 开发固定码：显式开启时任何手机号都接受它（生产环境 DEV_CODE 恒为空）
  if (DEV_CODE && code === DEV_CODE) return { ok: true }

  const rec = codeStore.get(phone)
  if (!rec) return { ok: false, message: '请先获取验证码' }
  if (Date.now() > rec.expiresAt) {
    codeStore.delete(phone)
    return { ok: false, message: '验证码已过期，请重新获取' }
  }
  if (rec.tries >= MAX_VERIFY_TRIES) {
    codeStore.delete(phone)
    return { ok: false, message: '验证码错误次数过多，请重新获取' }
  }
  if (rec.code !== code) {
    rec.tries += 1
    return { ok: false, message: '验证码错误' }
  }
  codeStore.delete(phone)
  return { ok: true }
}

// ═══════════════════════════════════════════════════════
// 限流：认证接口原本完全不设防，可以无限刷短信 / 爆破密码
// ═══════════════════════════════════════════════════════
/** 同手机号 60s 内最多 3 次（正常交互够用，脚本刷不动） */
const smsPhoneLimiter = rateLimit({
  windowMs: 60_000, max: 3, keyFn: (req) => `sms:${req.body?.phone || req.ip}`,
})
/** 同 IP 每小时最多 50 次（防换号刷短信费用） */
const smsIpLimiter = rateLimit({
  windowMs: 60 * 60_000, max: 50, keyFn: (req) => `sms-ip:${req.ip}`,
})
/** 同 IP 15 分钟最多 50 次（验证码登录） */
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 50, keyFn: (req) => `login:${req.ip}`,
})
/** 同 IP 15 分钟最多 20 次（密码登录，防口令爆破） */
const passwordLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 20, keyFn: (req) => `pwd:${req.ip}`,
})
/** 同 IP 每小时最多 20 次（注册） */
const registerLimiter = rateLimit({
  windowMs: 60 * 60_000, max: 20, keyFn: (req) => `reg:${req.ip}`,
})

/** POST /v1/auth/sms-code  发送验证码 */
router.post('/sms-code', smsIpLimiter, smsPhoneLimiter, (req, res) => {
  const { phone } = req.body || {}
  if (!/^1\d{10}$/.test(phone || '')) {
    return err(res, '请输入正确的手机号')
  }

  const code = DEV_CODE || String(randomInt(0, 1_000_000)).padStart(6, '0')
  codeStore.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS, tries: 0 })

  // TODO 接入短信服务商（阿里云短信 / 腾讯云短信）后在此真实下发。
  // 当前未接入：开发环境把码打到后端控制台，方便本地联调（生产不打，避免日志泄漏）。
  if (process.env.NODE_ENV === 'production') {
    console.warn('[sms] 生产环境尚未接入短信服务商，验证码无法送达 —— 需先集成短信 SDK')
  } else {
    console.log(`[sms] 验证码 ${phone} -> ${code}（开发用途，未接短信服务）`)
  }

  ok(res, null, '验证码已发送')
})

/** POST /v1/auth/login  验证码登录（手机号未注册时首次登录即注册） */
router.post('/login', loginLimiter, (req, res) => {
  const { phone, code } = req.body || {}
  if (!/^1\d{10}$/.test(phone || '')) return err(res, '请输入正确的手机号')

  const check = verifyCode(phone, code)
  if (!check.ok) return err(res, check.message)

  let user = queryOne('SELECT * FROM users WHERE phone = ?', [phone])
  if (!user) {
    // users + footprints 必须同成同败，否则会留下没有 footprints 的孤儿用户
    user = transaction(() => {
      // 加随机后缀：纯 Date.now() 在并发注册时会撞主键（users.id 是 PRIMARY KEY）
      const id = `u_${Date.now()}_${randomInt(1000, 10_000)}`
      const name = `旅客${phone.slice(-4)}`
      run('INSERT INTO users (id, phone, name, created_at) VALUES (?,?,?,?)',
        [id, phone, name, new Date().toISOString()])
      run('INSERT INTO footprints (id, user_id, city_count, travel_days, total_km, progress) VALUES (?,?,?,?,?,?)',
        [`f_${id}`, id, 0, 0, 0, 0])
      return queryOne('SELECT * FROM users WHERE phone = ?', [phone])
    })
  }

  const token = signToken({ id: user.id, phone: user.phone })
  ok(res, {
    token,
    user: { id: user.id, name: user.name, avatar: user.avatar },
  }, '登录成功')
})

/** POST /v1/auth/register  账号密码注册 */
router.post('/register', registerLimiter, (req, res) => {
  const { username, password, phone } = req.body || {}
  if (!username || username.length < 3) return err(res, '用户名至少 3 位')
  if (!password || password.length < 6) return err(res, '密码至少 6 位')
  if (phone && !/^1\d{10}$/.test(phone)) return err(res, '手机号格式不正确')

  // 友好提示用的前置校验（真正的唯一性由 UNIQUE 约束兜底，防并发竞态）
  if (queryOne('SELECT id FROM users WHERE username = ?', [username])) {
    return err(res, '用户名已被占用')
  }
  if (phone && queryOne('SELECT id FROM users WHERE phone = ?', [phone])) {
    return err(res, '手机号已注册')
  }

  const id = `u_${Date.now()}_${randomInt(1000, 10_000)}`
  const hash = bcrypt.hashSync(password, 10)
  const name = username

  try {
    // 两次写入必须原子：中途失败会留下没有 footprints 的孤儿用户
    transaction(() => {
      run('INSERT INTO users (id, phone, username, password, name, created_at) VALUES (?,?,?,?,?,?)',
        [id, phone || null, username, hash, name, new Date().toISOString()])
      run('INSERT INTO footprints (id, user_id, city_count, travel_days, total_km, progress) VALUES (?,?,?,?,?,?)',
        [`f_${id}`, id, 0, 0, 0, 0])
    })
  } catch (e) {
    // 并发下同名/同手机号的插入会被 UNIQUE 约束拒绝，给个能看懂的提示
    if (String(e.message || '').includes('UNIQUE')) return err(res, '用户名或手机号已被占用')
    throw e
  }

  const token = signToken({ id, phone: phone || null })
  ok(res, {
    token,
    user: { id, name, avatar: null },
  }, '注册成功')
})

/** POST /v1/auth/login-password  账号密码登录（账号可为用户名或手机号） */
router.post('/login-password', passwordLimiter, (req, res) => {
  const { account, password } = req.body || {}
  if (!account) return err(res, '请输入账号')
  if (!password) return err(res, '请输入密码')

  // 账号支持 用户名 或 手机号
  const user = queryOne(
    'SELECT * FROM users WHERE username = ? OR phone = ?',
    [account, account],
  )
  if (!user) return err(res, '账号不存在')
  if (!user.password) return err(res, '该账号未设置密码，请用验证码登录')

  const valid = bcrypt.compareSync(password, user.password)
  if (!valid) return err(res, '密码错误')

  const token = signToken({ id: user.id, phone: user.phone })
  ok(res, {
    token,
    user: { id: user.id, name: user.name, avatar: user.avatar },
  }, '登录成功')
})

export default router
