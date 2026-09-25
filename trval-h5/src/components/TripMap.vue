<script setup lang="ts">
/**
 * 行程地图（腾讯地图 GL JS）
 *
 * 坐标来自后端 `trip_items.latitude/longitude`（由 `backend/src/utils/geo.js` 回填，GCJ-02），
 * 前端只负责画。地理编码不在前端做 —— 腾讯 `region` 是软过滤，会把外省同名点带进来，
 * 校验必须在落库前完成（见 geo.js 的省级校验）。
 *
 * 合规：国内产品只能用腾讯 / 高德 / 百度 / 天地图；此处用腾讯地图 GL JS。
 * **Key 由用户自行申请**，从 `VITE_TMAP_KEY` 读，代码里绝不写死任何可用 Key。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { TripGeoStatus, TripItem } from '../api/travel'

const props = withDefaults(defineProps<{ items: TripItem[]; height?: number }>(), {
  height: 300,
})

/** 腾讯位置服务（lbs.qq.com）申请的 Key，写进 `trval-h5/.env.local` */
const TMAP_KEY = String(import.meta.env.VITE_TMAP_KEY ?? '').trim()

const KEY_HELP = '请在腾讯位置服务开放平台（lbs.qq.com）申请 Key，写入 trval-h5/.env.local 的 VITE_TMAP_KEY'

type GeoPoint = { id: string; title: string; time: string; lat: number; lng: number; seq: number }

function hasCoord(it: TripItem): boolean {
  return typeof it.latitude === 'number' && typeof it.longitude === 'number'
}

/** 可打点的项：坐标齐全，按行程顺序编号（抽象项 / 未定位项自动排除） */
const points = computed<GeoPoint[]>(() =>
  props.items.filter(hasCoord).map((it, i) => ({
    id: it.id,
    title: it.title,
    time: it.start_time,
    lat: it.latitude as number,
    lng: it.longitude as number,
    seq: i + 1,
  })),
)

/** 没打上点的项，连同原因一起列出来 —— 别让用户以为安排丢了 */
const unlocated = computed(() =>
  props.items
    .filter((it) => !hasCoord(it))
    .map((it) => ({ id: it.id, title: it.title, reason: geoReason(it.geo_status) })),
)

function geoReason(status: TripGeoStatus | null | undefined): string {
  if (status === 'miss') return '查无此地'
  if (status === 'city_mismatch') return '定位存疑'
  return '无需定位'
}

// ── 地图渲染 ────────────────────────────────────────────
const el = ref<HTMLDivElement | null>(null)
const mapError = ref('')
const mapRef = shallowRef<any>(null)
let markers: any = null
let line: any = null

/** 序号图标：内联 SVG（官方 demo 图片不允许引用），数据 URI 塞进 MarkerStyle.src */
function pinIcon(n: number): string {
  // data URI 吃不到 CSS 变量，色值与 tokens.css 的 --c-brand (#0e7c86) 手工同步
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">' +
    '<path d="M14 1C7 1 1.5 6.4 1.5 13.4 1.5 22 14 33 14 33s12.5-11 12.5-19.6C26.5 6.4 21 1 14 1Z" ' +
    'fill="#0e7c86" stroke="#ffffff" stroke-width="1.6"/>' +
    '<circle cx="14" cy="13.4" r="7.6" fill="#ffffff"/>' +
    `<text x="14" y="17.4" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" ` +
    `fill="#0e7c86" text-anchor="middle">${n}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/** 预建 1..30 号样式：切天时只换 geometries，不重建样式，少一次闪烁 */
const PIN_STYLES: Record<string, any> = {}
const MAX_PINS = 30

let sdkPromise: Promise<any> | null = null
/** 动态加载 SDK（GL JS 单例；多个实例只加载一次） */
function loadSDK(key: string): Promise<any> {
  const w = window as any
  if (w.TMap) return Promise.resolve(w.TMap)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    // 只加载官方 CDN，不带任何 styleId / libraries 之外的参数
    s.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`
    s.async = true
    s.onload = () => (w.TMap ? resolve(w.TMap) : reject(new Error('地图脚本已加载但 TMap 未就绪')))
    s.onerror = () => reject(new Error('地图脚本加载失败，请检查网络或 Key 是否有效'))
    document.head.appendChild(s)
  })
  return sdkPromise
}

/**
 * 视野自适应。注意：GL JS 的 fitBounds 在本场景有渲染兼容问题 —— 实测两轮
 * （双参 LatLngBounds + setCenter 补正）底图与连线正常，但 MultiMarker 的 pin 全部不渲染；
 * 而 setCenter + setZoom 路径 pin 渲染正常。所以回退手算 zoom，用标准 Web Mercator
 * 公式求「恰好框住全部点」的级别，不再用粗档位（粗档位曾把点挤出画面）。
 */
function focusOn(TMap: any, map: any, list: GeoPoint[]) {
  const lats = list.map((p) => p.lat)
  const lngs = list.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  map.setCenter(new TMap.LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2))
  if (list.length === 1) {
    map.setZoom(14)
    return
  }
  // Web Mercator：地面分辨率(米/像素) = 40075016.686 * cos(lat) / (256 * 2^zoom)
  // 求最大 zoom 使 span * 1.5（留边） ≤ 容器宽 * 分辨率，再向下取整保证全覆盖
  const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180
  const spanM =
    Math.max(maxLat - minLat, (maxLng - minLng) * Math.cos(midLatRad)) * 111320 * 1.5
  const wPx = (map.getContainer && map.getContainer().clientWidth) || 375
  const z = Math.floor(Math.log2((wPx * 40075016.686 * Math.cos(midLatRad)) / (256 * spanM)))
  map.setZoom(Math.max(3, Math.min(20, z)))
}

