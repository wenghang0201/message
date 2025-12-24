import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Chat } from '@/types/chat'
import type { Message } from '@/types/message'
import conversationService from '@/services/conversation.service'
import websocketService from '@/services/websocket.service'
import type { ConversationListItem } from '@/types/api'

export const useChatStore = defineStore('chat', () => {
  const chats = ref<Chat[]>([])
  const currentChatId = ref<string | null>(null)
  const searchQuery = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 监听新会话创建事件
  websocketService.onNewConversation(async () => {
    // 刷新聊天列表以显示新会话
    await fetchConversations()
  })

  // 监听群组解散事件
  websocketService.onGroupDisbanded((data) => {
    // 更新聊天的disbandedAt时间戳
    updateChat(data.conversationId, {
      disbandedAt: new Date(data.disbandedAt).getTime(),
    })
  })

  // 将后端的 ConversationListItem 转换为前端 Chat 类型的辅助函数
  function convertToChat(item: ConversationListItem): Chat {
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      avatar: item.avatar || '',
      otherUserId: item.otherUserId,
      lastMessage: item.lastMessage ? {
        id: item.lastMessage.id,
        chatId: item.id,
        senderId: item.lastMessage.senderId,
        type: item.lastMessage.type as any,
        content: item.lastMessage.content,
        timestamp: new Date(item.lastMessage.createdAt).getTime(),
        status: 'sent' as any,
        isEdited: false,
      } : undefined,
      unreadCount: item.unreadCount,
      isPinned: item.isPinned,
      pinnedAt: item.pinnedAt ? new Date(item.pinnedAt).getTime() : undefined,
      mutedUntil: item.mutedUntil ? new Date(item.mutedUntil).getTime() : undefined,
      disbandedAt: item.disbandedAt ? new Date(item.disbandedAt).getTime() : undefined,
      isOnline: item.isOnline,
      lastSeenAt: item.lastSeenAt ? new Date(item.lastSeenAt).getTime() : undefined,
      createdAt: new Date(item.createdAt).getTime(),
      updatedAt: new Date(item.updatedAt).getTime(),
    }
  }

  const sortedChats = computed(() => {
    return [...chats.value].sort((a, b) => {
      // 置顶的聊天优先显示
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1

      // 如果都是置顶或都不是置顶，按更新时间排序
      return b.updatedAt - a.updatedAt
    })
  })

  const filteredChats = computed(() => {
    if (!searchQuery.value.trim()) {
      return sortedChats.value
    }

    const query = searchQuery.value.toLowerCase()
    return sortedChats.value.filter(chat => {
      return chat.name.toLowerCase().includes(query) ||
             chat.lastMessage?.content.toLowerCase().includes(query)
    })
  })

  const currentChat = computed(() => {
    return chats.value.find(c => c.id === currentChatId.value)
  })

  const totalUnreadCount = computed(() => {
    return chats.value.reduce((sum, chat) => sum + chat.unreadCount, 0)
  })

  function getChatById(chatId: string): Chat | undefined {
    return chats.value.find(c => c.id === chatId)
  }

  // 操作
  function loadChats(chatList: Chat[]) {
    chats.value = chatList
  }

  function addChat(chat: Chat) {
    chats.value.unshift(chat)
  }

  function updateChat(chatId: string, updates: Partial<Chat>) {
    const index = chats.value.findIndex(c => c.id === chatId)
    if (index !== -1) {
      chats.value[index] = {
        ...chats.value[index],
        ...updates,
      }
    }
  }

  function updateLastMessage(chatId: string, message: Message) {
    const chat = chats.value.find(c => c.id === chatId)
    if (chat) {
      chat.lastMessage = message
      chat.updatedAt = message.timestamp
    }
  }

  function deleteChat(chatId: string) {
    const index = chats.value.findIndex(c => c.id === chatId)
    if (index !== -1) {
      chats.value.splice(index, 1)
    }
  }

  function markAsRead(chatId: string) {
    const chat = chats.value.find(c => c.id === chatId)
    if (chat) {
      chat.unreadCount = 0
    }
  }

  function incrementUnread(chatId: string) {
    const chat = chats.value.find(c => c.id === chatId)
    if (chat) {
      chat.unreadCount++
    }
  }

  function setCurrentChatId(chatId: string | null) {
    currentChatId.value = chatId
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  // 从 API 获取会话列表
  async function fetchConversations() {
    isLoading.value = true
    error.value = null
    try {
      const apiConversations = await conversationService.getConversations()
      chats.value = apiConversations.map(convertToChat)
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch conversations'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 创建或获取与其他用户的单聊
  async function createOrGetChat(otherUserId: string): Promise<string> {
    try {
      const result = await conversationService.getOrCreateSingle(otherUserId)
      // 刷新会话列表以获取新的或现有的聊天
      await fetchConversations()
      return result.id
    } catch (err: any) {
      error.value = err.message || 'Failed to create conversation'
      throw err
    }
  }

  // 标记会话为已读
  async function markConversationAsRead(conversationId: string, messageId?: string) {
    try {
      await conversationService.markAsRead(conversationId, messageId)
      markAsRead(conversationId)
    } catch (err: any) {
      error.value = err.message || 'Failed to mark as read'
      throw err
    }
  }

  // 删除会话
  async function removeConversation(conversationId: string) {
    try {
      await conversationService.deleteConversation(conversationId)
      deleteChat(conversationId)
    } catch (err: any) {
      error.value = err.message || 'Failed to delete conversation'
      throw err
    }
  }

  // 切换会话置顶
  async function togglePinConversation(conversationId: string) {
    try {
      const chat = chats.value.find(c => c.id === conversationId)
      if (!chat) {
        throw new Error('聊天不存在')
      }

      // 检查置顶数量限制（最多5个）
      const pinnedCount = chats.value.filter(c => c.isPinned).length
      if (!chat.isPinned && pinnedCount >= 5) {
        throw new Error('最多只能置顶5个聊天')
      }

      await conversationService.togglePin(conversationId)

      // 更新本地状态
      updateChat(conversationId, {
        isPinned: !chat.isPinned,
        pinnedAt: !chat.isPinned ? Date.now() : undefined,
      })
    } catch (err: any) {
      error.value = err.message || 'Failed to toggle pin'
      throw err
    }
  }

  // 静音会话
  async function muteConversation(conversationId: string, duration?: number) {
    try {
      const chat = chats.value.find(c => c.id === conversationId)
      if (!chat) {
        throw new Error('聊天不存在')
      }

      await conversationService.setMute(conversationId, duration)

      // 更新本地状态
      let mutedUntil: number | undefined
      if (duration && duration > 0) {
        mutedUntil = Date.now() + duration * 1000
      } else {
        // 永久静音：设置为MySQL TIMESTAMP的最大值 (2038-01-19)
        mutedUntil = new Date('2038-01-19 03:14:07').getTime()
      }

      updateChat(conversationId, {
        mutedUntil,
      })
    } catch (err: any) {
      error.value = err.message || 'Failed to mute conversation'
      throw err
    }
  }

  // 取消会话静音
  async function unmuteConversation(conversationId: string) {
    try {
      const chat = chats.value.find(c => c.id === conversationId)
      if (!chat) {
        throw new Error('聊天不存在')
      }

      await conversationService.unmute(conversationId)

      // 更新本地状态
      updateChat(conversationId, {
        mutedUntil: undefined,
      })
    } catch (err: any) {
      error.value = err.message || 'Failed to unmute conversation'
      throw err
    }
  }

  // 更新用户在线状态
  function updateUserOnlineStatus(userId: string, isOnline: boolean, lastSeenAt?: number) {
    // 查找所有与该用户的单聊会话
    chats.value.forEach(chat => {
      if (chat.type === 'single' && chat.otherUserId === userId) {
        chat.isOnline = isOnline
        // 如果用户上线，清除 lastSeenAt；如果下线，更新为新的时间戳
        if (isOnline) {
          chat.lastSeenAt = undefined
        } else if (lastSeenAt !== undefined) {
          chat.lastSeenAt = lastSeenAt
        }
      }
    })
  }

  return {
    chats,
    currentChatId,
    searchQuery,
    isLoading,
    error,
    sortedChats,
    filteredChats,
    currentChat,
    totalUnreadCount,
    getChatById,
    loadChats,
    addChat,
    updateChat,
    updateLastMessage,
    deleteChat,
    markAsRead,
    incrementUnread,
    setCurrentChatId,
    setSearchQuery,
    fetchConversations,
    createOrGetChat,
    markConversationAsRead,
    removeConversation,
    togglePinConversation,
    muteConversation,
    unmuteConversation,
    updateUserOnlineStatus,
  }
})
