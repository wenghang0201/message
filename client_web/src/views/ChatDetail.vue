<template>
  <div class="chat-detail-view">
    <NavBar
      :left-arrow="!selectionMode"
      :left-text="selectionMode ? '取消' : undefined"
      fixed
      @click-left="selectionMode ? exitSelectionMode() : goBack()"
    >
      <template #title>
        <div class="chat-title-container">
          <div class="chat-title">{{ selectionMode ? `已选择 ${selectedMessageIds.size}` : chatTitle }}</div>
          <div v-if="!selectionMode && statusText" class="status-text" :class="{ online: currentChat?.isOnline }">{{ statusText }}</div>
        </div>
      </template>
      <template #right>
        <van-icon
          v-if="!selectionMode && currentChat?.type === 'group' && !currentChat?.leftAt && !currentChat?.disbandedAt"
          name="setting-o"
          size="20"
          @click="goToGroupSettings"
        />
        <template v-if="selectionMode && selectedMessageIds.size > 0">
          <van-button
            type="primary"
            size="small"
            @click="handleBatchForward"
            style="margin-right: 8px;"
          >
            转发
          </van-button>
          <van-button
            type="danger"
            size="small"
            @click="handleBatchDelete"
          >
            删除
          </van-button>
        </template>
      </template>
    </NavBar>

    <div
      ref="messageListRef"
      class="message-list"
      @scroll="handleScroll"
    >
      <van-loading v-if="loadingMessages" type="spinner" size="24" color="var(--van-primary-color)" class="loading-indicator">
        加载消息中...
      </van-loading>

      <div v-else-if="messages.length > 0">
        <div v-if="loadingMore" class="load-more-indicator">
          <van-loading size="16" color="var(--van-primary-color)" />
          <span>加载中...</span>
        </div>

        <MessageBubble
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :is-sent="message.senderId === currentUserId"
          :sender="getSender(message.senderId)"
          :selection-mode="selectionMode"
          :is-selected="selectedMessageIds.has(message.id)"
          @longpress="handleMessageLongPress"
          @toggle-selection="toggleMessageSelection(message.id)"
        />
      </div>

      <EmptyState
        v-else
        description="发送消息开始聊天"
      >
      </EmptyState>
    </div>

    <div v-if="canInteract" class="input-area">
      <MessageInput
        ref="messageInputRef"
        :editing-message="editingMessage"
        :replying-to-message="replyingToMessage"
        @send="handleSendMessage"
        @cancel-edit="handleCancelEdit"
        @cancel-reply="handleCancelReply"
        @toggle-toolbar="showToolbar = true"
        @focus="handleInputFocus"
        @voice-start="handleVoiceStart"
        @voice-move="handleVoiceMove"
        @voice-end="handleVoiceEnd"
        @pause-recording="handlePauseRecording"
        @cancel-recording="handleCancelRecording"
        @send-recording="handleSendRecording"
      />
    </div>
    <div v-else class="disabled-input-area">
      <div class="disabled-message">
        {{ currentChat?.disbandedAt ? '该群组已解散，无法发送消息' : '你已退出该群聊，无法发送消息' }}
      </div>
    </div>

    <ChatToolbar
      v-model:show="showToolbar"
      @select-image="handleSelectImage"
      @select-video="handleSelectVideo"
      @take-photo-video="handleTakePhotoVideo"
    />

    <CameraModal
      v-model:show="showCamera"
      @photo-captured="handlePhotoCaptured"
      @video-captured="handleVideoCaptured"
    />

    <van-action-sheet
      v-model:show="showMessageActions"
      :actions="messageActions"
      cancel-text="Cancel"
      @select="onMessageActionSelect"
    />

    <ForwardMessageDialog
      v-model="showForwardDialog"
      :message="selectedMessage"
      @forward="handleForwardMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showLoadingToast, closeToast } from 'vant'
import type { ActionSheetAction } from 'vant'
import { showNotify } from '@/utils/notify'
import { useChatStore } from '@/stores/chat'
import { useMessageStore } from '@/stores/message'
import { useUserStore } from '@/stores/user'
import { useAuthStore } from '@/stores/auth'
import { selectImage, selectVideo } from '@/utils/file-upload'
import uploadService from '@/services/upload.service'
import NavBar from '@/components/common/NavBar.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import ChatToolbar from '@/components/chat/ChatToolbar.vue'
import CameraModal from '@/components/chat/CameraModal.vue'
import ForwardMessageDialog from '@/components/chat/ForwardMessageDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { Message } from '@/types/message'
import { useVoiceRecordingWorkflow } from '@/composables/useVoiceRecordingWorkflow'
import { useChatStatus } from '@/composables/useChatStatus'
import { useWebSocketSubscriptions } from '@/composables/useWebSocketSubscriptions'
import { useMessageActions } from '@/composables/useMessageActions'
import websocketService from '@/services/websocket.service'

