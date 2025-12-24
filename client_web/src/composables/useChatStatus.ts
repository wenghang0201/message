/**
 * 聊天状态 Composable
 * 集中管理单聊的在线状态逻辑
 *
 * 从 ChatListItem 和 ChatDetail 提取的公共逻辑
 */

import { computed, type Ref } from 'vue'
import type { Chat } from '@/types/chat'
import { formatLastSeen } from '@/utils/dateFormat'

export function useChatStatus(chat: Ref<Chat | undefined>) {
  /**
   * 是否在线（仅单聊）
   */
  const isOnline = computed(() =>
    chat.value?.type === 'single' && chat.value.isOnline === true
  )

  /**
   * 状态文本（在线/最后在线时间）
   */
  const statusText = computed(() => {
    if (!chat.value || chat.value.type !== 'single') return ''

    if (chat.value.isOnline) return '在线'

    if (chat.value.lastSeenAt) {
      return formatLastSeen(chat.value.lastSeenAt)
    }

    return ''
  })

  /**
   * 是否显示最后在线时间
   * 条件：单聊 + 无未读 + 不在线 + 有最后在线时间
   */
  const showLastSeen = computed(() => {
    return (
      chat.value?.type === 'single' &&
      chat.value.unreadCount === 0 &&
      !chat.value.isOnline &&
      chat.value.lastSeenAt !== undefined
    )
  })

  return {
    isOnline,
    statusText,
    showLastSeen,
  }
}
