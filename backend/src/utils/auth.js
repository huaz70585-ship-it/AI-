import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'

dotenv.config()

const IS_PROD = process.env.NODE_ENV === 'production'

/** 占位符 / 示例值，等同于「根本没配」。原来的 `|| 'dev_secret'` 回退意味着
 *  任何人拿到源码就能伪造任意用户的 token —— 这条回退必须消失。 */
const PLACEHOLDER_SECRETS = new Set([
  '', 'dev_secret', 'change_me', 'changeme', 'secret',
  'jwt_secret', 'your_jwt_secret', 'your-secret-key',
])

let SECRET = (process.env.JWT_SECRET || '').trim()
if (PLACEHOLDER_SECRETS.has(SECRET.toLowerCase())) {
  if (IS_PROD) {
    console.error('[fatal] 生产环境必须配置强随机 JWT_SECRET，禁止使用占位值。')
    console.error('        生成：node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    process.exit(1)
  }
  // 开发环境不阻断启动，但绝不退回到可猜测的常量：用进程内随机值，
  // 代价是重启后旧 token 全部失效（需重新登录）。
  SECRET = randomBytes(32).toString('hex')
  console.warn('[warn] JWT_SECRET 未配置或为占位值，已临时使用随机密钥 —— 后端重启后登录态会失效。')
}
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d'

/** 签发 token */
export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES })
}

/** 鉴权中间件：从 Authorization: Bearer <token> 取并校验 */
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return res.status(401).json({ code: 401, data: null, message: '未登录' })
  }
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    return res.status(401).json({ code: 401, data: null, message: '登录已过期' })
  }
}
