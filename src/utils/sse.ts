// SSE 流式请求工具
// 浏览器原生 EventSource 仅支持 GET 且无法自定义 Header，
// AI 对话通常需要 POST + 鉴权，因此用 fetch + ReadableStream 自行解析 data: 行。

export interface SseOptions {
  url: string
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  // 每解析出一段增量 token（OpenAI 风格 delta.content 或纯文本）
  onToken?: (delta: string) => void
  // 每条原始 data: 消息
  onMessage?: (data: string) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

export async function streamSse(options: SseOptions): Promise<void> {
  const { url, body, headers, signal, onToken, onMessage, onError, onDone } = options
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
    if (!response.ok || !response.body) {
      throw new Error(`SSE 请求失败：HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          onDone?.()
          return
        }
        onMessage?.(data)
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
            delta?: string
          }
          const delta = json.choices?.[0]?.delta?.content ?? json.delta ?? ''
          if (delta) onToken?.(delta)
        } catch {
          // 非 JSON 的纯文本，原样吐出
          onToken?.(data)
        }
      }
    }
    onDone?.()
  } catch (err) {
    // 主动 abort 不算错误
    if ((err as Error).name === 'AbortError') return
    onError?.(err as Error)
  }
}

export default streamSse