function teardownOverlays() {
  if (markers) {
    markers.setMap(null)
    markers = null
  }
  if (line) {
    line.setMap(null)
    line = null
  }
}

async function render() {
  await nextTick()
  if (!TMAP_KEY || !points.value.length || !el.value) return
  const list = points.value
  try {
    const TMap = await loadSDK(TMAP_KEY)
    if (!mapRef.value) {
      mapRef.value = new TMap.Map(el.value, {
        zoom: 12,
        center: new TMap.LatLng(list[0].lat, list[0].lng),
      })
    }
    const map = mapRef.value
    mapError.value = ''

    for (let n = 1; n <= MAX_PINS; n++) {
      if (!PIN_STYLES[n]) {
        PIN_STYLES[n] = new TMap.MarkerStyle({
          width: 28,
          height: 34,
          anchor: { x: 14, y: 34 },
          src: pinIcon(n),
        })
      }
    }
    const usedStyles: Record<string, any> = {}
    const geoms = list.map((p) => {
      const sid = 'pin' + p.seq
      usedStyles[sid] = PIN_STYLES[Math.min(p.seq, MAX_PINS)]
      return { id: p.id, styleId: sid, position: new TMap.LatLng(p.lat, p.lng) }
    })

    teardownOverlays()
    markers = new TMap.MultiMarker({ map, styles: usedStyles, geometries: geoms })
    if (list.length > 1) {
      line = new TMap.MultiPolyline({
        map,
        styles: {
          route: new TMap.PolylineStyle({
            color: '#0e7c86', // 与 tokens.css 的 --c-brand 同步（TMap API 收 JS 字符串）
            width: 4,
            borderWidth: 2, // 只接受整数（实测小数会被判「属性无效」）
            borderColor: '#ffffff',
          }),
        },
        geometries: [{ id: 'route', styleId: 'route', paths: list.map((p) => new TMap.LatLng(p.lat, p.lng)) }],
      })
    }
    focusOn(TMap, map, list)
  } catch (e) {
    mapError.value = e instanceof Error ? e.message : '地图加载失败'
  }
}

watch(points, () => render())
onMounted(() => render())
onBeforeUnmount(() => {
  teardownOverlays()
  if (mapRef.value) {
    mapRef.value.destroy()
    mapRef.value = null
  }
})
</script>

<template>
  <div class="map">
    <!-- 地图画布：未配 Key / 当天无可打点项时给明确说明，不白屏 -->
    <div v-if="!TMAP_KEY" class="map__fallback">
      <van-icon name="location-o" />
      <p class="map__fb-title">地图未启用</p>
      <p class="map__fb-hint">{{ KEY_HELP }}</p>
    </div>
    <div v-else-if="!points.length" class="map__fallback">
      <van-icon name="location-o" />
      <p class="map__fb-title">这一天还没有可定位的地点</p>
      <p class="map__fb-hint">抵达 / 返程这类安排不在地图上打点</p>
    </div>
    <template v-else>
      <div ref="el" class="map__canvas" :style="{ height: height + 'px' }"></div>
      <p v-if="mapError" class="map__err">{{ mapError }}</p>
    </template>

    <!-- 点位清单：地图没出来也有用 -->
    <ol v-if="points.length" class="map__list">
      <li v-for="p in points" :key="p.id">
        <span class="map__seq">{{ p.seq }}</span>
        <span class="map__name">{{ p.title }}</span>
        <span class="map__time">{{ p.time }}</span>
      </li>
    </ol>
    <ul v-if="unlocated.length" class="map__list map__list--dim">
      <li v-for="u in unlocated" :key="u.id">
        <span class="map__seq map__seq--dim">–</span>
        <span class="map__name">{{ u.title }}</span>
        <span class="map__reason">{{ u.reason }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.map {
  padding: 0 20px;
}
.map__canvas {
  width: 100%;
  border-radius: var(--radius-panel);
  overflow: hidden;
  background: #eef1f5;
  box-shadow: var(--shadow-card);
}
.map__err {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--c-money);
  text-align: center;
}
.map__fallback {
  padding: 26px 18px;
  border-radius: var(--radius-card);
  background: var(--c-card);
  box-shadow: var(--shadow-card);
  text-align: center;
}
.map__fallback :deep(.van-icon) {
  font-size: 26px;
  color: var(--c-brand);
  opacity: 0.6;
}
.map__fb-title {
  margin: 8px 0 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--c-text);
}
.map__fb-hint {
  margin: 5px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--c-sub);
}
.map__list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  background: var(--c-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.map__list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--c-text);
}
.map__list li + li {
  border-top: 0.5px solid rgba(10, 26, 43, 0.06);
}
.map__seq {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--c-brand);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  display: grid;
  place-items: center;
}
.map__seq--dim {
  background: transparent;
  color: var(--c-sub);
}
.map__name {
  flex: 1;
  min-width: 0;
}
.map__time {
  flex: none;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}
.map__reason {
  flex: none;
  font-size: 11px;
  color: var(--c-sub);
}
.map__list--dim li,
.map__list--dim .map__name {
  color: var(--c-sub);
}
</style>
