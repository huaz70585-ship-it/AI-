import { request } from '../utils/request'

/** 交通方式（后端已收敛到这个枚举，未知一律 unknown） */
export type HopMode = 'walk' | 'bus' | 'metro' | 'taxi' | 'bike' | 'coach' | 'unknown'

/** 相邻两个行程项之间的一段交通衔接 */
export interface TripHop {
  from_item_id: string
  to_item_id: string
  from_title: string
  to_title: string
  /** AI 未生成或生成失败时为 null，前端据此不渲染这一段 */
  mode: HopMode | null
  duration_min: number | null
  cost_ref: number | null
  tip: string
  source: string | null
  /**
   * 'return' = 这一段是「当天最后一站 → 返程」。
   * 返程项本身没有地名（就写「返程」两个字），后端按「当地的火车站 / 机场」
   * 这个占位语义估的时长，前端据此把目标写成「车站 / 机场」。其余段为 null。
   */
  kind?: 'return' | null
}

export interface TripHops {
  trip_id: string
  day: number
  hops: TripHop[]
  /** 当日交通合计（仅展示用，不计入行程总预算） */
  total_cost: number
  total_min: number
  /** 'AI 未配置' / 'AI 暂时不可用'；正常为 null */
  ai_error: string | null
}

/**
 * 某天相邻行程项之间的交通衔接：GET /v1/trip/:id/hops?day=N
 * 后端缓存优先，命中时毫秒级返回；首次访问会调一次大模型（约 1 秒）。
 * 失败时 hops 里的 mode 为 null，前端静默不展示，不影响主流程。
 */
export function getTripHops(tripId: string, day: number): Promise<TripHops> {
  return request<TripHops>({ url: `/v1/trip/${tripId}/hops`, method: 'GET', params: { day } })
}
