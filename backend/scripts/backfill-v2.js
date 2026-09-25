/**
 * V2 一次性数据回填脚本。
 *
 * 解决的问题（存量数据缺陷）：
 * 1) 早期的行程在 POST /v1/trips 还没实现「名称（价格）」解析之前生成，
 *    trip_items.price_ref 全是 0 → 详情页「本次行程总预算」恒为 0。
 *    本项目不变式：标题形如「故宫（60）」/「天安门（免费）」，结尾括号里是【人均价】。
 *    → 按标题重新解析 price_ref，再按 计费人数权重 重算 budget_total。
 * 2) 早期的行程 destination_id 为空 → 天气定位（weather.js 步骤 1）直接落空，
 *    只能靠标题名字匹配。→ 从标题解析内置城市回填 destination_id。
 *
 * 幂等：重复跑只会把值写成同一份（按标题解析，标题不变结果不变）。
 * 运行：npm run backfill  （在 backend 目录下；DB 路径由 .env 决定）
 */
import { run, queryAll } from '../src/db.js'

/** 儿童按成人价的一半计费（与 trip.js 的 CHILD_PRICE_RATIO 保持一致） */
const CHILD_PRICE_RATIO = 0.5

/** 计费人数权重：成人 1，儿童 0.5 */
function headWeight(travelerRaw) {
  const t = (() => {
    try { return JSON.parse(travelerRaw || '{}') } catch { return {} }
  })()
  const adults = Number(t?.adults) || 0
  const children = Array.isArray(t?.children) ? t.children.length : 0
  return adults + children * CHILD_PRICE_RATIO
}

/** 从「故宫（60）」这类文本里解析【人均价】（与 trip.js 的 parsePersonPrice 同口径） */
function parsePersonPrice(text) {
  const m = String(text).match(/[（(]([^）)]*)[）)]\s*$/)
  if (!m) return 0
  const num = m[1].match(/\d+(?:\.\d+)?/)
  return num ? Math.round(Number(num[0])) : 0
}

/** 定位内置城市（与 utils/city.js 的 resolveCityFromTitle 同口径） */
function resolveCityId(title) {
  const t = String(title || '')
  const cityNames = queryAll('SELECT id, name FROM cities')
  const hit = cityNames.find((c) => t.includes(c.name))
  return hit ? hit.id : null
}

function main() {
  const trips = queryAll('SELECT * FROM trips')
  let itemFixed = 0
  let tripFixed = 0
  let destFixed = 0

  for (const trip of trips) {
    // 1) 行程项重解析人均价
    const items = queryAll(
      'SELECT id, title FROM trip_items WHERE trip_id = ? AND (price_ref IS NULL OR price_ref = 0)',
      [trip.id],
    )
    for (const it of items) {
      const price = parsePersonPrice(it.title)
      if (it.title.includes('）') && price >= 0) {
        run('UPDATE trip_items SET price_ref = ? WHERE id = ?', [price, it.id])
        itemFixed++
      }
    }

    // 2) 重算总预算 = Σ(人均价) × 计费人数权重
    const sum = queryAll('SELECT COALESCE(SUM(price_ref),0) AS s FROM trip_items WHERE trip_id = ?', [trip.id])[0].s
    const budget = Math.round(Number(sum) * headWeight(trip.traveler))
    let needBudget = budget !== Number(trip.budget_total)
    if (needBudget) {
      run('UPDATE trips SET budget_total = ?, updated_at = ? WHERE id = ?', [budget, new Date().toISOString(), trip.id])
      tripFixed++
    }

    // 3) 回填 destination_id（内置城市）
    if (!trip.destination_id) {
      const cityId = resolveCityId(trip.title)
      if (cityId) {
        run('UPDATE trips SET destination_id = ? WHERE id = ?', [cityId, trip.id])
        destFixed++
      }
    }
  }

  console.log(`[backfill] 完成：修均价 ${itemFixed} 项，重算预算 ${tripFixed} 条，回填目的地 ${destFixed} 条`)
}

main()