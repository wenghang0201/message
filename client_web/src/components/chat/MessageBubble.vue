<template>
  <div
    v-if="message.type === 'system'"
    class="system-message"
  >
    <div class="system-message-content">
      {{ message.content }}
    </div>
  </div>
  <div
    v-else
    ref="bubbleRef"
    class="message-bubble"
    :class="{ 'is-sent': isSent, 'selection-mode': selectionMode }"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
    @contextmenu.prevent="handleLongPress"
    @click="handleBubbleClick"
  >
    <van-checkbox
      v-if="selectionMode"
      :model-value="isSelected"
      class="selection-checkbox"
      @click.stop="$emit('toggle-selection')"
    />

    <Avatar
      v-if="!isSent && sender"
      :src="sender.avatar"
      :name="sender.name"
      :size="32"
      class="message-avatar"
    />

    <div class="bubble-container">
      <!-- 撤回的消息 -->
      <div v-if="message.isRecalled" class="recalled-message">
        <van-icon name="info-o" size="14" />
        <span v-if="isSent">你撤回了一条消息</span>
        <span v-else>{{ sender?.name || '对方' }} 撤回了一条消息</span>
      </div>

      <!-- 正常消息 -->
      <div v-else class="bubble-content" :class="`type-${message.type}`">
        <!-- 转发标记 -->
        <div v-if="message.isForwarded" class="forwarded-label">
          <van-icon name="share-o" size="12" />
          <span>转发</span>
        </div>

        <!-- 回复引用 -->
        <div v-if="repliedMessage" class="reply-context">
          <div class="reply-divider"></div>
          <div class="reply-preview">
            <span class="reply-sender">{{ repliedSenderName }}</span>
            <span class="reply-message">{{ getReplyPreviewText(repliedMessage) }}</span>
          </div>
        </div>

        <!-- 文本消息 -->
        <div v-if="message.type === 'text'" class="text-content">
          {{ message.content }}
        </div>

        <!-- 图片消息 -->
        <div v-else-if="message.type === 'image'" class="image-content">
          <van-image
            :src="message.content"
            fit="cover"
            :width="imageWidth"
            :height="imageHeight"
            @click="previewImage"
          />
        </div>

        <!-- 视频消息 -->
        <div v-else-if="message.type === 'video'" class="video-content">
          <div class="video-thumbnail" @click="playVideo">
            <van-image
              v-if="message.thumbnail"
              :src="message.thumbnail"
              fit="cover"
              :width="imageWidth"
              :height="imageHeight"
            />
            <van-icon name="play-circle-o" size="48" class="play-icon" />
            <span v-if="message.duration" class="duration">
              {{ formatDuration(message.duration) }}
            </span>
          </div>
        </div>

        <!-- 语音消息 -->
        <div v-else-if="message.type === 'voice'" class="voice-content">
          <van-icon
            :name="isVoicePlaying ? 'pause-circle' : 'play-circle'"
            size="24"
            :color="isSent ? '#ffffff' : 'var(--van-primary-color)'"
            @click="toggleVoicePlayback"
          />
          <div class="voice-info">
            <div ref="voiceWaveformRef" class="voice-waveform-container"></div>
            <span class="voice-duration">{{ formatDuration(message.duration || 0) }}</span>
          </div>
        </div>

        <!-- 文件消息 -->
        <div v-else-if="message.type === 'file'" class="file-content">
          <van-icon name="description" size="24" />
          <span class="file-name">{{ message.content }}</span>
        </div>
      </div>

      <div class="bubble-footer">
        <span v-if="message.isEdited" class="edited-label">已编辑</span>
        <span class="message-time">{{ formattedTime }}</span>
        <MessageStatus v-if="isSent" :status="message.status" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { showImagePreview } from 'vant'
import type { Message } from '@/types/message'
import type { User } from '@/types/user'
import { formatMessageTime, formatDuration } from '@/utils/dateFormat'
import { getMessagePreview } from '@/utils/messageFormatter'
import { useAppStore } from '@/stores/app'
import { useMessageStore } from '@/stores/message'
import { useWaveSurfer } from '@/composables/useWaveSurfer'
import Avatar from '@/components/common/Avatar.vue'
import MessageStatus from '@/components/chat/MessageStatus.vue'

