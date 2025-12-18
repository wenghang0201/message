<template>
  <div class="chat-list-view">
    <NavBar
      title="聊天"
      fixed
    >
      <template #right>
        <van-icon name="plus" size="20" color="var(--van-text-color)" @click="showActionSheet = true" />
      </template>
    </NavBar>

    <van-search
      v-model="searchQuery"
      placeholder="搜索..."
      @update:model-value="handleSearch"
    />

    <van-action-sheet
      v-model:show="showActionSheet"
      :actions="actions"
      cancel-text="取消"
      close-on-click-action
      @select="onSelectAction"
    />

    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
      :style="{ minHeight: 'calc(100dvh - 46px - 54px)' }"
    >
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="onLoad"
      >
        <div v-if="filteredChats.length > 0">
          <ChatListItem
            v-for="chat in filteredChats"
            :key="chat.id"
            :chat="chat"
            @delete="handleDelete"
            @pin="handlePin"
            @mute="handleMute"
          />
        </div>

        <EmptyState
          v-else-if="!loading"
          description="暂无聊天记录"
          image="search"
        />
      </van-list>
    </van-pull-refresh>

    <TabBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { showDialog } from 'vant'
import { showNotify } from '@/utils/notify'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import websocketService from '@/services/websocket.service'
import type { MessageType, MessageStatus } from '@/types/message'
import NavBar from '@/components/common/NavBar.vue'
import ChatListItem from '@/components/chat/ChatListItem.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import TabBar from '@/components/common/TabBar.vue'

const router = useRouter()

const chatStore = useChatStore()
const authStore = useAuthStore()
const { filteredChats } = storeToRefs(chatStore)

const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const showActionSheet = ref(false)
const searchQuery = ref('')

const actions = [
  { name: '新增群聊', value: 'create-group' },
]

let unsubscribeMessageRead: (() => void) | null = null
let unsubscribeNewMessage: (() => void) | null = null
let unsubscribeGroupNameUpdated: (() => void) | null = null
let unsubscribeGroupAvatarUpdated: (() => void) | null = null
let unsubscribeUserStatusChanged: (() => void) | null = null

onMounted(async () => {
  // 只在第一次加载时获取数据，后续依赖 WebSocket 更新和用户手动刷新
  // 避免每次返回列表都重新获取，导致覆盖已经标记为已读的本地状态
  if (chatStore.chats.length === 0) {
    await loadChats()
  } else {
    // 如果已有数据，直接标记为完成加载
    finished.value = true
  }

  // 监听消息已读事件，更新未读计数
  unsubscribeMessageRead = websocketService.onMessageRead((data) => {
    // 如果是当前用户标记为已读，更新对应会话的未读计数
    if (data.userId === authStore.userId) {
      chatStore.markAsRead(data.conversationId)
    }
  })

  // 监听新消息事件，更新未读计数和最后一条消息
  unsubscribeNewMessage = websocketService.onMessage((message) => {
    // 转换后端消息格式为前端格式
    const frontendMessage = {
      id: message.id,
      chatId: message.conversationId,
      senderId: message.senderId,
      type: message.type as MessageType,
      content: message.content,
      timestamp: new Date(message.createdAt).getTime(), // 转换 ISO 字符串为时间戳
      status: 'sent' as MessageStatus,
      isEdited: !!message.editedAt,
      replyTo: message.replyToMessageId || undefined,
    }

    // 更新最后一条消息
    chatStore.updateLastMessage(message.conversationId, frontendMessage)

    // 如果消息不是当前用户发送的，增加未读计数
    if (message.senderId !== authStore.userId) {
      chatStore.incrementUnread(message.conversationId)
    }
  })

  // 监听群名称更新事件
  unsubscribeGroupNameUpdated = websocketService.onGroupNameUpdated((data) => {
    // 更新聊天列表中的群名称
    chatStore.updateChat(data.conversationId, {
      name: data.name,
    })
  })

  // 监听群头像更新事件
  unsubscribeGroupAvatarUpdated = websocketService.onGroupAvatarUpdated((data) => {
    // 更新聊天列表中的群头像
    chatStore.updateChat(data.conversationId, {
      avatar: data.avatarUrl,
    })
  })

  // 监听用户状态变化事件
  unsubscribeUserStatusChanged = websocketService.onUserStatusChanged((data) => {
    // 更新对应用户的在线状态
    chatStore.updateUserOnlineStatus(data.userId, data.isOnline, data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : undefined)
  })
})

