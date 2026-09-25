import type { DayWeather } from '../api/weather'

/**
 * 天气提醒（规则版，零 token、毫秒级）：
 * 雨/雪/雾/极端温度才给一句话，正常天气返回 null —— 有事说事，无事沉默。
 * 阈值刻意保守，宁可少提醒也不要天天弹；文案里不点具体景点名，
 * 因为 trip_items 没有「室内 / 户外」标注，AI 凭名字猜会翻车。
 */
export function weatherAlertText(w: DayWeather | undefined): string | null {
  if (!w) return null
  // 雷阵雨最重：建议改室内，不只是带伞
  if (w.icon === 'thunder') return `今天${w.text}，尽量安排室内项目，户外活动备好雨具`
  if (w.icon === 'rain') return `今天${w.text}，记得带伞，户外项目留意`
  if (w.icon === 'drizzle') return `今天${w.text}，带把伞更稳妥`
  if (w.icon === 'snow') return `今天${w.text}，路面湿滑，尽量选室内项目，交通多预留时间`
  if (w.icon === 'fog') return `今天有雾，打车/自驾可能减速，行程衔接预留余量`
  if (w.tmax >= 35) return `今天最高 ${w.tmax}°，注意防晒补水，户外安排尽量放早晚`
  if (w.tmin <= 3) return `今天最低 ${w.tmin}°，注意保暖`
  return null
}
