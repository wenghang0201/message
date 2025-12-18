/**
 * 格式化聊天列表的时间戳（今天、昨天或日期）
 */
export function formatChatTime(timestamp: number): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffInMs = now.getTime() - date.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  // 今天 - 显示时间
  if (diffInDays === 0 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  // 昨天
  if (diffInDays === 1 || (diffInDays === 0 && now.getDate() !== date.getDate())) {
    return 'Yesterday'
  }

  // 本周 - 显示星期几
  if (diffInDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  // 更早 - 显示日期
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * 格式化消息气泡的时间戳（带 AM/PM 的时间）
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 格式化完整的日期和时间
 */
export function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 格式化秒数为 MM:SS 或 HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * 获取相对时间（例如："5 分钟前"、"2 小时前"）
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffInSeconds = Math.floor((now - timestamp) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  }

  return formatFullDateTime(timestamp)
}
