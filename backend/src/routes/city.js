import { Router } from 'express'
import { queryAll, queryOne, parseJSON, run } from '../db.js'
import { ok, err } from '../utils/response.js'
import { authMiddleware } from '../utils/auth.js'
import { rateLimit } from '../utils/rateLimit.js'
import { aiReady, chatOnce, extractJson } from '../utils/ai.js'
import {
  normalizeSpotName,
  buildSingleMessages,
  normalizeBrief,
} from '../utils/spotBrief.js'

const router = Router()

/** GET /v1/cities  城市列表（支持 ?hot=1 只取热门）。
 *  轮播 / 城市入口都吃这份 hero_image + tagline，不再单独有 city_galleries。 */
router.get('/cities', (req, res) => {
  const hot = req.query.hot
  const sql = hot
    ? 'SELECT * FROM cities WHERE hot = 1 ORDER BY id'
    : 'SELECT * FROM cities ORDER BY id'
  const rows = queryAll(sql)
  ok(res, rows.map((r) => ({
    id: r.id,
    name: r.name,
    pinyin: r.pinyin,
    province: r.province,
    hot: !!r.hot,
    hero_image: r.hero_image || null,
    tagline: r.tagline || null,
  })))
})

/** GET /v1/city-spots?city_id=  热门景点。
 *  city_id 可选：不传返回全部城市（首页「为你推荐」用），传了按城市过滤。 */
router.get('/city-spots', (req, res) => {
  const cityId = req.query.city_id
  const rows = cityId
    ? queryAll('SELECT * FROM city_spots WHERE city_id = ? ORDER BY sort', [cityId])
    : queryAll('SELECT * FROM city_spots ORDER BY city_id, sort')
  ok(res, rows.map((r) => ({
    id: r.id,
    city_id: r.city_id,
    name: r.name,
    description: r.description,
    price: r.price,
    image: r.image || null,
    enrollment: r.enrollment || 0,
    rating: r.rating == null ? null : Number(r.rating),
    tags: parseJSON(r.tags, []),
    promo: r.promo || null,
    sort: r.sort,
  })))
})

/**
 * GET /v1/spot/:id  单个景点 + 决策 brief + 替代方案。
 *
 * 这块是「POI 只有名字、没有决策依据」的出口：
 *   · brief      决策包（why_go / good_for / not_good_for / avoid / photo / best_slot /
 *                stay_min / booking_note / ticket_note），由 .workbuddy/gen-brief.mjs 生成。
 *                空 = 还没覆盖，前端按空态处理，不要编。
 *   · alts       替代方案：同城里【标签重合最多】的其它景点，取前 3。
 *                为什么能用标签算：tags 存的是「5A景区/亲子/徒步/皇家园林」这类真实分类维度，
 *                两点共享的标签越多，说明它们能互相替代（不想爬长城 → 同城的另一个"徒步"点）。
 *                这是目前唯一**不依赖任何外部数据源**就能算出来的关系。
 *
 * ⚠ brief 是 AI 生成的，带 confidence 与 updated_at，前端必须照实展示来源与更新时间；
 *   它不含任何实时数据（排队/是否约满），这些也没有数据源，不要去补。
 */
router.get('/spot/:id', (req, res) => {
  const row = queryOne(
    `SELECT s.*, c.name AS city_name
       FROM city_spots s
       JOIN cities c ON c.id = s.city_id
      WHERE s.id = ?`,
    [req.params.id],
  )
  if (!row) return err(res, '景点不存在', 404)

  const selfTags = parseJSON(row.tags, [])
  const alts = queryAll(
    'SELECT id, name, description, price, image, rating, tags FROM city_spots WHERE city_id = ? AND id != ? ORDER BY sort',
    [row.city_id, row.id],
  )
    .map((r) => {
      const tags = parseJSON(r.tags, [])
      return {
        id: r.id,
        name: r.name,
        description: r.description || null,
        price: r.price || null,
        image: r.image || null,
        rating: r.rating == null ? null : Number(r.rating),
        tags,
        shared_tags: tags.filter((t) => selfTags.includes(t)),
      }
    })
    .filter((r) => r.shared_tags.length > 0)
    .sort((a, b) => b.shared_tags.length - a.shared_tags.length)
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      image: r.image,
      rating: r.rating,
      shared_tags: r.shared_tags,
    }))

  const brief = parseJSON(row.brief_json, null)
  ok(res, {
    id: row.id,
    city_id: row.city_id,
    city_name: row.city_name,
    name: row.name,
    description: row.description,
    price: row.price,
    image: row.image || null,
    rating: row.rating == null ? null : Number(row.rating),
    tags: selfTags,
    promo: row.promo || null,
    // 决策包 + 溯源三件套。brief 为 null 时前端要能降级显示（不要塞占位假数据）
    brief,
    brief_source: brief ? row.brief_source : null,
    brief_updated_at: brief ? row.brief_updated_at : null,
    brief_confidence: brief && row.brief_confidence != null ? Number(row.brief_confidence) : null,
    alts,
  })
})

