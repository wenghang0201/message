import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message } from '@/types/message'
import { MessageStatus } from '@/types/message'
import messageService from '@/services/message.service'
import websocketService from '@/services/websocket.service'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

export const useMessageStore = defineStore('message', () => {
  // 状态
  const messagesByChatId = ref<Record<string, Message[]>>({})
  const isLoadingMore = ref(false)
  const hasMore = ref<Record<string, boolean>>({})
  const currentPage = ref<Record<string, number>>({})
  const error = ref<string | null>(null)

  // 设置 WebSocket 监听器
  websocketService.onMessage((message: any) => {
    // 将后端消息格式转换为前端格式
    const newMessage: Message = {
      id: message.id,
      chatId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      timestamp: new Date(message.createdAt).getTime(),
      status: MessageStatus.DELIVERED, // 通过 WebSocket 接收的新消息已送达
      isEdited: !!message.editedAt,
      isForwarded: message.isForwarded || false,
      replyTo: message.replyToMessageId || undefined,
    }

    // 检查消息是否已存在（避免重复）
    const exists = getMessageById(newMessage.id)
    if (!exists) {
      addMessage(newMessage)
    }
  })

  websocketService.onMessageDeleted((messageId: string) => {
    deleteMessage(messageId)
  })

  websocketService.onMessageRead((data) => {
    // 只有当其他人（非当前用户）阅读消息时才标记为已读
    const authStore = useAuthStore()
    const currentUserId = authStore.userId

    // 如果阅读者不是当前用户，查找消息并标记为已读
    // 这确保我们只显示我们发送的消息被其他人阅读的回执
    if (data.userId !== currentUserId) {
      const message = getMessageById(data.messageId)
      // 只有当这是我们发送的消息时才更新
      if (message && message.senderId === currentUserId) {
        updateMessage(data.messageId, { status: MessageStatus.READ })
      }
    }
  })

  // 获取器
  function getMessages(chatId: string): Message[] {
    return messagesByChatId.value[chatId] || []
  }

  function getMessageById(messageId: string): Message | undefined {
    for (const messages of Object.values(messagesByChatId.value)) {
      const message = messages.find(m => m.id === messageId)
      if (message) return message
    }
    return undefined
  }

  // 操作
  function loadMessages(chatId: string, messages: Message[]) {
    messagesByChatId.value[chatId] = messages.sort((a, b) => a.timestamp - b.timestamp)
  }

  function addMessage(message: Message) {
    const chatId = message.chatId
    if (!messagesByChatId.value[chatId]) {
      messagesByChatId.value[chatId] = []
    }
    messagesByChatId.value[chatId].push(message)

    // 更新聊天存储的最后一条消息
    const chatStore = useChatStore()
    chatStore.updateLastMessage(chatId, message)
  }

  function updateMessage(messageId: string, updates: Partial<Message>) {
    for (const chatId in messagesByChatId.value) {
      const messages = messagesByChatId.value[chatId]
      const index = messages.findIndex(m => m.id === messageId)
      if (index !== -1) {
        // 创建新数组以确保 Vue 响应式更新
        const updatedMessages = [...messages]
        updatedMessages[index] = {
          ...messages[index],
          ...updates,
        }
        messagesByChatId.value[chatId] = updatedMessages
        break
      }
    }
  }

  function deleteMessage(messageId: string) {
    for (const chatId in messagesByChatId.value) {
      const messages = messagesByChatId.value[chatId]
      const index = messages.findIndex(m => m.id === messageId)
      if (index !== -1) {
        messagesByChatId.value[chatId].splice(index, 1)
        break
      }
    }
  }

  function markAsDelivered(messageId: string) {
    updateMessage(messageId, { status: MessageStatus.DELIVERED })
  }

  function markAsRead(chatId: string) {
    const messages = messagesByChatId.value[chatId]
    if (messages) {
      // 创建新数组以确保 Vue 响应式更新
      messagesByChatId.value[chatId] = messages.map(message => {
        if (message.status !== MessageStatus.READ) {
          return { ...message, status: MessageStatus.READ }
        }
        return message
      })
    }
  }

  function markChatMessagesAsRead(chatId: string, currentUserId: string) {
    const messages = messagesByChatId.value[chatId]
    if (messages) {
      // 创建新数组以确保 Vue 响应式更新
      messagesByChatId.value[chatId] = messages.map(message => {
        // 只标记其他人发送的消息为已读
        if (message.senderId !== currentUserId && message.status !== MessageStatus.READ) {
          return { ...message, status: MessageStatus.READ }
        }
        return message
      })
    }
  }

  function loadMoreMessages(chatId: string, olderMessages: Message[]) {
    if (!messagesByChatId.value[chatId]) {
      messagesByChatId.value[chatId] = []
    }
    // 在前面添加较旧的消息
    messagesByChatId.value[chatId] = [
      ...olderMessages.sort((a, b) => a.timestamp - b.timestamp),
      ...messagesByChatId.value[chatId],
    ]
  }

  // API 集成方法
  async function fetchMessages(conversationId: string, page: number = 1, limit: number = 30) {
    error.value = null
    try {
      const response = await messageService.getMessages(conversationId, page, limit)
      const authStore = useAuthStore()
      const currentUserId = authStore.userId

      // 将后端消息格式转换为前端格式
      const messages: Message[] = response.messages.map(msg => {
        let messageStatus = MessageStatus.DELIVERED

        if (msg.statuses) {
          if (msg.senderId === currentUserId) {
            // 如果这是我们发送的消息，检查其他用户的已读状态
            const otherUserStatus = msg.statuses.find(s => s.userId !== currentUserId)
            if (otherUserStatus?.status === 'read') {
              messageStatus = MessageStatus.READ
            }
          } else {
            // 如果这是其他人发送的消息，检查我们自己的已读状态
            const ourStatus = msg.statuses.find(s => s.userId === currentUserId)
            if (ourStatus?.status === 'read') {
              messageStatus = MessageStatus.READ
            }
          }
        }

        return {
          id: msg.id,
          chatId: conversationId,
          senderId: msg.senderId,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.createdAt).getTime(),
          status: messageStatus,
          isEdited: !!msg.editedAt,
          isForwarded: msg.isForwarded || false,
          replyTo: msg.replyToMessageId || undefined,
        }
      })

      if (page === 1) {
        loadMessages(conversationId, messages)
      } else {
        loadMoreMessages(conversationId, messages)
      }

      hasMore.value[conversationId] = response.hasMore
      currentPage.value[conversationId] = page

      return messages
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch messages'
      throw err
    }
  }

  async function sendMessage(conversationId: string, content: string, type: string = 'text', replyToMessageId?: string, isForwarded: boolean = false) {
    error.value = null
    try {
      const response = await messageService.sendMessage({
        conversationId,
        type,
        content,
        replyToMessageId,
        isForwarded,
      })

      // 不在这里添加消息，让 WebSocket 广播来处理
      // 这样发送者和接收者都通过相同的路径接收消息，避免重复
      const newMessage: Message = {
        id: response.id,
        chatId: conversationId,
        senderId: response.senderId,
        type: response.type,
        content: response.content,
        timestamp: new Date(response.createdAt).getTime(),
        status: MessageStatus.DELIVERED, // 消息成功发送到服务器即为已送达
        isEdited: false,
        isForwarded,
        replyTo: response.replyToMessageId || undefined,
      }
      return newMessage
    } catch (err: any) {
      error.value = err.message || '发送消息失败'
      throw err
    }
  }

  async function editMessage(messageId: string, content: string) {
    error.value = null
    try {
      const response = await messageService.updateMessage(messageId, content)
      updateMessage(messageId, {
        content: response.content,
        isEdited: true,
      })
    } catch (err: any) {
      error.value = err.message || '编辑消息失败'
      throw err
    }
  }

  async function removeMessage(messageId: string) {
    error.value = null
    try {
      await messageService.deleteMessage(messageId)
      deleteMessage(messageId)
    } catch (err: any) {
      error.value = err.message || '删除消息失败'
      throw err
    }
  }

  async function batchRemoveMessages(messageIds: string[]) {
    error.value = null
    try {
      await messageService.batchDeleteMessages(messageIds)
      // 在本地删除消息
      messageIds.forEach(messageId => {
        deleteMessage(messageId)
      })
    } catch (err: any) {
      error.value = err.message || '批量删除消息失败'
      throw err
    }
  }

  async function loadMore(conversationId: string) {
    const page = (currentPage.value[conversationId] || 1) + 1
    isLoadingMore.value = true
    try {
      await fetchMessages(conversationId, page)
    } finally {
      isLoadingMore.value = false
    }
  }

  async function forwardMessage(messageId: string, targetConversationIds: string[]) {
    error.value = null
    try {
      const message = getMessageById(messageId)
      if (!message) {
        throw new Error('消息不存在')
      }

      // 转发消息到每个目标对话
      const promises = targetConversationIds.map(conversationId =>
        sendMessage(conversationId, message.content, message.type, undefined, true)
      )

      await Promise.all(promises)
    } catch (err: any) {
      error.value = err.message || '转发消息失败'
      throw err
    }
  }

  async function batchForwardMessages(messageIds: string[], targetConversationIds: string[]) {
    error.value = null
    try {
      // 获取所有消息
      const messages = messageIds
        .map(id => getMessageById(id))
        .filter((m): m is Message => m !== undefined)

      if (messages.length === 0) {
        throw new Error('没有找到要转发的消息')
      }

      // 将每条消息转发到每个目标会话
      for (const message of messages) {
        const promises = targetConversationIds.map(conversationId =>
          sendMessage(conversationId, message.content, message.type, undefined, true)
        )
        await Promise.all(promises)
      }
    } catch (err: any) {
      error.value = err.message || '批量转发消息失败'
      throw err
    }
  }

  async function recallMessage(messageId: string) {
    error.value = null
    try {
      const message = getMessageById(messageId)
      if (!message) {
        throw new Error('消息不存在')
      }

      // 检查时间限制（5分钟）
      const now = Date.now()
      const diffMinutes = (now - message.timestamp) / 1000 / 60

      if (diffMinutes > 5) {
        throw new Error('消息发送超过5分钟，无法撤回')
      }

      await messageService.recallMessage(messageId)

      // 更新消息状态为已撤回
      updateMessage(messageId, {
        isRecalled: true,
        content: '[已撤回]',
      })
    } catch (err: any) {
      error.value = err.message || '撤回消息失败'
      throw err
    }
  }

  return {
    messagesByChatId,
    isLoadingMore,
    hasMore,
    error,
    getMessages,
    getMessageById,
    loadMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    markAsDelivered,
    markAsRead,
    markChatMessagesAsRead,
    loadMoreMessages,
    fetchMessages,
    sendMessage,
    editMessage,
    removeMessage,
    batchRemoveMessages,
    loadMore,
    forwardMessage,
    batchForwardMessages,
    recallMessage,
  }
})