interface Props {
  message: Message
  isSent: boolean
  sender?: User
  repliedSenderName?: string
  selectionMode?: boolean
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectionMode: false,
  isSelected: false,
})

const emit = defineEmits<{
  longpress: [message: Message]
  'toggle-selection': []
}>()

const appStore = useAppStore()
const messageStore = useMessageStore()

const bubbleRef = ref<HTMLElement | null>(null)
const voiceWaveformRef = ref<HTMLElement | null>(null)

// 获取被回复的消息（如果存在）
const repliedMessage = computed(() => {
  if (!props.message.replyTo) return null
  return messageStore.getMessageById(props.message.replyTo)
})

const repliedSenderName = computed(() => {
  return props.repliedSenderName || '用户'
})

// 使用统一的消息预览工具函数
const getReplyPreviewText = (message: Message) => {
  return getMessagePreview(message.type, message.content)
}

// 暴露 ref 给父组件
defineExpose({
  bubbleRef,
})
const waveSurfer = useWaveSurfer({
  height: 30,
  barWidth: 2,
  barGap: 1,
})

const isVoicePlaying = computed(() => waveSurfer.isPlaying.value)

const formattedTime = computed(() => formatMessageTime(props.message.timestamp))

const imageWidth = computed(() => Math.min(appStore.show_width * 0.5, 200))
const imageHeight = computed(() => imageWidth.value * 0.75)

const previewImage = () => {
  showImagePreview({
    images: [props.message.content],
  })
}

const playVideo = () => {
  // 创建视频元素
  const video = document.createElement('video')
  video.src = props.message.content
  video.controls = true
  video.autoplay = true
  video.preload = 'auto'
  video.playsInline = true
  video.className = 'video-fullscreen-player'

  // 加载指示器
  const loading = document.createElement('div')
  loading.textContent = '加载中...'
  loading.className = 'video-loading'
  document.body.appendChild(loading)

  // 关闭按钮
  const closeBtn = document.createElement('div')
  closeBtn.textContent = '✕'
  closeBtn.className = 'video-close-btn'

  // 清理函数
  const cleanup = () => {
    if (document.body.contains(video)) {
      video.pause()
      document.body.removeChild(video)
    }
    if (document.body.contains(closeBtn)) {
      document.body.removeChild(closeBtn)
    }
    if (document.body.contains(loading)) {
      document.body.removeChild(loading)
    }
  }

  // 事件监听器
  video.addEventListener('canplay', () => {
    if (document.body.contains(loading)) {
      document.body.removeChild(loading)
    }
  })

  video.addEventListener('error', () => {
    if (document.body.contains(loading)) {
      loading.textContent = '视频加载失败'
      setTimeout(cleanup, 3000)
    }
  })

  video.addEventListener('ended', cleanup)
  closeBtn.addEventListener('click', cleanup)

  // 添加到页面
  document.body.appendChild(video)
  document.body.appendChild(closeBtn)
}

// 初始化语音消息的 WaveSurfer
onMounted(() => {
  if (props.message.type === 'voice' && voiceWaveformRef.value && props.message.content) {
    waveSurfer.initWaveSurfer(voiceWaveformRef.value, props.message.content)
  }
})

// 监听消息内容变化（以防动态加载）
watch(() => [props.message.content, props.message.type] as const,
  ([newContent, newType], [oldContent, oldType]) => {
    if (newType === 'voice' && voiceWaveformRef.value && newContent) {
      // 只有当内容实际改变时才重新初始化
      if (newContent !== oldContent || newType !== oldType) {
        // 先销毁旧实例
        waveSurfer.destroy()
        // 再创建新实例
        waveSurfer.initWaveSurfer(voiceWaveformRef.value, newContent)
      }
    }
  }
)

// 组件卸载时清理 WaveSurfer 实例
onBeforeUnmount(() => {
  waveSurfer.destroy()
})

const toggleVoicePlayback = () => {
  waveSurfer.togglePlayback()
}

// 长按检测
let touchTimer: ReturnType<typeof setTimeout> | null = null
const LONG_PRESS_DURATION = 500 // 500ms 触发长按