interface Props {
  id: string
}

const props = defineProps<Props>()
const router = useRouter()

const chatStore = useChatStore()
const messageStore = useMessageStore()
const userStore = useUserStore()
const authStore = useAuthStore()

const messageListRef = ref<HTMLElement>()
const messageInputRef = ref<InstanceType<typeof MessageInput>>()
const loadingMessages = ref(false)
const showToolbar = ref(false)
const showCamera = ref(false)
const showMessageActions = ref(false)
const showForwardDialog = ref(false)
const selectedMessage = ref<Message | null>(null)
const editingMessage = ref<Message | null>(null)
const replyingToMessage = ref<Message | null>(null)
const selectionMode = ref(false)
const selectedMessageIds = ref(new Set<string>())

// 跟踪是否已标记为已读，避免重复调用
const hasMarkedAsRead = ref(false)

// 标记所有消息为已读
const markAllAsRead = async () => {
  if (hasMarkedAsRead.value) return

  try {
    hasMarkedAsRead.value = true
    // 调用 API 时不传 messageId，标记所有消息为已读
    await chatStore.markConversationAsRead(props.id)
    // 立即更新 UI（乐观更新）
    chatStore.markAsRead(props.id)
  } catch (error) {
    // 忽略错误，但重置标记以允许重试
    hasMarkedAsRead.value = false
  }
}

const voiceRecording = useVoiceRecordingWorkflow({
  onStateChange: (state) => {
    if (messageInputRef.value) {
      messageInputRef.value.updateRecordingState(state)
    }
  },
  onRecordingComplete: async (audioBlob, duration) => {
    await handleVoiceRecorded(audioBlob, duration)
    voiceRecording.reset()
  },
  onError: (error) => {
    showNotify({
      type: 'warning',
      message: error.message === '录音时长太短' ? '录音时长太短，请长按至少 1 秒' : '录音失败，请重试',
    })
  },
})

const currentUserId = computed(() => authStore.userId || '')
const currentChat = computed(() => chatStore.getChatById(props.id))
const messages = computed(() => messageStore.getMessages(props.id))
const loadingMore = computed(() => messageStore.isLoadingMore)
const hasMore = computed(() => messageStore.hasMore[props.id] !== false)

const chatTitle = computed(() => {
  if (!currentChat.value) return '聊天'
  return currentChat.value.name
})

// 使用 useChatStatus composable 管理在线状态
const { statusText } = useChatStatus(currentChat)

// 检查用户是否可以发送消息
const canInteract = computed(() => {
  // 检查群组是否已解散
  if (currentChat.value?.disbandedAt) {
    return false
  }
  // 检查用户是否已离开或被移除
  if (currentChat.value?.leftAt) {
    return false
  }
  // 如果对话存在于列表中，说明用户是成员，可以发送消息
  return true
})

// 使用 useMessageActions composable 管理消息操作
const selectedMessageForActions = computed(() => selectedMessage.value ?? undefined)
const { actions: messageActionsFromComposable } = useMessageActions(selectedMessageForActions, currentUserId)
const messageActions = computed<ActionSheetAction[]>(() => {
  return messageActionsFromComposable.value.map(action => {
    const actionSheet: ActionSheetAction = {
      name: action.name,
      icon: action.icon
    }
    // 删除操作设置为红色
    if (action.name === '删除') {
      actionSheet.color = '#ee0a24'
    }
    return actionSheet
  })
})

// 使用 useWebSocketSubscriptions composable 管理 WebSocket 订阅
const { subscribe } = useWebSocketSubscriptions()

