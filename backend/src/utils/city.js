/**
 * 目的地城市解析（只用标题，不依赖外部定位）。
 *
 * weather.js（每天天气）与 trip.js（回填 destination_id）共用同一份口径，
 * 否则两处各写一套，天气能定位到、行程存进的 cityId 又对不上。
 *
 * 三级定位：
 * 1) destination_id 命中的内置城市（cities 表）；
 * 2) 标题里出现的内置城市名（标题形如「北京3日经济游」）；
 * 3) 标题开头的中文地名（AI 可能规划内置 4 城之外的地方，如「南京4日深度游」）。
 *
 * 返回 { name, row }；定位不出去返回 null。
 *   row=null 表示是不在 cities 表里的外部城市（如南京），没有 cityId 可存，靠名字匹配。
 */
import { queryAll } from '../db.js'

export function resolveCityFromTitle(title, destinationId = null) {
  const cities = queryAll('SELECT * FROM cities')

  if (destinationId) {
    const byId = cities.find((c) => c.id === destinationId)
    if (byId) return { name: byId.name, row: byId }
  }

  const t = String(title || '')
  const byName = cities.find((c) => t.includes(c.name))
  if (byName) return { name: byName.name, row: byName }

  const m = t.match(/^[\u4e00-\u9fa5]{2,8}(?=\s*[·\-—~至\d]|$)/)
  return m ? { name: m[0], row: null } : null
}