const handleTouchStart = () => {
  touchTimer = setTimeout(() => {
    handleLongPress()
  }, LONG_PRESS_DURATION)
}

const handleTouchEnd = () => {
  if (touchTimer) {
    clearTimeout(touchTimer)
    touchTimer = null
  }
}

const handleTouchCancel = () => {
  if (touchTimer) {
    clearTimeout(touchTimer)
    touchTimer = null
  }
}

const handleLongPress = () => {
  if (!props.selectionMode) {
    emit('longpress', props.message)
  }
}

const handleBubbleClick = () => {
  if (props.selectionMode) {
    emit('toggle-selection')
  }
}
</script>

<style scoped>
/* System message */
.system-message {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 12px 0;
  padding: 0 16px;
}

.system-message-content {
  background-color: rgba(0, 0, 0, 0.05);
  color: #969799;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 4px;
  text-align: center;
  max-width: 80%;
  word-wrap: break-word;
}

.message-bubble {
  display: flex;
  align-items: flex-end;
  margin-bottom: 12px;
  padding: 0 12px;
  gap: 8px;
  justify-content: flex-start;
}

.message-bubble.is-sent {
  flex-direction: row-reverse;
}

.message-bubble.selection-mode {
  cursor: pointer;
}

.selection-checkbox {
  flex-shrink: 0;
  margin-right: 8px;
}

.message-bubble.is-sent .selection-checkbox {
  margin-right: 0;
  margin-left: 8px;
}

.message-bubble.is-sent .bubble-container {
  align-items: flex-end;
}

.message-avatar {
  flex-shrink: 0;
}

.bubble-container {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  gap: 4px;
}

.recalled-message {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: #969799;
  font-size: 13px;
  font-style: italic;
  background-color: transparent;
}

.bubble-content {
  border-radius: var(--chat-radius-lg, 12px);
  padding: 10px 14px;
  word-wrap: break-word;
  word-break: break-word;
  background-color: var(--chat-received-bg, #ffffff);
  color: var(--chat-received-text, #323233);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  border-bottom-left-radius: 4px;
}

.message-bubble.is-sent .bubble-content {
  background-color: var(--chat-sent-bg, #1989fa) !important;
  color: var(--chat-sent-text, #ffffff) !important;
  border-bottom-right-radius: 4px;
  border-bottom-left-radius: 12px;
}

/* Forwarded label */
.forwarded-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #969799;
  margin-bottom: 6px;
  font-style: italic;
}

.message-bubble.is-sent .forwarded-label {
  color: rgba(255, 255, 255, 0.7);
}

/* Reply context */
.reply-context {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.message-bubble.is-sent .reply-context {
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.reply-divider {
  width: 3px;
  border-radius: 2px;
  background-color: var(--van-primary-color);
  flex-shrink: 0;
}

.message-bubble.is-sent .reply-divider {
  background-color: rgba(255, 255, 255, 0.6);
}

.reply-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.reply-sender {
  font-size: 12px;
  font-weight: 600;
  color: var(--van-primary-color);
}

.message-bubble.is-sent .reply-sender {
  color: rgba(255, 255, 255, 0.9);
}

.reply-message {
  font-size: 13px;
  color: #969799;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-bubble.is-sent .reply-message {
  color: rgba(255, 255, 255, 0.7);
}

.text-content {
  font-size: 15px;
  line-height: 1.5;
}

.image-content,
.video-content {
  padding: 0;
  overflow: hidden;
}

.video-thumbnail {
  position: relative;
  cursor: pointer;
}

.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.voice-content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 160px;
  cursor: pointer;
  user-select: none;
}

.voice-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.voice-waveform-container {
  width: 100%;
  height: 30px;
  cursor: pointer;
}

.voice-duration {
  font-size: 12px;
  opacity: 0.8;
}

.file-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  font-size: 14px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 视频播放器覆盖层样式 */
:global(.video-fullscreen-player) {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  z-index: 9999;
  object-fit: contain;
}

:global(.video-loading) {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 16px;
  z-index: 10001;
}

:global(.video-close-btn) {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  z-index: 10000;
}

.bubble-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  font-size: 12px;
  color: #969799;
}

.edited-label {
  font-style: italic;
  color: #969799;
}

.message-time {
  color: #969799;
}
</style>
