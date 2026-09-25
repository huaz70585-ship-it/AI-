/**
 * 大模型一次性调用（非流式）。
 *
 * 与 chat.js 的流式通道分开：交通衔接这类任务只要一个完整 JSON，
 * 非流式实现更简单（不用解 SSE），实测延迟也在 200-500ms，够用。
 * 配置与 chat.js 同源（AI_BASE_URL / AI_API_KEY / AI_MODEL）。
 *
 * 注意：环境变量在【函数内】读取，不在模块顶层 —— 否则和 dotenv.config() 的
 * 加载顺序耦合，一旦本模块先于 db.js 求值就会读到空值。
 */

/** 运行时读取配置 */
export function aiConfig() {
  return {
    baseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'deepseek-chat',
  }
}

export const aiReady = () => Boolean(aiConfig().apiKey)

/**
 * 调一次大模型，返回纯文本内容。
 * temperature 默认 0：交通方案要的是稳定结论，不是创意。
 */
export async function chatOnce(messages, { temperature = 0, timeoutMs = 15_000 } = {}) {
  const { baseUrl, apiKey, model } = aiConfig()
  if (!apiKey) throw new Error('AI_API_KEY 未配置')

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: false, temperature }),
      signal: ac.signal,
    })
    if (!res.ok) throw new Error(`上游 HTTP ${res.status}`)
    const json = await res.json()
    return json.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }
}

/** 从模型输出里抠出第一个 JSON 对象（容忍 ```json 包裹与前后废话） */
export function extractJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}
