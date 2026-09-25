/**
 * 统一响应信封：{ code, data, message }
 * 前端 request.ts 约定 code === 0 || 200 时解包 data
 */
export const success = (data, message = 'ok') => ({ code: 0, data, message })
export const fail = (message, code = 500, data = null) => ({ code, data, message })

/** Express 响应快捷方法 */
export const ok = (res, data, message) => res.json(success(data, message))
export const err = (res, message, code = 400) => res.status(code >= 400 ? code : 400).json(fail(message, code))
