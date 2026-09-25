/**
 * 极简内存限流（零依赖，滑动窗口）。
 *
 * 适用场景：单进程部署。多实例 / 多进程部署时内存不共享，
 * 需要换成 Redis 之类的共享计数器，否则实际额度 = 单实例额度 × 实例数。
 *
 * 用法：
 *   const limiter = rateLimit({ windowMs: 60_000, max: 10 })
 *   router.post('/x', limiter, handler)
 *   // 按业务键限流（如按手机号）：
 *   rateLimit({ windowMs: 60_000, max: 1, keyFn: (req) => `sms:${req.body?.phone || req.ip}` })
 */
export function rateLimit({
  windowMs = 60_000,
  max = 30,
  keyFn,
  message = '操作过于频繁，请稍后再试',
} = {}) {
  /** key -> 命中时间戳数组（升序） */
  const hits = new Map()

  // 定期丢弃过期记录，避免大流量下 Map 无限膨胀。
  // unref() 让这个定时器不阻止进程退出。
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((t) => now - t < windowMs)
      if (kept.length) hits.set(key, kept)
      else hits.delete(key)
    }
  }, windowMs)
  timer.unref?.()

  return function rateLimitMiddleware(req, res, next) {
    // 注意：req.ip 默认取 socket 地址。若部署在反向代理后且未设置
    // app.set('trust proxy', ...)，这里拿到的是代理 IP，会把所有用户算作同一个 key。
    // 故意不默认信任 X-Forwarded-For —— 那个头可被客户端伪造，反而能绕过限流。
    const key = keyFn ? keyFn(req) : req.ip || req.socket?.remoteAddress || 'unknown'

    const now = Date.now()
    const stamps = (hits.get(key) || []).filter((t) => now - t < windowMs)

    if (stamps.length >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - stamps[0])) / 1000))
      res.setHeader('Retry-After', String(retryAfterSec))
      return res.status(429).json({ code: 429, data: null, message })
    }

    stamps.push(now)
    hits.set(key, stamps)
    next()
  }
}
