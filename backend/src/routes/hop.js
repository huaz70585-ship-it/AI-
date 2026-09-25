import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { queryAll, queryOne, run } from '../db.js'
import { ok, err } from '../utils/response.js'
import { authMiddleware } from '../utils/auth.js'
import { chatOnce, extractJson, aiReady } from '../utils/ai.js'

const router = Router()

// 交通衔接都要登录
router.use(authMiddleware)

/** 前端能识别的交通方式（其余一律归 unknown） */
const MODES = new Set(['walk', 'bus', 'metro', 'taxi', 'bike', 'coach'])

/**
 * 「整项就是一个抽象词」的行程项，没有任何可定位的地名，估不了交通。
 * 注意只匹配【清洗后整体等于】这些词的情况：
 * 「返程」→ 命中；「抵达虹桥 · 酒店寄存」→ 不命中（含真实地名虹桥）。
 *
 * 命中的项默认整段跳过。唯一的例外是「完全没有任何地点线索的收尾项」
 * （见 BARE_CLOSING）：它虽然没有地名，但语义明确 —— 一定是去当地的火车站/机场，
 * 能按占位符交给 AI 估。
 */
const ABSTRACT_ONLY =
  /^(返程|回程|回家|出发|结束|离开|退房|入住|寄存|收拾行李|自由活动|休息|待定|早餐|午餐|晚餐|夜宵)$/