onMounted(async () => {
  // 将当前用户从 authStore 同步到 userStore
  if (authStore.user) {
    userStore.setCurrentUser({
      id: authStore.user.id,
      name: authStore.user.username,
      avatar: '', // 如果可用，可以在此处添加头像 URL
    })
  }

  chatStore.setCurrentChatId(props.id)

  // 如果未加载则获取会话（以防页面刷新）
  if (chatStore.chats.length === 0) {
    try {
      await chatStore.fetchConversations()
    } catch (error) {
      // 静默失败 - 用户将看到空状态
    }
  }

  // 加入 WebSocket 会话房间
  websocketService.joinConversation(props.id)

  // 监听群组名称更新
  subscribe(websocketService.onGroupNameUpdated((data) => {
    if (data.conversationId === props.id) {
      // 更新聊天 store 以在导航栏中反映新名称
      chatStore.updateChat(data.conversationId, {
        name: data.name,
      })
    }
  }))

  // 监听群组头像更新
  subscribe(websocketService.onGroupAvatarUpdated((data) => {
    if (data.conversationId === props.id) {
      // 更新聊天 store 以反映新头像
      chatStore.updateChat(data.conversationId, {
        avatar: data.avatarUrl,
      })
    }
  }))

  // 监听用户在线状态变化
  subscribe(websocketService.onUserStatusChanged((data) => {
    if (currentChat.value?.type === 'single' && currentChat.value.otherUserId === data.userId) {
      chatStore.updateUserOnlineStatus(
        data.userId,
        data.isOnline,
        data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : undefined
      )
    }
  }))

  await loadMessages()
  scrollToBottom()

  // 标记所有消息为已读
  await markAllAsRead()
})


onBeforeUnmount(() => {
  // 离开 WebSocket 会话房间
  websocketService.leaveConversation(props.id)
  // WebSocket 订阅会通过 useWebSocketSubscriptions 自动清理
})

// 监听聊天 ID 变化
watch(() => props.id, async (newId, oldId) => {
  if (newId !== oldId) {
    // 离开旧会话房间并加入新会话房间
    if (oldId) {
      websocketService.leaveConversation(oldId)
    }
    websocketService.joinConversation(newId)

    chatStore.setCurrentChatId(newId)
    await loadMessages()
    scrollToBottom()

    // 重置已读标记并标记所有消息为已读
    hasMarkedAsRead.value = false
    await markAllAsRead()
  }
})

// 监听消息列表变化，自动滚动到底部
watch(() => messages.value.length, async (newLength, oldLength) => {
  if (newLength > oldLength) {
    // 检查用户是否在底部（在 DOM 更新之前检查）
    const wasNearBottom = isNearBottom()

    // 有新消息到达，等待 DOM 更新
    await nextTick()

    // 判断是新消息（添加到末尾）还是旧消息（添加到开头）
    // 如果用户在底部附近，很可能是新消息到达
    // 如果用户不在底部且正在加载更多，则是旧消息分页加载
    const isLoadingOldMessages = loadingMore.value || !wasNearBottom

    // 只有当用户在底部附近且不是加载旧消息时才自动滚动到底部
    if (wasNearBottom && !isLoadingOldMessages) {
      scrollToBottom()
    }
  }
})

const loadMessages = async () => {
  try {
    loadingMessages.value = true
    await messageStore.fetchMessages(props.id, 1, 30)
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '加载消息失败',
    })
  } finally {
    loadingMessages.value = false
  }
}

const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return

  try {
    // 保存滚动位置
    const scrollElement = messageListRef.value
    if (!scrollElement) return

    const previousScrollHeight = scrollElement.scrollHeight
    const previousScrollTop = scrollElement.scrollTop

    // 通过 store 加载更多消息
    await messageStore.loadMore(props.id)

    // 恢复滚动位置
    await nextTick()
    const newScrollHeight = scrollElement.scrollHeight
    const heightDifference = newScrollHeight - previousScrollHeight
    scrollElement.scrollTop = previousScrollTop + heightDifference
  } catch (error) {
    // 忽略错误
  }
}

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  // 滚动到顶部时加载更多（50px阈值内）
  if (target.scrollTop <= 50 && hasMore.value && !loadingMore.value) {
    loadMore()
  }
}

/**
 * 检查用户是否在消息列表底部附近
 * @param threshold 阈值（像素），默认100px
 */
const isNearBottom = (threshold = 100): boolean => {
  if (!messageListRef.value) return false
  const { scrollTop, scrollHeight, clientHeight } = messageListRef.value
  return scrollHeight - scrollTop - clientHeight < threshold
}

