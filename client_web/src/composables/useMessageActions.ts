/**
 * 消息操作 Composable
 * 集中管理消息可用操作的逻辑
 *
 * 从 ChatDetail 提取的消息操作计算逻辑
 */

import { computed, type Ref } from 'vue'
import type { Message } from '@/types/message'
import { TIME_CONSTANTS } from '@/constants/uiLimits'

interface MessageAction {
  name: string
  icon: string
}

export function useMessageActions(
  message: Ref<Message | undefined>,
  currentUserId: Ref<string>
) {
  /**
   * 是否可以删除消息
   * 条件：是自己发送的 + 在5分钟删除窗口内
   */
  const canDelete = computed(() => {
    if (!message.value || message.value.senderId !== currentUserId.value) {
      return false
    }

    const now = Date.now()
    const messageTime = message.value.timestamp
    return now - messageTime <= TIME_CONSTANTS.MESSAGE_DELETE_WINDOW
  })

  /**
   * 是否可以编辑消息
   * 条件：是自己发送的 + 文本消息 + 未被撤回
   */
  const canEdit = computed(() => {
    if (!message.value || message.value.isRecalled) return false
    return (
      message.value.senderId === currentUserId.value &&
      message.value.type === 'text'
    )
  })

  /**
   * 可用的消息操作列表
   */
  const actions = computed<MessageAction[]>(() => {
    if (!message.value) return []

    const result: MessageAction[] = []

    // 复制（文本消息且可编辑时）
    if (canEdit.value && message.value.type === 'text') {
      result.push({ name: '复制', icon: 'notes-o' })
    }

    // 回复（未被撤回）
    if (!message.value.isRecalled) {
      result.push({ name: '回复', icon: 'chat-o' })
    }

    // 转发（未被撤回）
    if (!message.value.isRecalled) {
      result.push({ name: '转发', icon: 'share-o' })
    }

    // 编辑（可编辑时）
    if (canEdit.value) {
      result.push({ name: '编辑', icon: 'edit' })
    }

    // 多选（未被撤回）
    if (!message.value.isRecalled) {
      result.push({ name: '多选', icon: 'checkbox-marked' })
    }

    // 删除（可删除时）
    if (canDelete.value) {
      result.push({ name: '删除', icon: 'delete-o' })
    }

    return result
  })

  return {
    canDelete,
    canEdit,
    actions,
  }
}