/** 去掉价格括号（「灵隐寺（45）」→「灵隐寺」）与装饰性分隔符 */
function placeName(title) {
  return String(title)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[·・]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isAbstract(title) {
  const compact = placeName(title).replace(/[\s,，、。.]/g, '')
  if (compact.length < 2) return true
  return ABSTRACT_ONLY.test(compact)
}

/**
 * 喂给 AI 的「返程占位符」。
 *
 * 背景：AI 生成的返程项就是「返程（免费）」这种纯抽象词 —— 没有地名，AI 不知道
 * 该往哪估，所以过去整段被跳过，时间轴上「最后一站 → 返程」没有任何交通提示。
 * 但这一段的语义是确定的：去当地的火车站或机场。所以这里把它改写成一个
 * 可解释的占位串交给模型（实测 200-500ms 能给出合理时长，见下）。
 * 不落库：占位符只出现在发给 AI 的输入里，返回给前端的是原始 title + kind 标记。
 */
const RETURN_PLACEHOLDER = '返程：前往当地的火车站或机场'

/**
 * 这一项是不是「完全没有任何地点线索的收尾项」—— 只有这些才需要换成占位符。
 *
 * 判据是【清洗后整体等于】下面某个词。踩过的坑：一开始想复用 isAbstract() 来判，
 * 但 ABSTRACT_ONLY 里根本没有「送机」「散团」—— 于是这些标题被当成普通地点原样
 * 交给 AI，占位符永远不生效（单测 15 条里 4 条不符）。独立词表才准。
 *
 * 正例：返程 / 回程 / 回家 / 离程 / 送机 / 送站 / 去机场 / 散团（都零线索，套占位符）
 * 反例：虹桥站返程 / 送机到浦东机场（标题已写明去哪，原样交给 AI 更好）
 * 反例：退房 / 自由活动（是抽象词但不是收尾动作，照旧整段跳过）
 *
 * 与 tripBoundary.js 的 CLOSING_ITEM 分工不同、词表也不完全重合，别合并：
 *   那边判「这一项挂的位置是不是越界了」，需要尽量宽（含「返邕」「行程结束」等）；
 *   这边判「要不要把它替换成占位符再发出去」，需要尽量严（只有零线索的才替换）。
 */
const BARE_CLOSING =
  /^(返程|回程|返家|回家|离程|送机|送站|去机场|去火车站|去高铁站|散团|结束|结束行程|行程结束|离开|出发)$/

function isBareClosing(title) {
  return BARE_CLOSING.test(placeName(title).replace(/[\s,，、。.]/g, ''))
}

/**
 * 兜底清洗：prompt 里明令禁止输出线路编号，但模型不保证 100% 听话。
 * 实测收紧 prompt 后泄漏为 0，这一层是防回归用的。
 */
function scrubRouteNo(text) {
  return String(text)
    .replace(/\d{1,3}\s*号线/g, '地铁')
    .replace(/(?<![\dA-Za-z])\d{1,3}\s*路(?![线])/g, '公交')
    .replace(/(地铁){2,}/g, '地铁')
    .replace(/(公交){2,}/g, '公交')
    .replace(/^地铁乘/g, '乘地铁')
    .replace(/\s+/g, ' ')
    .trim()
}

function clampInt(v, min, max) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

/**
 * system prompt —— 这版是实测收敛过的：
 * 初版只说"不要编造线路号"，模型照样输出「11号线转2号线」；
 * 改成"铁律 · 违反即失败"并给出正反例后，13 段泄漏为 0。
 */
const HOP_SYSTEM = `你是旅行行程的「交通衔接」助手。用户会给你某一天按时间排序的地点序列，你只需判断【相邻两个地点之间】用什么交通方式最合理。

严格要求：
1. 只输出 JSON，不要任何解释、不要 markdown 代码块以外的文字。
2. 输出格式：{"hops":[{"from":"起点名","to":"终点名","mode":"walk|bus|metro|taxi|bike|coach","duration_min":数字,"cost":数字,"tip":"不超过15字的一句提醒"}]}
3. hops 数量必须等于「地点数 - 1」，顺序与输入顺序严格一致。
4. duration_min 是不含等待的纯在途时间，填整数分钟；cost 是【每人】预估花费（元，整数，免费填 0）。
5. 【铁律 · 违反即失败】你没有实时地图数据，绝对禁止输出具体线路编号：
   - 任何字段里都不允许出现「2号线」「10号线」「7路」「游2」这类具体线路编号。
   - 只写交通方式本身：地铁 / 公交 / 景区接驳车 / 打车 / 步行 / 骑行。
   - 例：写「乘地铁到南京东路一带」而不是「乘2号线转10号线到南京东路站」。
   - 距离近、在同一景区内的景点（寺庙群、园林群），正确答案通常是 walk，不要强行推荐地铁或公交。
   - 拿不准时长就按常识给合理区间中值，不要给 0。
6. 若某个地点写成「返程：前往当地的火车站或机场」，说明这一段是行程末尾前往车站/机场
   （用户可能坐高铁也可能坐飞机）：按市内交通给合理时长，不确定就按打车估；
   tip 里提一句预留取票安检时间。不要反问，也不要输出具体车次/航班号。`

/** 同一对项并发只算一次（多人同时打开同一行程时，避免重复烧 token） */
const inflight = new Map()

/** 把模型返回的一段结果落库；已存在则不动（谁先写谁赢） */
function saveHop(tripId, fromId, toId, h) {
  const mode = MODES.has(String(h?.mode)) ? String(h.mode) : 'unknown'
  run(
    `INSERT INTO trip_hops
       (id, trip_id, from_item_id, to_item_id, mode, duration_min, cost_ref, tip, source, created_at)
     VALUES (?,?,?,?,?,?,?,?, 'ai', ?)
     ON CONFLICT(from_item_id, to_item_id) DO NOTHING`,
    [
      randomUUID(),
      tripId,
      fromId,
      toId,
      mode,
      clampInt(h?.duration_min, 0, 1440),
      clampInt(h?.cost, 0, 9999),
      scrubRouteNo(h?.tip || '').slice(0, 40),
      new Date().toISOString(),
    ],
  )
}

/** 为缺失的段落调一次 AI 并落库 */
async function fetchMissing(tripId, hint, dayIndex, pairs) {
  const seq = pairs
    .map((p, i) => {
      // 收尾段没有真实地名，用占位符告诉模型「这里是去当地车站/机场」
      const to = p.toIsReturn ? RETURN_PLACEHOLDER : placeName(p.to.title)
      return `${i + 1}. ${placeName(p.from.title)} → ${to}（${p.from.start_time} 出发）`
    })
    .join('\n')
  const content = await chatOnce([
    { role: 'system', content: HOP_SYSTEM },
    {
      role: 'user',
      content: `行程参考：${hint}\n第 ${dayIndex} 天，相邻地点序列：\n${seq}\n\n请输出与上述 ${pairs.length} 段一一对应的 hops JSON。`,
    },
  ])
  const parsed = extractJson(content)
  const list = Array.isArray(parsed?.hops) ? parsed.hops : []
  pairs.forEach((p, i) => {
    if (list[i]) saveHop(tripId, p.from.id, p.to.id, list[i])
  })
  return list.length
}

/**
 * GET /trip/:id/hops?day=1
 * 返回某天相邻行程项之间的交通衔接。缓存优先，未命中才调 AI（一次调用算完当天所有缺失段）。
 * AI 不可用时返回 hops 全空 + ai_error，前端静默不展示，不影响主流程。
 */
router.get('/trip/:id/hops', async (req, res) => {
  const tripId = req.params.id
  const trip = queryOne('SELECT id, user_id, title FROM trips WHERE id = ?', [tripId])
  if (!trip) return err(res, '行程不存在', 404)
  if (trip.user_id !== req.user.id) return err(res, '无权访问该行程', 403)

  const dayIndex = Number(req.query.day)
  if (!Number.isInteger(dayIndex) || dayIndex < 1) return err(res, 'day 参数必须是正整数')

  const day = queryOne('SELECT id FROM trip_days WHERE trip_id = ? AND day_index = ?', [tripId, dayIndex])
  if (!day) return err(res, '该天不存在', 404)

  const items = queryAll(
    'SELECT id, sort_order, type, title, start_time FROM trip_items WHERE trip_day_id = ? ORDER BY sort_order',
    [day.id],
  )

  // 相邻配对。起点必须是可定位的地点；终点默认也是 —— 唯一的例外是行程末尾的
  // 「返程」这类收尾项：它没有地名，但语义明确（去当地车站/机场），
  // 按占位符交给 AI 估，见 RETURN_PLACEHOLDER。
  const pairs = []
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i]
    const b = items[i + 1]
    if (isAbstract(a.title)) continue
    const toIsReturn = isBareClosing(b.title)
    if (isAbstract(b.title) && !toIsReturn) continue
    pairs.push({ from: a, to: b, toIsReturn })
  }

  let aiError = null
  if (pairs.length) {
    const existing = new Set(
      queryAll('SELECT from_item_id, to_item_id FROM trip_hops WHERE trip_id = ?', [tripId])
        .map((r) => `${r.from_item_id}|${r.to_item_id}`),
    )
    const missing = pairs.filter((p) => !existing.has(`${p.from.id}|${p.to.id}`))

    if (missing.length) {
      if (!aiReady()) {
        aiError = 'AI 未配置'
      } else {
        // 并发去重的 key 必须带上「这一批要算哪些相邻对」。
        // 只用 tripId|dayIndex 的话，移动项之后立刻重发的请求会复用上一个还在飞的
        // 任务（那批 missing 是旧顺序的），新顺序的段会全部返回 mode:null —— 200 无错、
        // 但前端交通条整片消失。实测复现：R1 在飞时改顺序，R2 返回 3 段全 null。
        const key = `${tripId}|${dayIndex}|${missing.map((p) => `${p.from.id}>${p.to.id}`).join(',')}`
        let task = inflight.get(key)
        if (!task) {
          task = fetchMissing(tripId, trip.title || '', dayIndex, missing)
            .finally(() => inflight.delete(key))
          inflight.set(key, task)
        }
        try {
          await task
        } catch (e) {
          aiError = 'AI 暂时不可用'
          console.error('[hop] AI 生成失败:', e.message)
        }
      }
    }
  }

  // 写完重读一次，保证返回的是库里的最终值（并发下也一致）
  const saved = new Map(
    queryAll('SELECT * FROM trip_hops WHERE trip_id = ?', [tripId])
      .map((r) => [`${r.from_item_id}|${r.to_item_id}`, r]),
  )

  const hops = pairs.map((p) => {
    const r = saved.get(`${p.from.id}|${p.to.id}`)
    return {
      from_item_id: p.from.id,
      to_item_id: p.to.id,
      from_title: placeName(p.from.title),
      to_title: placeName(p.to.title),
      mode: r?.mode || null,
      duration_min: r?.duration_min ?? null,
      cost_ref: r?.cost_ref ?? null,
      tip: r?.tip || '',
      source: r?.source || null,
      /**
       * 'return' = 这一段是「最后一站 → 返程」，终点没有真实地名（用占位符估的），
       * 前端据此把目标写成「车站 / 机场」而不是复述「返程」两个字。
       * 不落库：它由 item 标题推导，标题没变结论就不会变。
       */
      kind: p.toIsReturn ? 'return' : null,
    }
  })

  ok(res, {
    trip_id: tripId,
    day: dayIndex,
    hops,
    /** 当日交通合计（仅展示用，不计入 trips.budget_total —— 那是行程项消费口径） */
    total_cost: hops.reduce((s, h) => s + (h.cost_ref || 0), 0),
    total_min: hops.reduce((s, h) => s + (h.duration_min || 0), 0),
    ai_error: aiError,
  })
})

export default router
