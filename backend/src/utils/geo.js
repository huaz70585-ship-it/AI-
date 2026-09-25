/**
 * 地理编码：地点文本 → 坐标（地图接入的第①层）。
 *
 * 为什么要这个模块：trip_items 里没有任何坐标字段，地点只以自然语言活在 title 里
 * （「青秀山（20）」「豫园 · 城隍庙」「抵达南宁（免费）」「虹桥站返程」）。
 * 接入地图的第一步就是把这些文本变成可计算的地理对象。
 *
 * ── 三条硬约束（都是实测出来的，改动前先看这里的理由）─────────────
 *
 * 1. region 是【软过滤】，不是硬过滤。
 *    带 region=上海 查「街角小店」，腾讯照样返回广东汕头、浙江绍兴、贵州铜仁的结果。
 *    所以结果必须校验城市，不能盲信首位 —— 否则用户地图上会跳出一个外省的点，
 *    而且不报错（静默错误，比报错麻烦得多）。
 *
 * 2. 校验按【省级】，不按市级。
 *    反例：天山天池属昌吉回族自治州阜康市，而行程目的地写的是乌鲁木齐。
 *    一日游去周边地州是常态，按市级校验会把这类正常数据全部误杀。
 *
 * 3. 抽象项不打点。
 *    「抵达」「午餐」「返程」不是地点。硬编码只会得到城市中心，反而污染数据。
 *    这类项保持 geo_status = NULL，地图层跳过。
 *
 * ── 缓存优先 ──────────────────────────────────────────────
 * 腾讯 placeSuggestion 实测有抖动：同一个「安福路」，前后两次查询一次返回坐标、
 * 一次返回「未找到结果」。只靠实时查询，结论会随接口的稳定性漂移。
 * 命中一次就写进 geo_cache，之后不再依赖接口。
 */
import { queryAll, queryOne, run } from '../db.js'

// ── 文本清洗 ────────────────────────────────────────────────