const scrollToBottom = async () => {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

const handleSendMessage = async (text: string) => {
  try {
    // 检查是否处于编辑模式
    if (editingMessage.value) {
      await messageStore.editMessage(editingMessage.value.id, text)
      showNotify({ type: 'success', message: '消息已更新' })
      editingMessage.value = null
      return
    }

    // 如果处于回复模式，发送带回复引用的消息
    const replyToId = replyingToMessage.value?.id
    const message = await messageStore.sendMessage(props.id, text, 'text', replyToId)
    chatStore.updateLastMessage(props.id, message)

    // 清除回复模式
    if (replyingToMessage.value) {
      replyingToMessage.value = null
    }

    await nextTick()
    scrollToBottom()
  } catch (error: any) {
    // 从响应中提取具体的错误消息
    const errorMessage = error?.response?.data?.error?.message ||
                         error?.response?.data?.message ||
                         error?.message ||
                         (editingMessage.value ? '更新消息失败' : '发送消息失败')

    showNotify({
      type: 'danger',
      message: errorMessage,
    })
  }
}

const handleSelectImage = async () => {
  try {
    const file = await selectImage()
    if (!file) return

    // 显示加载提示
    showLoadingToast({
      message: '上传中...',
      forbidClick: true,
      duration: 0,
    })

    // 上传文件到资源服务器
    const fileUrl = await uploadService.uploadFile(file, (progress) => {
      showLoadingToast({
        message: `上传中 ${progress}%`,
        forbidClick: true,
        duration: 0,
      })
    })

    closeToast()

    // 发送带图片 URL 的消息
    const message = await messageStore.sendMessage(props.id, fileUrl, 'image')
    chatStore.updateLastMessage(props.id, message)

    await nextTick()
    scrollToBottom()

    showNotify({
      type: 'success',
      message: '图片已发送',
    })
  } catch (error) {
    closeToast()
  }
}

const handleSelectVideo = async () => {
  try {
    const file = await selectVideo()
    if (!file) return

    // 显示加载提示
    showLoadingToast({
      message: '上传中...',
      forbidClick: true,
      duration: 0,
    })

    // 上传视频文件到资源服务器
    const fileUrl = await uploadService.uploadFile(file, (progress) => {
      showLoadingToast({
        message: `上传中 ${progress}%`,
        forbidClick: true,
        duration: 0,
      })
    })

    closeToast()

    // 发送带视频 URL 的消息
    const message = await messageStore.sendMessage(props.id, fileUrl, 'video')
    chatStore.updateLastMessage(props.id, message)

    await nextTick()
    scrollToBottom()

    showNotify({
      type: 'success',
      message: '视频已发送',
    })
  } catch (error) {
    closeToast()
  }
}

const handleTakePhotoVideo = () => {
  showCamera.value = true
}

const handlePhotoCaptured = async (dataUrl: string) => {
  try {
    showLoadingToast({
      message: '上传中...',
      forbidClick: true,
      duration: 0,
    })

    // 上传照片数据 URL 到资源服务器
    const filename = `photo_${Date.now()}.jpg`
    const fileUrl = await uploadService.uploadDataURL(dataUrl, filename)

    closeToast()

    // 发送带照片 URL 的消息
    const message = await messageStore.sendMessage(props.id, fileUrl, 'image')
    chatStore.updateLastMessage(props.id, message)

    await nextTick()
    scrollToBottom()

    showNotify({
      type: 'success',
      message: '照片已发送',
    })
  } catch (error) {
    closeToast()
  }
}

const handleVideoCaptured = async (videoBlob: Blob, _duration: number, _thumbnail: string) => {
  try {
    showLoadingToast({
      message: '上传中...',
      forbidClick: true,
      duration: 0,
    })

    // 上传视频 blob 到资源服务器
    const filename = `video_${Date.now()}.webm`
    const fileUrl = await uploadService.uploadBlob(videoBlob, filename)

    closeToast()

    // 发送带视频 URL 的消息
    const message = await messageStore.sendMessage(props.id, fileUrl, 'video')
    chatStore.updateLastMessage(props.id, message)

    await nextTick()
    scrollToBottom()

    showNotify({
      type: 'success',
      message: '视频已发送',
    })
  } catch (error) {
    closeToast()
  }
}

const handleVoiceStart = async (event: TouchEvent | MouseEvent) => {
  await voiceRecording.startRecording(event)
}

const handleVoiceMove = (event: TouchEvent | MouseEvent) => {
  voiceRecording.handleMove(event)
}

const handleVoiceEnd = () => {
  voiceRecording.handleRelease()
}

const handlePauseRecording = () => {
  voiceRecording.pauseRecording()
}

const handleCancelRecording = () => {
  voiceRecording.cancelRecording()
}

const handleSendRecording = () => {
  voiceRecording.sendRecording()
}

const handleVoiceRecorded = async (audioBlob: Blob, _duration: number) => {
  try {
    showLoadingToast({
      message: '上传中...',
      forbidClick: true,
      duration: 0,
    })

    // 上传语音 blob 到资源服务器
    const filename = `voice_${Date.now()}.webm`
    const fileUrl = await uploadService.uploadBlob(audioBlob, filename)

    closeToast()

    // 发送带语音 URL 的消息
    const message = await messageStore.sendMessage(props.id, fileUrl, 'voice')
    chatStore.updateLastMessage(props.id, message)

    await nextTick()
    scrollToBottom()

    showNotify({
      type: 'success',
      message: '语音已发送',
    })
  } catch (error) {
    closeToast()
  }
}

const handleInputFocus = () => {
  scrollToBottom()
}

const getSender = (senderId: string) => {
  // 首先检查是否是当前用户
  if (senderId === currentUserId.value && authStore.user) {
    return {
      id: authStore.user.id,
      name: authStore.user.username,
      avatar: '',
    }
  }

  // 对于其他用户，尝试从 userStore 获取
  const user = userStore.getUserById(senderId)
  if (user) {
    return user
  }

  // 备用方案：从会话数据创建基本用户对象
  if (currentChat.value?.otherUserId === senderId) {
    return {
      id: senderId,
      name: currentChat.value.name,
      avatar: currentChat.value.avatar || '',
    }
  }

  // 最后的手段：返回占位符
  return {
    id: senderId,
    name: 'Unknown User',
    avatar: '',
  }
}

const handleMessageLongPress = (message: Message) => {
  selectedMessage.value = message
  showMessageActions.value = true
}

const onMessageActionSelect = async (action: ActionSheetAction) => {
  if (!selectedMessage.value) return

  switch (action.name) {
    case '复制':
      showMessageActions.value = false

      try {
        // 使用剪贴板 API 并提供备用方案
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(selectedMessage.value.content)
          showNotify({ type: 'success', message: '已复制' })
        } else {
          // 旧浏览器的备用方案
          const textArea = document.createElement('textarea')
          textArea.value = selectedMessage.value.content
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          try {
            document.execCommand('copy')
            showNotify({ type: 'success', message: '已复制' })
          } catch (err) {
            showNotify({ type: 'danger', message: '复制失败' })
          }
          document.body.removeChild(textArea)
        }
      } catch (error) {
        showNotify({ type: 'danger', message: '复制失败' })
      }
      break

    case '回复':
      showMessageActions.value = false

      // 进入回复模式
      replyingToMessage.value = selectedMessage.value
      break

    case '转发':
      showMessageActions.value = false

      // 打开转发对话框
      showForwardDialog.value = true
      break

    case '编辑':
      showMessageActions.value = false

      if (selectedMessage.value.senderId !== currentUserId.value) {
        showNotify({ type: 'warning', message: '只能编辑自己的消息' })
        return
      }

      if (selectedMessage.value.type !== 'text') {
        showNotify({ type: 'warning', message: '只能编辑文本消息' })
        return
      }

      // 进入编辑模式
      editingMessage.value = selectedMessage.value
      messageInputRef.value?.setText(selectedMessage.value.content)
      break

    case '多选':
      showMessageActions.value = false

      // 进入选择模式并选择当前消息
      selectionMode.value = true
      selectedMessageIds.value = new Set([selectedMessage.value.id])
      break

    case '删除':
      showMessageActions.value = false

      if (selectedMessage.value.senderId !== currentUserId.value) {
        showNotify({ type: 'warning', message: '只能删除自己的消息' })
        return
      }

      showDialog({
        title: '删除消息',
        message: '确定要删除这条消息吗？',
        showCancelButton: true,
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonColor: '#ee0a24',
      }).then(async () => {
        try {
          await messageStore.removeMessage(selectedMessage.value!.id)
          showNotify({ type: 'success', message: '消息已删除' })
        } catch (error) {
          showNotify({ type: 'danger', message: '删除消息失败' })
        }
      }).catch(() => {
        // 用户取消
      })
      break
  }
}

