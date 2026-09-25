/**
 * 种子数据：与前端 src/api/travel.ts 的 MOCK 数据对齐
 * 运行：npm run seed
 */
import bcrypt from 'bcryptjs'
import { db, run } from './db.js'

const now = new Date().toISOString()

// 关闭外键检查，允许 DROP 有引用的表
db.exec(`PRAGMA foreign_keys = OFF;`)

// 重建 users / footprints 表，确保 schema 与最新 db.js 一致（phone 可空）
db.exec(`
DROP TABLE IF EXISTS footprints;
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  phone       TEXT UNIQUE,
  username    TEXT UNIQUE,
  password    TEXT,
  name        TEXT NOT NULL,
  avatar      TEXT,
  created_at  TEXT NOT NULL
);
CREATE TABLE footprints (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE,
  city_count  INTEGER NOT NULL DEFAULT 0,
  travel_days INTEGER NOT NULL DEFAULT 0,
  total_km    INTEGER NOT NULL DEFAULT 0,
  progress    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`)

// 清空其余表（幂等）；city_tags / city_galleries 已随「提示词 / 轮播独立数据」下线移除
db.exec('DROP TABLE IF EXISTS city_tags')
db.exec('DROP TABLE IF EXISTS city_galleries')
for (const t of ['trip_items', 'trip_days', 'trips', 'messages', 'cities', 'city_spots']) db.exec(`DELETE FROM ${t}`)

// 4 个城市（每城市一张主视觉图 + 介绍语 tagline；图片已统一压缩为 800px WebP）
const cities = [
  ['c1', '北京', 'beijing', '北京市', 1, '/images/beijing-hero.webp', '故宫 · 长城 · 胡同烟火'],
  ['c2', '上海', 'shanghai', '上海市', 1, '/images/shanghai-hero.webp', '外滩 · 豫园 · 城市夜景'],
  ['c3', '成都', 'chengdu', '四川', 1, '/images/chengdu-hero.webp', '熊猫 · 火锅 · 慢生活'],
  ['c4', '杭州', 'hangzhou', '浙江', 1, '/images/hangzhou-hero.webp', '西湖 · 灵隐寺 · 龙井茶'],
]
for (const [id, name, pinyin, province, hot, heroImage, tagline] of cities) {
  run('INSERT INTO cities (id, name, pinyin, province, hot, hero_image, tagline) VALUES (?,?,?,?,?,?,?)', [id, name, pinyin, province, hot, heroImage, tagline])
}
console.log('[seed] 4 张城市主视觉已插入')

