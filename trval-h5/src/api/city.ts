import { request } from '../utils/request'

export interface City {
  id: string
  name: string
  pinyin?: string
  province?: string
  hot: boolean
  hero_image: string | null
  tagline: string | null
}

export interface CitySpot {
  id: string
  city_id: string
  name: string
  description: string
  price: string
  image: string | null
  enrollment: number
  rating: number | null
  tags: string[]
  promo: string | null
  sort: number
}

/** 获取城市列表（轮播 / 城市名片都吃这份 hero_image + tagline） */
export function getCities(): Promise<City[]> {
  return request<City[]>({ url: '/v1/cities', method: 'GET' })
}

/** 决策 brief（景点决策卡的主体内容）。由 .workbuddy/gen-brief.mjs 生成，
 *  只装静态/半静态知识 —— 不含排队、不含"是否约满"，那些没有数据源。 */
export interface SpotBrief {
  schema_version: number
  why_go: string
  good_for: string[]
  not_good_for: string[]
  avoid: string[]
  photo: string[]
  best_slot: string | null
  stay_min: number | null
  booking_note: string | null
  ticket_note: string | null
}

export interface SpotAlt {
  id: string
  name: string
  description: string | null
  price: string | null
  image: string | null
  rating: number | null
  shared_tags: string[]
}

/** 单个景点详情（含决策 brief 与替代方案） */
export interface SpotDetail {
  id: string
  city_id: string
  city_name: string
  name: string
  description: string | null
  price: string | null
  image: string | null
  rating: number | null
  tags: string[]
  promo: string | null
  brief: SpotBrief | null
  brief_source: string | null
  brief_updated_at: string | null
  brief_confidence: number | null
  alts: SpotAlt[]
}

/** 获取单个景点的决策信息。brief 可能为 null（还没覆盖），调用方按空态处理，别编数据 */
export function getSpotDetail(id: string): Promise<SpotDetail> {
  return request<SpotDetail>({ url: `/v1/spot/${id}`, method: 'GET' })
}

/** 按名现生成的决策信息（库外名字的兜底，后端有缓存与限流）。
 *  not_place = true 表示模型判定这不是个可游的地点（如"返程""抵达某城"），调用方应隐藏入口 */
export interface SpotBriefResult {
  not_place?: boolean
  name: string
  city_name: string | null
  brief: SpotBrief | null
  brief_source: string | null
  brief_updated_at: string | null
  brief_confidence: number | null
  alts: SpotAlt[]
  cached?: boolean
}

export function requestSpotBrief(name: string, city?: string): Promise<SpotBriefResult> {
  // 现生成要走一次 LLM，可能比普通接口慢，单独放宽超时
  return request<SpotBriefResult>({
    url: '/v1/spot-brief',
    method: 'POST',
    data: { name, city },
    timeout: 30000,
  })
}

/** 热门景点。cityId 可选：不传返回全部城市，传了按城市过滤 */
export function getCitySpots(cityId?: string): Promise<CitySpot[]> {
  return request<CitySpot[]>({ url: '/v1/city-spots', method: 'GET', params: cityId ? { city_id: cityId } : {} })
}
