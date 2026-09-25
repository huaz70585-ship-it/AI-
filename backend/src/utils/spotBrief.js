/**
 * 景点决策 brief：共享的 prompt 组装与结果校验。
 *
 * 为什么抽成公共模块：两处调用方 ——
 *   ① .workbuddy/gen-brief.mjs（批量预生成 city_spots 的 brief）
 *   ② routes/city.js 的 POST /v1/spot-brief（用户点到库外的名字时现生成 + 缓存）
 * 若各写一份 prompt，改规则时必然漂移（这个项目已经吃过「删了参数漏改一处调用」的亏）。
 *
 * 信息分拎红线（改 prompt 前先读）：
 *   ① 静态/半静态知识 → 允许产出：why_go / good_for / not_good_for / avoid / photo /
 *      best_slot / stay_min / booking_note / ticket_note。
 *   ② 小时级事实 → 【禁止】：排队时长、是否约满、今日营业。无公开数据源，静态存必错。
 *   ③ 口碑判断 → 【禁止】断言"本地人常去哪家"：没有 UGC/榜单，模型先验会现实误导。
 */

export const SCHEMA_VERSION = 1
export const BRIEF_MAX_LEN = 60   // 单条短语字数上限（超过说明模型在写废话）
export const BRIEF_MAX_ITEMS = 4  // 数组字段最大条数

/** 行程项标题 → 可比较的主体名。去括号内容、去价格数字与分隔符。
 *  与前端 Trip.vue 的 normalizeName 是同一套规则，两边改要同步。 */
export function normalizeSpotName(t) {
  return String(t)
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/[¥￥\s·、,，\d]/g, '')
    .trim()
}

const SYSTEM_RULES = [
  '你是中文旅行编辑，正在为一个旅行 App 的【景点决策卡】撰写内容。',
  '用户在行程里看到一个地点名，点开决策卡，想快速判断：值不值得去、我适不适合、要待多久、有什么坑、不去还能去哪。',
  '',
  '【绝对禁止】——违反任何一条，输出作废：',
  '1. 不要写排队时长、是否约满、今日营业状态。我们没有这些实时数据，编出来的数字会害用户白跑。',
  '2. 不要推荐具体的餐厅名、不要断言"本地人常去哪家/哪家是游客店"。我们没有用户评价数据。',
  '3. 不要写营销排比句："震撼人心""美不胜收""底蕴深厚""值得一去"这类空话一律禁止。',
  '4. 不要重复地点名本身，不要把简介里的短句改写一遍。',
  '',
  '【写作要求】',
  '· 每条 ≤ 25 字，必须是【可执行的具体信息】，不是形容词堆砌。',
  '· why_go：一句话说清它凭什么占你半天时间（和其它同类比，它的独特处在哪）。',
  '· good_for / not_good_for：写人群或情境词，如 带娃 / 长辈同行 / 情侣 / 赶时间 / 恐高 / 腿脚不便 / 想清静 / 重度爱好者。',
  '· avoid：具体到动作，如"正午无遮挡，11-14 点别去""园内只有入口有厕所，进核心区前先解决"。',
  '· photo：具体到位置，如"东门外石桥，早上顺光拍城楼倒影"。',
  '· best_slot：一天中的时段建议（如"开园即入""日落前 1 小时""工作日下午"），不要写月份。',
  '· stay_min：真实建议停留【分钟数】，整数。这是个需要步行/参观的实际时间，不是随手给的数字。',
  '· booking_note：预约规则（如"需提前 1 天在官方小程序实名预约"）；不确定就给 null，不要猜。',
  '· ticket_note：只在有【额外】信息时写（联票、淡旺季差异、优惠政策）；票价本身我们已经知道，不要重复；没有就给 null。',
  '· confidence：你对这份内容的把握度 0-1。涉及具体设施/政策而无把握时给低分（≤0.6），不要虚高。',
]

/**
 * 批量模式（gen-brief.mjs）：spots = [{id, city, name, desc, price, tags}]
 * 输出格式固定为 {"spots":[…]}，id 原样回填。
 */
