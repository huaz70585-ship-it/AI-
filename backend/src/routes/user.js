import { Router } from 'express'
import { queryOne, run } from '../db.js'
import { ok, err } from '../utils/response.js'
import { authMiddleware } from '../utils/auth.js'

const router = Router()
router.use(authMiddleware)

/** GET /v1/user/profile */
router.get('/user/profile', (req, res) => {
  const u = queryOne('SELECT id, name, avatar, username FROM users WHERE id = ?', [req.user.id])
  if (!u) return err(res, '用户不存在', 404)
  ok(res, { id: u.id, name: u.name, avatar: u.avatar, username: u.username })
})

/** PATCH /v1/user/profile  修改昵称 / 头像（base64） */
router.patch('/user/profile', (req, res) => {
  const { name, avatar } = req.body || {}
  const u = queryOne('SELECT id FROM users WHERE id = ?', [req.user.id])
  if (!u) return err(res, '用户不存在', 404)

  const fields = []
  const params = []
  if (typeof name === 'string' && name.trim()) {
    if (name.trim().length > 20) return err(res, '昵称最多 20 字')
    fields.push('name = ?')
    params.push(name.trim())
  }
  if (typeof avatar === 'string') {
    // base64 头像，限制 2MB（base64 长度约 2.7M 字符）
    if (avatar.length > 3_000_000) return err(res, '头像不能超过 2MB')
    fields.push('avatar = ?')
    params.push(avatar)
  }
  if (!fields.length) return err(res, '没有要修改的字段')

  params.push(req.user.id)
  run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)

  const updated = queryOne('SELECT id, name, avatar, username FROM users WHERE id = ?', [req.user.id])
  ok(res, { id: updated.id, name: updated.name, avatar: updated.avatar, username: updated.username }, '修改成功')
})

/** POST /v1/user/avatar  专用头像上传（base64 → 存库） */
router.post('/user/avatar', (req, res) => {
  const { avatar } = req.body || {}
  if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
    return err(res, '请上传图片格式的文件')
  }
  if (avatar.length > 3_000_000) return err(res, '头像不能超过 2MB')

  run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id])
  ok(res, { avatar }, '头像上传成功')
})

/** GET /v1/user/footprints  足迹统计 */
router.get('/user/footprints', (req, res) => {
  const f = queryOne('SELECT * FROM footprints WHERE user_id = ?', [req.user.id])
  ok(res, f ? {
    city_count: f.city_count,
    travel_days: f.travel_days,
    total_km: f.total_km,
    progress: f.progress,
  } : { city_count: 0, travel_days: 0, total_km: 0, progress: 0 })
})

export default router
