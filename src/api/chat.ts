import { streamSse } from '../utils/sse'
import { useUserStore } from '../stores/user'

// AI 对话流式接口（SSE）
export interface ChatStreamParams {
  message: string
  conversationId?: string
}

export interface ChatStreamCallbacks {
  onToken: (delta: string) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

// 返回 AbortController，调用方可在需要时中断生成
export function streamChat(
  params: ChatStreamParams,
  callbacks: ChatStreamCallbacks,
): AbortController {
  const controller = new AbortController()
  const userStore = useUserStore()
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

  streamSse({
    url: `${baseUrl}/chat/stream`,
    body: params,
    headers: userStore.token ? { Authorization: `Bearer ${userStore.token}` } : undefined,
    signal: controller.signal,
    onToken: callbacks.onToken,
    onDone: callbacks.onDone,
    onError: callbacks.onError,
  })

  return controller
}