// 每个城市 4 个热门景点（卡片与轮播共用城市主图，不再单配图）
// [id, cityId, name, desc, price, image, enrollment, rating, tags[], promo, sort]
const citySpots = [
  // 北京
  ['cs_bj_1', 'c1', '故宫博物院', '600年紫禁城 · 红墙黄瓦', '¥60', '/images/beijing-hero.webp', 12800, 4.8, ['5A景区', '世界遗产', '打卡地'], '提前7天预约', 1],
  ['cs_bj_2', 'c1', '八达岭长城', '万里长城精华段 · 蜿蜒山脊', '¥40', '/images/beijing-hero.webp', 9600, 4.7, ['5A景区', '世界遗产', '徒步'], '满6人减300', 2],
  ['cs_bj_3', 'c1', '颐和园', '皇家园林 · 湖光山色长廊', '¥30', '/images/beijing-hero.webp', 7200, 4.8, ['5A景区', '皇家园林', '亲子'], '第2人半价', 3],
  ['cs_bj_4', 'c1', '南锣鼓巷', '胡同文化 · 灰墙青瓦老街', '免费', '/images/beijing-hero.webp', 5400, 4.5, ['胡同', 'Citywalk'], '免费', 4],
  // 上海
  ['cs_sh_1', 'c2', '外滩', '万国建筑博览群 · 黄浦江畔', '免费', '/images/shanghai-hero.webp', 11200, 4.7, ['地标', '夜景'], '免费', 1],
  ['cs_sh_2', 'c2', '上海迪士尼乐园', '梦幻乐园 · 烟花城堡奇缘', '¥475', '/images/shanghai-hero.webp', 18600, 4.9, ['乐园', '亲子', '烟花'], '儿童票8折', 2],
  ['cs_sh_3', 'c2', '豫园', '江南古典园林 · 亭台楼阁', '¥40', '/images/shanghai-hero.webp', 6800, 4.5, ['古典园林', '打卡地'], '65+免票', 3],
  ['cs_sh_4', 'c2', '武康路', '法租界 Citywalk · 梧桐洋房', '免费', '/images/shanghai-hero.webp', 4200, 4.6, ['Citywalk', '梧桐洋房'], '免费', 4],
  // 成都
  ['cs_cd_1', 'c3', '大熊猫基地', '国宝近距离 · 竹林憨态', '¥55', '/images/chengdu-hero.webp', 15400, 4.8, ['国宝', '亲子', '打卡地'], '早场票9折', 1],
  ['cs_cd_2', 'c3', '宽窄巷子', '老成都生活 · 青砖灰瓦灯笼', '免费', '/images/chengdu-hero.webp', 8900, 4.5, ['老成都', 'Citywalk'], '免费', 2],
  ['cs_cd_3', 'c3', '锦里古街', '三国文化 · 美食街红灯笼', '免费', '/images/chengdu-hero.webp', 7600, 4.5, ['三国文化', '美食街'], '免费', 3],
  ['cs_cd_4', 'c3', '都江堰', '两千年水利奇迹 · 鱼嘴飞沙', '¥80', '/images/chengdu-hero.webp', 5200, 4.7, ['世界遗产', '水利奇迹'], '满6人减200', 4],
  // 杭州
  ['cs_hz_1', 'c4', '西湖', '世界文化遗产 · 湖光山色', '免费', '/images/hangzhou-hero.webp', 16800, 4.8, ['世界遗产', '湖泊'], '免费', 1],
  ['cs_hz_2', 'c4', '灵隐寺', '千年古刹 · 飞来峰禅意', '¥45', '/images/hangzhou-hero.webp', 9300, 4.6, ['古刹', '禅意', '文化'], '请香8折', 2],
  ['cs_hz_3', 'c4', '龙井茶园', '茶文化体验 · 翠绿梯田', '免费', '/images/hangzhou-hero.webp', 4800, 4.5, ['茶文化', '自然'], '免费', 3],
  ['cs_hz_4', 'c4', '宋城', '宋文化主题 · 千古情演出', '¥300', '/images/hangzhou-hero.webp', 12400, 4.6, ['主题乐园', '千古情', '亲子'], '儿童票9折', 4],
]
for (const [id, cityId, name, desc, price, image, enrollment, rating, tags, promo, sort] of citySpots) {
  run('INSERT INTO city_spots (id, city_id, name, description, price, image, enrollment, rating, tags, promo, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, cityId, name, desc, price, image, enrollment, rating, JSON.stringify(tags), promo, sort])
}
console.log('[seed] 16 个城市景点已插入')

// 密码哈希（123456）
const hash123456 = bcrypt.hashSync('123456', 10)

// 用户 1：手机号登录 + 账号密码均可（账号：traveler，密码：123456）
run('INSERT INTO users (id, phone, username, password, name, avatar, created_at) VALUES (?,?,?,?,?,?,?)',
  ['1', '13800000000', 'traveler', hash123456, '陆行的旅行簿', null, now])

// 用户 2：管理员（账号：admin，密码：123456，phone 留空演示可空）
run('INSERT INTO users (id, phone, username, password, name, avatar, created_at) VALUES (?,?,?,?,?,?,?)',
  ['2', null, 'admin', hash123456, 'admin', null, now])

// 足迹
run('INSERT INTO footprints (id, user_id, city_count, travel_days, total_km, progress) VALUES (?,?,?,?,?,?)',
  ['f1', '1', 12, 46, 8240, 7])
run('INSERT INTO footprints (id, user_id, city_count, travel_days, total_km, progress) VALUES (?,?,?,?,?,?)',
  ['f2', '2', 8, 32, 5600, 6])

// ── 行程（5 条） ──────────────────────────────────────
const trips = [
  { id: '1004', title: '大理 · 3日', dest: '5301', start: '2026-09-21', end: '2026-09-23', days: 3, traveler: '{"adults":2}', budget: 2400, status: 'ready', rev: 3, source: 'mix' },
  { id: '1001', title: '上海 · 4日', dest: '3101', start: '2026-09-25', end: '2026-09-28', days: 4, traveler: '{"adults":2}', budget: 3860, status: 'ready', rev: 5, source: 'ai' },
  { id: '1002', title: '杭州 · 2日', dest: '3301', start: '2026-11-02', end: '2026-11-03', days: 2, traveler: '{"adults":1}', budget: 1280, status: 'generating', rev: 1, source: 'ai' },
  { id: '1003', title: '京都 · 5日', dest: 'JP-26', start: '2026-08-15', end: '2026-08-19', days: 5, traveler: '{"adults":2}', budget: 12600, status: 'archived', rev: 9, source: 'user' },
  { id: '1005', title: '厦门 · 3日', dest: '3502', start: '2026-07-04', end: '2026-07-06', days: 3, traveler: '{"adults":3}', budget: 3200, status: 'archived', rev: 6, source: 'ai' },
]
for (const t of trips) {
  run('INSERT INTO trips (id,user_id,title,destination_id,start_date,end_date,day_count,traveler,budget_total,status,revision,source,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [t.id, '1', t.title, t.dest, t.start, t.end, t.days, t.traveler, t.budget, t.status, t.rev, t.source, now])
}

// ── 上海 4 日（1001）完整明细 ─────────────────────────
function day(id, trip, idx, date, title, summary, tags) {
  run('INSERT INTO trip_days (id,trip_id,day_index,date,title,summary,theme_tags) VALUES (?,?,?,?,?,?,?)',
    [id, trip, idx, date, title, summary, JSON.stringify(tags)])
}
function item(id, day, trip, order, type, poi, prod, title, sub, time, dur, price, snap, locked, src, conf, note) {
  run(`INSERT INTO trip_items (id,trip_id,trip_day_id,sort_order,type,ref_poi_id,ref_product_id,title,subtitle,start_time,duration_min,price_ref,price_snapshot,locked,source,ai_confidence,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, trip, day, order, type, poi, prod, title, sub, time, dur, price, snap, locked ? 1 : 0, src, conf, note])
}

// D1
day('1001-d1', '1001', 1, '2026-09-25', 'D1 抵达 · 外滩初见', '下午抵达，傍晚看外滩夜景', ['citywalk', '夜景'])
item('9001', '1001-d1', '1001', 1, 'transport', null, 'p-ticket-hq', '抵达虹桥 · 酒店寄存', '地铁2号线约50分钟', '09:00', 50, 0, null, false, 'ai', 0.92, '')
item('9002', '1001-d1', '1001', 2, 'sight', 'poi-bund', null, '外滩观景平台', '观景 · 门票免费', '10:30', 30, 0, null, false, 'ai', 0.55, 'AI 时间为估算，请核对')
item('9003', '1001-d1', '1001', 3, 'meal', 'poi-benbang', 'p-benbang', '午餐 · 老弄堂本帮菜', '餐饮 · 已预订', '12:30', 60, 180, JSON.stringify({ amount: 180, currency: 'CNY', captured_at: now }), true, 'user', null, '')
item('9004', '1001-d1', '1001', 4, 'sight', 'poi-yuyuan', 'p-yuyuan', '豫园 · 城隍庙', '园林 · 建议下午错峰', '15:00', 120, 40, null, false, 'ai', 0.48, '午后客流高峰，建议改期或提前购票')

// D2
day('1001-d2', '1001', 2, '2026-09-26', 'D2 迪士尼', '全天迪士尼', ['乐园'])
item('9101', '1001-d2', '1001', 1, 'sight', 'poi-shdr', 'p-shdr', '上海迪士尼乐园', '乐园 · 全天', '08:30', 600, 475, JSON.stringify({ amount: 475, currency: 'CNY', captured_at: now }), true, 'user', null, '')
item('9102', '1001-d2', '1001', 2, 'hotel', null, 'p-hotel-pd', '入住 · 陆家嘴精品酒店', '1晚 · 含双早', '19:00', null, 680, JSON.stringify({ amount: 680, currency: 'CNY', captured_at: now }), true, 'system', null, '')

// D3
day('1001-d3', '1001', 3, '2026-09-27', 'D3 武康路 · 田子坊', 'citywalk 一天', ['citywalk', '咖啡'])
item('9201', '1001-d3', '1001', 1, 'sight', 'poi-wukang', null, '武康路 · 安福路', 'citywalk · 免费', '10:00', 150, 0, null, false, 'ai', 0.85, '')
item('9202', '1001-d3', '1001', 2, 'meal', null, null, '咖啡 · 街角小店', '餐饮 · 顺路', '14:00', 60, 60, null, false, 'ai', 0.62, '时间为估算')

// D4
day('1001-d4', '1001', 4, '2026-09-28', 'D4 返程', '睡到自然醒，中午返程', [])
item('9301', '1001-d4', '1001', 1, 'transport', null, 'p-ticket-hq-return', '虹桥站返程', '交通 · 高铁', '13:00', null, 0, null, false, 'ai', 0.9, '')

// ── 消息（5 条 · 只放产品真实会产生的事件） ──────────────
// 产品没有交易与社交能力，因此不放「支付未完成 / 酒店预订成功 / 被 N 人收藏 /
// 优惠券过期 / 可以值机」这类消息 —— 它们的落点按钮没有对应接口，点了毫无反应。
// 下面每一条都对应一个真实能力：行程重排、天数补排、改日期、天气、AI 免责声明。
const msgs = [
  { id: 'm1', type: 'trip', icon: 'medal-o', bg: '#1677ff', title: '行程已按你的要求重排', preview: 'AI 把「陆家嘴观景台」移到上午，避开午后阵雨', time: '08:20', unread: 1, cta: '查看行程', kind: 'view' },
  { id: 'm2', type: 'trip', icon: 'fire-o', bg: '#1677ff', title: '新增的 2 天已排好', preview: '「上海 · 4日」日期延长后，AI 已补排 D5、D6', time: '09:30', unread: 1, cta: '查看行程', kind: 'view' },
  { id: 'm3', type: 'trip', icon: 'clock-o', bg: '#1677ff', title: '行程日期已更新', preview: '「杭州 · 2日」改为 11.02 - 11.03，共 2 天', time: '07:15', unread: 0, cta: '查看行程', kind: 'view' },
  { id: 'm4', type: 'system', icon: 'info-o', bg: '#8a939f', title: 'AI 生成内容仅供参考', preview: '时间与地点可能不准，出行前请核实', time: '昨天 18:30', unread: 0, cta: null, kind: null },
  { id: 'm5', type: 'system', icon: 'flower-o', bg: '#8a939f', title: '出行天气提醒', preview: '「上海 · 4日」D1 有阵雨，记得带伞', time: '昨天 10:00', unread: 0, cta: null, kind: null },
]
for (const m of msgs) {
  run('INSERT INTO messages (id,user_id,type,icon,icon_bg,title,preview,time,unread,cta_label,cta_kind,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [m.id, '1', m.type, m.icon, m.bg, m.title, m.preview, m.time, m.unread, m.cta, m.kind, now])
}

console.log('✅ 种子数据写入完成')
console.log(`   用户 1 · 行程 ${trips.length} · 消息 ${msgs.length}`)