onBeforeUnmount(() => {
  if (unsubscribeMessageRead) {
    unsubscribeMessageRead()
  }
  if (unsubscribeNewMessage) {
    unsubscribeNewMessage()
  }
  if (unsubscribeGroupNameUpdated) {
    unsubscribeGroupNameUpdated()
  }
  if (unsubscribeGroupAvatarUpdated) {
    unsubscribeGroupAvatarUpdated()
  }
  if (unsubscribeUserStatusChanged) {
    unsubscribeUserStatusChanged()
  }
})

const loadChats = async () => {
  try {
    loading.value = true
    await chatStore.fetchConversations()
    finished.value = true
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '加载聊天记录失败',
    })
  } finally {
    loading.value = false
  }
}

const onLoad = async () => {
  finished.value = true
}

const onRefresh = async () => {
  refreshing.value = true
  await loadChats()
  refreshing.value = false
  showNotify({
    type: 'success',
    message: '刷新成功',
  })
}

const handleSearch = (value: string) => {
  chatStore.setSearchQuery(value)
}

const handlePin = async (chatId: string) => {
  try {
    await chatStore.togglePinConversation(chatId)
    const chat = chatStore.getChatById(chatId)
    showNotify({
      type: 'success',
      message: chat?.isPinned ? '已置顶' : '已取消置顶',
    })
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '操作失败',
    })
  }
}

const handleMute = async (chatId: string) => {
  const chat = chatStore.getChatById(chatId)
  if (!chat) return

  // 检查是否已静音
  const isMuted = chat.mutedUntil && chat.mutedUntil > Date.now()

  if (isMuted) {
    // 取消静音
    try {
      await chatStore.unmuteConversation(chatId)
      showNotify({
        type: 'success',
        message: '已取消静音',
      })
    } catch (error: any) {
      showNotify({
        type: 'danger',
        message: error.message || '操作失败',
      })
    }
  } else {
    // 显示静音时长选项
    showDialog({
      title: '静音选项',
      message: '请选择静音时长',
      showCancelButton: true,
      confirmButtonText: '1小时',
      cancelButtonText: '永久',
    }).then(async () => {
      // 1 hour
      try {
        await chatStore.muteConversation(chatId, 3600)
        showNotify({
          type: 'success',
          message: '已静音1小时',
        })
      } catch (error: any) {
        showNotify({
          type: 'danger',
          message: error.message || '操作失败',
        })
      }
    }).catch(async () => {
      // 永久
      try {
        await chatStore.muteConversation(chatId)
        showNotify({
          type: 'success',
          message: '已永久静音',
        })
      } catch (error: any) {
        showNotify({
          type: 'danger',
          message: error.message || '操作失败',
        })
      }
    })
  }
}

const handleDelete = async (chatId: string) => {
  showDialog({
    title: '删除聊天',
    message: '确定要删除这个聊天吗？',
    showCancelButton: true,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await chatStore.removeConversation(chatId)
      showNotify({
        type: 'success',
        message: '聊天已删除',
      })
    } catch (error) {
      showNotify({
        type: 'danger',
        message: '删除聊天失败',
      })
    }
  }).catch(() => {
    // 用户取消
  })
}

const onSelectAction = (action: { name: string; value: string }) => {
  if (action.value === 'create-group') {
    router.push('/create-group')
  }
}
</script>

<style scoped>
.chat-list-view {
  height: 100dvh;
  background-color: var(--chat-background, #f7f8fa);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