const handleCancelEdit = () => {
  editingMessage.value = null
  messageInputRef.value?.clear()
}

const handleCancelReply = () => {
  replyingToMessage.value = null
}

// 进入选择模式
// const enterSelectionMode = () => {
//   selectionMode.value = true
//   selectedMessageIds.value.clear()
// }

const exitSelectionMode = () => {
  selectionMode.value = false
  selectedMessageIds.value.clear()
}

const toggleMessageSelection = (messageId: string) => {
  if (selectedMessageIds.value.has(messageId)) {
    selectedMessageIds.value.delete(messageId)
  } else {
    selectedMessageIds.value.add(messageId)
  }
  // 触发响应式更新
  selectedMessageIds.value = new Set(selectedMessageIds.value)
}

const handleBatchDelete = async () => {
  if (selectedMessageIds.value.size === 0) {
    return
  }

  // 验证所有选中的消息在5分钟内且属于当前用户
  const now = Date.now()
  const invalidMessages: string[] = []

  for (const messageId of selectedMessageIds.value) {
    const message = messages.value.find(m => m.id === messageId)
    if (!message) continue

    // 检查所有权
    if (message.senderId !== currentUserId.value) {
      showNotify({ type: 'warning', message: '只能删除自己的消息' })
      return
    }

    // 检查时间限制
    const diffMinutes = (now - message.timestamp) / 1000 / 60
    if (diffMinutes > 5) {
      invalidMessages.push(message.id)
    }
  }

  if (invalidMessages.length > 0) {
    showNotify({
      type: 'warning',
      message: `有 ${invalidMessages.length} 条消息超过5分钟，无法删除`
    })
    return
  }

  showDialog({
    title: '批量删除',
    message: `确定要删除选中的 ${selectedMessageIds.value.size} 条消息吗？`,
    showCancelButton: true,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      const messageIds = Array.from(selectedMessageIds.value)
      await messageStore.batchRemoveMessages(messageIds)
      showNotify({ type: 'success', message: `已删除 ${messageIds.length} 条消息` })
      exitSelectionMode()
    } catch (error) {
      showNotify({ type: 'danger', message: '批量删除失败' })
    }
  }).catch(() => {
    // 用户取消
  })
}

