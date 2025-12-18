import type { Message } from './message'

export interface Chat {
  id: string
  type: 'single' | 'group'
  name: string          // 联系人名称或群组名称
  avatar: string
  otherUserId?: string   // 私聊中的另一个用户（仅限单聊）
  lastMessage?: Message
  unreadCount: number
  isPinned?: boolean     // 聊天是否置顶
  pinnedAt?: number      // 聊天置顶时间
  mutedUntil?: number    // 聊天静音过期时间（时间戳）
  disbandedAt?: number   // 群组解散时间（时间戳）
  isOnline?: boolean     // 用户是否在线（仅限单聊）
  lastSeenAt?: number    // 用户最后在线时间（仅限单聊）
  createdAt: number
  updatedAt: number
}