/** 去掉价格括号与装饰空白：「青秀山（20）」→「青秀山」 */
export function stripPrice(title) {
  return String(title ?? '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 零地名的抽象项词表。
 *
 * 与 hop.js 的 ABSTRACT_ONLY 同源但更宽：那边管「估交通时跳过哪些」（需要严，
 * 含地名的项必须放行），这边管「该不该打点」（可以宽）。故意各留一份 ——
 * 合并会让一边的调整悄悄影响另一边的行为。
 */
const ABSTRACT_WORDS = [
  '抵达', '到达', '返程', '回程', '返家', '回家', '返邕', '出发', '离程', '离开',
  '结束', '结束行程', '行程结束', '散团', '值机',
  '退房', '入住', '寄存', '行李寄存', '收拾行李', '自由活动', '休息', '待定', '集合',
  '早餐', '午餐', '晚餐', '夜宵', '送机', '送站', '去机场', '去火车站', '去高铁站',
]

/** 泛化名词：本身不是具体地点，拿去地理编码必然失败，抠出来也要丢掉 */
const GENERIC_WORDS = [
  '酒店', '餐厅', '小店', '咖啡', '超市', '商场', '民宿', '客栈', '宾馆', '夜市',
]

const SEP = /[·・]/
const NOISE = /[\s,，、。.]/g

/**
 * 从一个片段里抠出地名。
 *   「抵达虹桥」  → 「虹桥」（剥掉动作词）
 *   「酒店寄存」  → null（抠完只剩泛化词，不是地点）
 *   「外滩观景平台」→ 原样返回
 *
 * 这段规则是踩过坑才收敛的：第一版把「抵达虹桥 · 酒店寄存」整串当地名，
 * 于是「抵达虹桥」「酒店寄存」都成了候选查询串，前者查不到、后者查出外地小店。
 */
function extractPlace(part) {
  const compact = part.replace(NOISE, '')
  if (!compact) return null
  if (ABSTRACT_WORDS.includes(compact)) return null
  let rest = part
  for (const w of ABSTRACT_WORDS.filter((x) => compact.includes(x))) rest = rest.split(w).join('')
  rest = rest.replace(NOISE, '').trim()
  if (rest.length < 2) return null
  if (GENERIC_WORDS.includes(rest)) return null
  return rest
}

/**
 * 从一个 title 里抠出所有「可以拿去地理编码的查询串」。
 * @returns {{ abstract: boolean, probes: string[] }}
 *   abstract=true 表示这项本该跳过（不是地点，不该打点）
 *
 *   「豫园 · 城隍庙」      → { abstract:false, probes:['豫园','城隍庙'] }
 *   「抵达南宁」          → { abstract:false, probes:['南宁'] }
 *   「返程」              → { abstract:true,  probes:[] }
 *   「午餐 · 老弄堂本帮菜」→ { abstract:false, probes:['老弄堂本帮菜'] }
 */
export function placesOf(title) {
  const cleaned = stripPrice(title)
  if (!cleaned) return { abstract: true, probes: [] }

  // 组合名：按分隔符拆开逐段提取
  if (SEP.test(cleaned)) {
    const probes = cleaned.split(SEP).map(extractPlace).filter(Boolean)
    return probes.length ? { abstract: false, probes } : { abstract: true, probes: [] }
  }

  const compact = cleaned.replace(NOISE, '')
  if (ABSTRACT_WORDS.includes(compact)) return { abstract: true, probes: [] }

  // 含抽象动作词但整体不是纯抽象 → 抠出地名
  const hits = ABSTRACT_WORDS.filter((w) => compact.includes(w))
  if (hits.length > 0) {
    const rest = extractPlace(cleaned)
    return rest ? { abstract: false, probes: [rest] } : { abstract: true, probes: [] }
  }

  return { abstract: false, probes: [cleaned] }
}

/** 这一项是不是「本来就不该打点」的抽象项 */
export function isAbstractTitle(title) {
  return placesOf(title).abstract
}

// ── 城市归属 ────────────────────────────────────────────────

/**
 * 推断行程所属城市。口径与 weather.js 的 resolveCity 一致：
 * destination_id 优先 → 标题里出现已知城市名 → 从标题头部正则截取。
 *
 * AI 生成的行程 destination_id 多为 null，所以实际主要靠后两条 ——
 * 这一步本身就有失败率（「新疆」能截出来，但要的是「乌鲁木齐」）。
 *
 * @returns {string|null} 城市名（用于 region 与缓存键）
 */
export function cityOfTrip({ title, destination_id }) {
  if (destination_id) {
    const byId = queryOne('SELECT name FROM cities WHERE id = ?', [destination_id])
    if (byId) return byId.name
  }
  const t = String(title ?? '')
  for (const c of queryAll('SELECT name FROM cities WHERE name IS NOT NULL')) {
    if (t.includes(c.name)) return c.name
  }
  const m = t.match(/^[\u4e00-\u9fa5]{2,8}(?=\s*[·\-—~至\d]|$)/)
  return m ? m[0] : null
}

/** 城市 → 省级名称。cities 表里没有的城市返回 null（调用方走宽松判据） */
export function provinceOf(city) {
  if (!city) return null
  const row = queryOne('SELECT province FROM cities WHERE name = ?', [city])
  return row?.province || null
}

/**
 * 校验接口结果是不是我们要的城市。**按省级判**（理由见文件头约束 2）。
 *
 * 判据（任一成立即通过）：
 *   1. 知道期望省份 → 返回的省与它互相包含（「新疆」↔「新疆维吾尔自治区」）
 *   2. 期望城市名出现在 返回的省/市/区/地址/名称 里
 *      「乌鲁木齐」在「新疆维吾尔自治区乌鲁木齐市天山区…」里 ✓
 *      「上海」不在「广东省汕头市」里 ✗
 *
 * 省内同名点（同省不同市）不拦 —— 概率低，拦了会误伤，宁可放过。
 */
export function provinceMatches(expectCity, expectProvince, r) {
  const hay = [r.province, r.city, r.district, r.address, r.title].filter(Boolean).join(' ')
  if (expectProvince && r.province) {
    return hay.includes(expectProvince) || expectProvince.includes(r.province)
  }
  if (expectCity && hay.includes(expectCity)) return true
  return false
}

// ── 缓存 ────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString()

/** 缓存键。城市必须参与：「城隍庙」在沪/穗是不同实体，只按名字去重会串味 */
export function cacheKey(city, name) {
  return `${city || ''}|${name}`
}

/** 读缓存（含负缓存：miss / city_mismatch 也会被记下来） */
export function readCache(city, name) {
  return queryOne('SELECT * FROM geo_cache WHERE query_key = ?', [cacheKey(city, name)]) || null
}

/**
 * 写缓存。冲突时【覆盖】而非忽略：
 * 缓存里存的应当是「已经确认过的结论」，后写入的（尤其是 source=manual 的人工核对数据）
 * 理应盖过早期的自动结果。而 hop 的缓存是「谁先写谁赢」—— 因为那边 AI 话术会漂移，
 * 先到的和后来的等价；这边不同，来的可能是权威数据。
 */
export function writeCache(e) {
  run(
    `INSERT INTO geo_cache
       (query_key, city, name, title, latitude, longitude, poi_id, address, adcode, status, source, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(query_key) DO UPDATE SET
       title      = excluded.title,
       latitude   = excluded.latitude,
       longitude  = excluded.longitude,
       poi_id     = excluded.poi_id,
       address    = excluded.address,
       adcode     = excluded.adcode,
       status     = excluded.status,
       source     = excluded.source,
       created_at = excluded.created_at`,
    [
      cacheKey(e.city, e.name),
      e.city ?? null,
      e.name,
      e.title ?? null,
      e.latitude ?? null,
      e.longitude ?? null,
      e.poi_id ?? null,
      e.address ?? null,
      e.adcode ?? null,
      e.status,
      e.source,
      nowIso(),
    ],
  )
}

// ── 在线查询（需要 Key）────────────────────────────────────

/**
 * 腾讯位置服务 Key。本项目【不含 Key，也不该含】——
 * 前端不能硬编码，后端走环境变量，Key 由部署方自己申请并配白名单。
 * 没有 Key 时 lookupGeo 返回 skipped，整个流程静默降级，不阻塞行程生成。
 */
export function mapKey() {
  return process.env.TENCENT_MAP_KEY || ''
}

/**
 * 腾讯 WebService · 地点联想。
 * 契约（官方文档）：GET https://apis.map.qq.com/ws/place/v1/suggestion
 *   ?keyword=<地名>&region=<城市>&key=<Key>
 *   返回 { status: 0, data: [{ id, title, address, location:{lat,lng},
 *                              ad_info:{ adcode, province, city, district } }] }
 *
 * ⚠ 未在真实 Key 下验证过 —— 本机没有 Key。HTTP 路径的正确性等配了 Key 再验，
 *   目前生产实际走的是「缓存命中」这条路（由 backfill-geo.mjs 灌入人工核对过的数据）。
 */
async function httpSuggestion(keyword, region, key) {
  const url =
    'https://apis.map.qq.com/ws/place/v1/suggestion?keyword=' +
    encodeURIComponent(keyword) +
    (region ? '&region=' + encodeURIComponent(region) : '') +
    '&key=' + encodeURIComponent(key)
  const res = await fetch(url)
  const json = await res.json().catch(() => null)
  if (!json || json.status !== 0 || !Array.isArray(json.data) || !json.data.length) return null
  const top = json.data[0]
  return {
    id: String(top.id ?? ''),
    title: top.title ?? null,
    address: top.address ?? null,
    lat: top.location?.lat ?? null,
    lng: top.location?.lng ?? null,
    province: top.ad_info?.province ?? null,
    city: top.ad_info?.city ?? null,
    district: top.ad_info?.district ?? null,
    adcode: top.ad_info?.adcode ?? null,
  }
}

/**
 * 查询一个地名的坐标。按优先级：
 *   1. geo_cache 命中 → 直接用。缓存里连 miss / city_mismatch 也存，
 *      所以虚构地名不会被反复重查（负缓存）。
 *   2. 没配 TENCENT_MAP_KEY → status:'skipped'，调用方跳过（不阻塞主流程）
 *   3. 配了 Key → 调接口 → 校验省级 → 写缓存 → 返回
 */
export async function lookupGeo({ name, city, province }) {
  const hit = readCache(city, name)
  if (hit) {
    return {
      status: hit.status,
      latitude: hit.latitude,
      longitude: hit.longitude,
      poi_id: hit.poi_id,
      title: hit.title,
      address: hit.address,
      cached: true,
    }
  }

  const key = mapKey()
  if (!key) return { status: 'skipped', cached: false }

  const r = await httpSuggestion(name, city, key)
  const out = {
    name,
    city,
    status: 'miss',
    latitude: null,
    longitude: null,
    poi_id: null,
    title: null,
    address: null,
    adcode: null,
    source: 'map',
  }
  if (r) {
    if (provinceMatches(city, province ?? provinceOf(city), r)) {
      out.status = 'ok'
      out.latitude = r.lat
      out.longitude = r.lng
      out.poi_id = r.id
      out.title = r.title
      out.address = r.address
    } else {
      // 查到了，但不在期望的省 —— 典型的「外省同名点」，宁可不打点
      out.status = 'city_mismatch'
      out.title = r.title
      out.address = r.address
    }
  }
  writeCache(out)
  return { ...out, cached: false }
}
