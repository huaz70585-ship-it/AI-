import { request } from '../utils/request'

/** 某一天的天气（后端代理 Open-Meteo，无需 Key） */
export interface DayWeather {
  /** YYYY-MM-DD */
  date: string
  /** WMO 天气码 */
  code: number
  /** 中文描述，如「晴」「雷阵雨」 */
  text: string
  /** 图标 key，对应 Trip.vue 里的 WEATHER_ICONS */
  icon: string
  /** 当日最高温（℃） */
  tmax: number
  /** 当日最低温（℃） */
  tmin: number
}

export interface TripWeather {
  /** 定位到的城市名；定位不到时为 null */
  city: string | null
  days: DayWeather[]
}

/**
 * 行程每日天气：GET /v1/weather?tripId=xxx
 * 超出预报范围（免费额度只到未来 15 天）或定位失败时 days 为空数组，前端据此不显示天气。
 */
export function getTripWeather(tripId: string): Promise<TripWeather> {
  return request<TripWeather>({ url: '/v1/weather', method: 'GET', params: { tripId } })
}