const handleBatchForward = () => {
  if (selectedMessageIds.value.size === 0) {
    return
  }

  // 获取选中的消息
  const selectedMessages = Array.from(selectedMessageIds.value)
    .map(id => messages.value.find(m => m.id === id))
    .filter((m): m is Message => m !== undefined)

  if (selectedMessages.length === 0) {
    return
  }

  // 使用第一条选中的消息触发转发对话框
  // 对话框将处理转发所有选中的消息
  selectedMessage.value = selectedMessages[0]
  showForwardDialog.value = true
}

const handleForwardMessage = async (chatIds: string[], message: Message) => {
  if (chatIds.length === 0) return

  try {
    showLoadingToast({
      message: '转发中...',
      forbidClick: true,
      duration: 0,
    })

    // 如果处于选择模式，转发所有选中的消息
    if (selectionMode.value && selectedMessageIds.value.size > 0) {
      const messageIds = Array.from(selectedMessageIds.value)
      await messageStore.batchForwardMessages(messageIds, chatIds)

      closeToast()
      showNotify({
        type: 'success',
        message: `已转发 ${messageIds.length} 条消息到 ${chatIds.length} 个聊天`,
      })

      // 成功转发后退出选择模式
      exitSelectionMode()
    } else {
      // 单条消息转发
      await messageStore.forwardMessage(message.id, chatIds)

      closeToast()
      showNotify({
        type: 'success',
        message: `已转发到 ${chatIds.length} 个聊天`,
      })
    }
  } catch (error) {
    closeToast()
    showNotify({
      type: 'danger',
      message: '转发失败',
    })
  }
}

const goBack = () => {
  router.back()
}

const goToGroupSettings = () => {
  router.push(`/group-settings/${props.id}`)
}
</script>

<style scoped>
.chat-detail-view {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: var(--chat-background, #f7f8fa);
}

.chat-title-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chat-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.2;
}

.status-text {
  font-size: 12px;
  font-weight: 400;
  color: #969799;
  margin-top: 2px;
  line-height: 1;
}

.status-text.online {
  color: #44C553;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
  -webkit-overflow-scrolling: touch;
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  color: var(--chat-text-secondary, #969799);
}

.load-more-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  font-size: 13px;
  color: var(--chat-text-secondary, #969799);
}

.input-area {
  position: sticky;
  bottom: 0;
  width: 100%;
  background-color: var(--chat-card-bg, #fff);
  z-index: 10;
}

.disabled-input-area {
  position: sticky;
  bottom: 0;
  width: 100%;
  background-color: var(--chat-card-bg, #fff);
  z-index: 10;
  border-top: 1px solid #ebedf0;
}

.disabled-message {
  padding: 16px;
  text-align: center;
  color: #969799;
  font-size: 14px;
}
</style>