/* ── 按名现生成决策 brief（库外名字的兜底）──────────────────────────
 * city_spots 只覆盖预置城市，AI 排出的行程项是任意城市任意名字（实测库外命中率 0/46）。
 * 流程：归一化名称 → 查 spot_briefs 缓存（含负缓存）→ miss 才调模型 → 写缓存。
 * 成本控制：只在用户真的点开时才生成（不做批量预铺），同一名字全站只花一次钱；
 * 按用户限流，防脚本刷接口烧 token。
 * ⚠ 必须鉴权：这是全站第一个「写缓存 + 花钱调模型」的公开入参接口。 */
const briefLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 20,                  // 每用户每小时 20 次。命中缓存也计入（limiter 在 handler 之前跑），
                            // 但正常浏览远用不完；主要防的是脚本刷接口烧 token
  keyFn: (req) => `spot-brief:${req.user?.id ?? req.ip}`,
  message: '决策信息生成次数已达上限，一小时后再试',
})

router.post('/spot-brief', authMiddleware, briefLimiter, async (req, res) => {
  const rawTitle = String(req.body?.name ?? '').trim()
  const cityHint = String(req.body?.city ?? '').trim().slice(0, 30)
  const name = normalizeSpotName(rawTitle)
  if (name.length < 2) return err(res, '名称太短，生成不了决策信息', 400)

  const now = new Date().toISOString()

  // ① 缓存命中（含负缓存）直接回，不进 limiter 之后的重活
  const cached = queryOne('SELECT * FROM spot_briefs WHERE name = ?', [name])
  if (cached) {
    const brief = parseJSON(cached.brief_json, null)
    if (brief?.not_place) return ok(res, { not_place: true, name })
    return ok(res, {
      name,
      city_name: cached.city_hint || null,
      brief,
      brief_source: cached.source,
      brief_updated_at: cached.updated_at,
      brief_confidence: cached.confidence == null ? null : Number(cached.confidence),
      alts: [],
      cached: true,
    })
  }

  // ② miss → 调模型。没有 AI 配置就明说，不要返回假数据
  if (!aiReady()) return err(res, 'AI 未配置，暂时无法生成决策信息', 503)

  try {
    const text = await chatOnce(buildSingleMessages({ name, cityHint }), {
      temperature: 0.3,
      timeoutMs: 25_000,
    })
    const spot = extractJson(text)?.spots?.[0]
    if (!spot) return err(res, '这次没生成出来，稍后再试', 502)

    const { notPlace, brief, confidence } = normalizeBrief(spot)

    // 负缓存也落库：占位项（返程/抵达某城）不该每次都被重查
    const json = notPlace ? JSON.stringify({ schema_version: 1, not_place: true }) : JSON.stringify(brief)
    run(
      `INSERT INTO spot_briefs (name, raw_title, city_hint, brief_json, source, confidence, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(name) DO UPDATE SET
         raw_title = excluded.raw_title, city_hint = excluded.city_hint,
         brief_json = excluded.brief_json, confidence = excluded.confidence,
         updated_at = excluded.updated_at`,
      [name, rawTitle, cityHint || null, json, 'ai', notPlace ? 0 : confidence, now, now],
    )

    if (notPlace) return ok(res, { not_place: true, name })
    return ok(res, {
      name,
      city_name: cityHint || null,
      brief,
      brief_source: 'ai',
      brief_updated_at: now,
      brief_confidence: confidence,
      alts: [],
      cached: false,
    })
  } catch {
    // chatOnce 的超时/上游错误在此收敛；具体原因只进日志不打给用户
    return err(res, '生成超时了，稍后再试一次', 504)
  }
})

export default router