export function buildBatchMessages(spots) {
  const list = spots
    .map((r) => `${r.id}｜${r.city}｜${r.name}｜${r.desc || '（无简介）'}｜票价 ${r.price || '未知'}｜标签 ${r.tags || '无'}`)
    .join('\n')
  return [
    {
      role: 'system',
      content: [
        ...SYSTEM_RULES,
        '',
        '【输出格式】只输出 JSON，不要任何解释，不要 markdown 代码块：',
        '{"spots":[{"id":"原样填","why_go":"","good_for":[""],"not_good_for":[""],"avoid":[""],"photo":[""],"best_slot":"","stay_min":0,"booking_note":null,"ticket_note":null,"confidence":0.8}]}',
        'spots 数组必须与给出的地点一一对应，id 原样回填，顺序一致。',
      ].join('\n'),
    },
    { role: 'user', content: `下面是需要你写的地点，每行格式：id｜城市｜名称｜简介｜票价｜标签\n\n${list}` },
  ]
}

/**
 * 单点模式（在线现生成）：name 必填，cityHint 可空（行程标题常能推出目的地）。
 * 比批量模式多一条「不是景点」的逃生口：行程里的 sight 项偶有「返程（免费）」「抵达乌鲁木齐」
 * 这类边界占位，它们不是可游的地点，生成决策卡是浪费——让模型直接承认。
 */
export function buildSingleMessages({ name, cityHint }) {
  return [
    {
      role: 'system',
      content: [
        ...SYSTEM_RULES,
        '5. 如果这个名称根本不是一个可游览的具体地点（如餐厅、酒店、车站、机场、"返程""抵达某城市"这类行程占位项），输出 {"spots":[{"id":"1","not_place":true}]}，不要硬编。',
        '',
        '【输出格式】只输出 JSON，不要任何解释，不要 markdown 代码块：',
        '{"spots":[{"id":"1","not_place":false,"why_go":"","good_for":[""],"not_good_for":[""],"avoid":[""],"photo":[""],"best_slot":"","stay_min":0,"booking_note":null,"ticket_note":null,"confidence":0.8}]}',
        'spots 数组恰好一个元素。',
      ].join('\n'),
    },
    {
      role: 'user',
      content:
        `地点名称：${name}\n` +
        `所在城市：${cityHint || '（未知，请按名称自行判断）'}\n` +
        '请按格式输出这一处的决策卡。',
    },
  ]
}

/** 把模型原始 JSON 洗成可信结构。返回 {notPlace?, brief, problems, confidence} */
export function normalizeBrief(raw) {
  const problems = []
  if (raw?.not_place) return { notPlace: true, brief: null, problems: [], confidence: 0 }

  const str = (v, max = BRIEF_MAX_LEN) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const arr = (v) =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, BRIEF_MAX_LEN)).slice(0, BRIEF_MAX_ITEMS)
      : []

  const stayMin = Number(raw?.stay_min)
  let stayMinOut = null
  if (Number.isFinite(stayMin) && stayMin >= 15 && stayMin <= 600) stayMinOut = Math.round(stayMin)
  else problems.push(`stay_min 不在 15-600（得到 ${raw?.stay_min}）`)

  const conf = Number(raw?.confidence)
  let confOut = 0.5
  if (Number.isFinite(conf) && conf >= 0 && conf <= 1) confOut = conf
  else problems.push(`confidence 不在 0-1（得到 ${raw?.confidence}）`)

  const whyGo = str(raw?.why_go, 120)
  if (!whyGo) problems.push('why_go 为空')

  const missingNotGoodFor = !raw?.not_good_for || (Array.isArray(raw.not_good_for) && !raw.not_good_for.length)
  if (missingNotGoodFor) problems.push('not_good_for 缺失（写清不适合谁，正是这张卡的价值）')

  const brief = {
    schema_version: SCHEMA_VERSION,
    why_go: whyGo,
    good_for: arr(raw?.good_for),
    not_good_for: arr(raw?.not_good_for),
    avoid: arr(raw?.avoid),
    photo: arr(raw?.photo),
    best_slot: str(raw?.best_slot, 30) || null,
    stay_min: stayMinOut,
    booking_note: str(raw?.booking_note, 60) || null,
    ticket_note: str(raw?.ticket_note, 60) || null,
  }
  return { notPlace: false, brief, problems, confidence: confOut }
}
