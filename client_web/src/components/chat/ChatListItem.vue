<template>
  <van-swipe-cell>
    <div
      class="chat-list-item"
      :class="{ 'is-pinned': chat.isPinned }"
      @click="handleClick"
    >
      <div class="avatar-container">
        <Avatar
          :src="chat.avatar"
          :name="chat.name"
          :size="48"
        />
        <div
          v-if="chat.type === 'single' && chat.isOnline"
          class="online-indicator"
        />
        <van-badge
          v-if="chat.unreadCount > 0"
          :content="chat.unreadCount > 99 ? '99+' : chat.unreadCount"
          max="99"
          color="var(--chat-badge-bg)"
          class="unread-badge"
        />
      </div>

      <div class="chat-info">
        <div class="chat-header">
          <div class="chat-name-container">
            <van-icon v-if="chat.isPinned" name="pin" class="pin-icon" />
            <van-icon v-if="isMuted" name="bell-o" class="mute-icon" />
            <span class="chat-name">{{ chat.name }}</span>
          </div>
          <span class="chat-time">{{ formattedTime }}</span>
        </div>

        <div class="chat-footer">
          <div class="last-message">
            <!-- 单聊且离线时显示最后在线时间 -->
            <span v-if="chat.type === 'single' && showLastSeen" class="last-seen-text">
              {{ lastSeenText }}
            </span>
            <!-- 否则显示最后一条消息 -->
            <span v-else-if="chat.lastMessage" class="message-preview">
              {{ getMessagePreview() }}
            </span>
            <span v-else class="message-preview no-messages">暂无消息</span>
          </div>
        </div>
      </div>
    </div>

    <template #right>
      <van-button
        square
        type="primary"
        :text="chat.isPinned ? '取消置顶' : '置顶'"
        class="swipe-button"
        @click="handlePin"
      />
      <van-button
        square
        :type="isMuted ? 'default' : 'warning'"
        :text="isMuted ? '取消静音' : '静音'"
        class="swipe-button"
        @click="handleMute"
      />
      <van-button
        square
        type="danger"
        text="删除"
        class="swipe-button"
        @click="handleDelete"
      />
    </template>
  </van-swipe-cell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Chat } from '@/types/chat'
import { MessageType } from '@/types/message'
import { formatChatTime } from '@/utils/dateFormat'
import Avatar from '@/components/common/Avatar.vue'

interface Props {
  chat: Chat
}

const props = defineProps<Props>()
const emit = defineEmits<{
  delete: [chatId: string]
  pin: [chatId: string]
  mute: [chatId: string]
}>()

const router = useRouter()

const formattedTime = computed(() => {
  if (!props.chat.lastMessage) {
    return formatChatTime(props.chat.updatedAt)
  }
  return formatChatTime(props.chat.lastMessage.timestamp)
})

const isMuted = computed(() => {
  if (!props.chat.mutedUntil) return false
  // 检查静音是否已过期
  return props.chat.mutedUntil > Date.now()
})

// 单聊且离线时显示最后在线时间（没有未读消息的情况下）
const showLastSeen = computed(() => {
  return props.chat.type === 'single' &&
         props.chat.unreadCount === 0 &&
         !props.chat.isOnline &&
         props.chat.lastSeenAt !== undefined
})

const lastSeenText = computed(() => {
  if (props.chat.lastSeenAt) {
    return formatLastSeen(props.chat.lastSeenAt)
  }
  return ''
})

const formatLastSeen = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) {
    return '刚刚在线'
  } else if (minutes < 60) {
    return `${minutes}分钟前在线`
  } else if (hours < 24) {
    return `${hours}小时前在线`
  } else if (days < 7) {
    return `${days}天前在线`
  } else {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}月${date.getDate()}日在线`
  }
}

const getMessagePreview = (): string => {
  const msg = props.chat.lastMessage
  if (!msg) return ''

  switch (msg.type) {
    case MessageType.TEXT:
      return msg.content
    case MessageType.IMAGE:
      return '[图片]'
    case MessageType.VIDEO:
      return '[视频]'
    case MessageType.VOICE:
      return '[语音]'
    case MessageType.FILE:
      return '[文件]'
    default:
      return msg.content
  }
}

const handleClick = () => {
  router.push({
    name: 'ChatDetail',
    params: { id: props.chat.id },
  })
}

const handleDelete = () => {
  emit('delete', props.chat.id)
}

const handlePin = () => {
  emit('pin', props.chat.id)
}

const handleMute = () => {
  emit('mute', props.chat.id)
}
</script>

<style scoped>
.chat-list-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--chat-card-bg, #fff);
  cursor: pointer;
  transition: background-color 0.2s;
}

.chat-list-item.is-pinned {
  background-color: #f0f9ff;
}

.chat-list-item:active {
  background-color: var(--chat-hover-bg, #f7f8fa);
}

.chat-list-item.is-pinned:active {
  background-color: #e0f2fe;
}

.avatar-container {
  position: relative;
  flex-shrink: 0;
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  background-color: #44C553;
  border: 2px solid var(--chat-card-bg, #fff);
  border-radius: 50%;
  z-index: 1;
}

.unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  transform: scale(0.9);
}

.chat-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.chat-name-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.pin-icon {
  color: var(--van-primary-color);
  flex-shrink: 0;
  font-size: 14px;
}

.mute-icon {
  color: #969799;
  flex-shrink: 0;
  font-size: 14px;
}

.chat-name {
  font-size: 16px;
  font-weight: 500;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-time {
  font-size: 12px;
  color: #969799;
  flex-shrink: 0;
  margin-left: 8px;
}

.chat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-message {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.message-preview {
  font-size: 14px;
  color: #969799;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-preview.no-messages {
  font-style: italic;
  color: #c8c9cc;
}

.last-seen-text {
  font-size: 13px;
  color: #969799;
}

.swipe-button {
  height: 100%;
}
</style>
