/**
 * 聊天助手工具类
 * 提供聊天相关的通用辅助函数
 */

import type { Chat } from '@/types/chat'
import { UI_LIMITS } from '@/constants/ui-limits'

/**
 * 判断是否为单聊
 */
export function isSingleChat(chat: Chat): boolean {
  return chat.type === 'single'
}

/**
 * 判断是否为群聊
 */
export function isGroupChat(chat: Chat): boolean {
  return chat.type === 'group'
}

/**
 * 判断聊天是否已免打扰
 */
export function isChatMuted(chat: Chat): boolean {
  return !!chat.mutedUntil && chat.mutedUntil > Date.now()
}

/**
 * 格式化未读消息数（超过99显示99+）
 */
export function formatUnreadCount(count: number): string {
  return count > UI_LIMITS.UNREAD_COUNT_MAX ? '99+' : count.toString()
}
