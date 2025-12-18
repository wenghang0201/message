<template>
  <div class="message-input">
    <!-- 编辑模式横幅 -->
    <div v-if="editingMessage" class="edit-banner">
      <div class="edit-info">
        <van-icon name="edit" size="16" />
        <span>编辑消息</span>
      </div>
      <van-button
        class="cancel-edit-button"
        icon="cross"
        plain
        size="small"
        @click="handleCancelEdit"
      />
    </div>

    <!-- 回复模式横幅 -->
    <div v-else-if="replyingToMessage" class="reply-banner">
      <div class="reply-info">
        <van-icon name="replay" size="16" />
        <div class="reply-content">
          <span class="reply-label">回复消息</span>
          <span class="reply-text">{{ getReplyPreviewText(replyingToMessage) }}</span>
        </div>
      </div>
      <van-button
        class="cancel-reply-button"
        icon="cross"
        plain
        size="small"
        @click="handleCancelReply"
      />
    </div>

    <!-- 普通输入模式 -->
    <div v-if="!recordingState.isRecording && !recordingState.isLocked" class="normal-input">
      <van-field
        v-model="inputText"
        type="textarea"
        :autosize="{ minHeight: 40, maxHeight: 120 }"
        placeholder="输入消息..."
        :rows="1"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeyDown"
      />

      <div class="input-buttons">
        <!-- 语音按钮（始终可见） -->
        <van-button
          class="icon-button voice-button"
          icon="volume-o"
          plain
          @click.prevent.stop
          @touchstart.prevent.stop="handleVoiceStart"
          @touchmove.prevent.stop="handleVoiceMove"
          @touchend.prevent.stop="handleVoiceEnd"
          @touchcancel.prevent.stop="handleVoiceEnd"
          @mousedown.prevent.stop="handleVoiceStart"
        />

        <!-- 发送按钮（有文本时）或加号按钮（无文本时） -->
        <van-button
          v-if="inputText.trim()"
          class="icon-button send-button"
          icon="success"
          plain
          @click="handleSend"
        />
        <van-button
          v-else
          class="icon-button"
          icon="plus"
          plain
          @click="toggleToolbar"
        />
      </div>
    </div>

    <!-- 录音模式（按住，未锁定） -->
    <div v-else-if="recordingState.isRecording && !recordingState.isLocked" class="recording-input">
      <div class="recording-content">
        <div class="recording-info">
          <!-- 波形动画 -->
          <div class="waveform">
            <div
              v-for="i in 3"
              :key="i"
              class="wave-bar"
              :style="{ animationDelay: `${i * 0.15}s` }"
            />
          </div>

          <!-- 时长 -->
          <span class="duration">{{ formattedDuration }}</span>
        </div>

        <!-- 手势提示 -->
        <div class="gesture-hints">
          <div class="hint lock-hint" :class="{ active: recordingState.showLockHint }">
            <van-icon name="arrow-up" size="16" />
            <span>锁定</span>
          </div>
          <div class="hint cancel-hint" :class="{ active: recordingState.showCancelHint }">
            <van-icon name="arrow-left" size="16" />
            <span>取消</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 锁定模式（录音中） -->
    <div v-else-if="recordingState.isLocked && !recordingState.showPreview" class="locked-input">
      <div class="locked-content">
        <!-- 录音指示器 -->
        <div class="recording-indicator">
          <div class="red-dot" />
          <span class="duration">{{ formattedDuration }}</span>
        </div>

        <!-- 锁定模式控制按钮 -->
        <div class="locked-controls">
          <van-button
            class="icon-button cancel-button"
            icon="delete-o"
            plain
            @click="handleCancelRecording"
          />
          <van-button
            class="icon-button pause-button"
            icon="pause-circle-o"
            plain
            @click="handlePauseRecording"
          />
        </div>
      </div>
    </div>

    <!-- 预览模式（暂停后） -->
    <div v-else-if="recordingState.showPreview" class="preview-input">
      <div class="preview-content">
        <!-- 播放/暂停按钮 -->
        <van-button
          class="icon-button play-button"
          plain
          :icon="recordingState.isPlaying ? 'pause-circle' : 'play-circle'"
          @click="handleTogglePlayback"
        />

        <!-- 波形显示区域 -->
        <div class="waveform-wrapper">
          <div ref="waveformContainerRef" class="waveform-display"></div>
          <span class="duration">{{ formattedDuration }}</span>
        </div>

        <!-- 预览模式控制按钮 -->
        <div class="preview-controls">
          <van-button
            class="icon-button cancel-button"
            icon="delete-o"
            plain
            @click="handleCancelRecording"
          />
          <van-button
            class="icon-button send-button"
            icon="success"
            plain
            @click="handleSendRecording"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { showToast } from 'vant'
import type { RecordingState } from '@/types/voice'
import type { Message } from '@/types/message'
import { useWaveSurfer } from '@/composables/useWaveSurfer'

interface Props {
  editingMessage?: Message | null
  replyingToMessage?: Message | null
}

withDefaults(defineProps<Props>(), {
  editingMessage: null,
  replyingToMessage: null,
})

const inputText = ref('')
const isFocused = ref(false)
const isVoicePressed = ref(false)
const voicePressTimer = ref<number | null>(null)
const voiceStartTime = ref(0)
const waveformContainerRef = ref<HTMLElement | null>(null)
const recordingState = ref<RecordingState>({
  isRecording: false,
  isLocked: false,
  isPaused: false,
  showPreview: false,
  duration: 0,
  showLockHint: false,
  showCancelHint: false,
  audioUrl: '',
  isPlaying: false,
})

// 用于预览播放的 WaveSurfer
const waveSurfer = useWaveSurfer({
  height: 40,
  barWidth: 2,
  barGap: 1,
})

const emit = defineEmits<{
  send: [text: string]
  cancelEdit: []
  cancelReply: []
  focus: []
  blur: []
  toggleToolbar: []
  voiceStart: [event: TouchEvent | MouseEvent]
  voiceMove: [event: TouchEvent | MouseEvent]
  voiceEnd: []
  pauseRecording: []
  cancelRecording: []
  sendRecording: []
}>()

const formattedDuration = computed(() => {
  const mins = Math.floor(recordingState.value.duration / 60)
  const secs = recordingState.value.duration % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const handleSend = () => {
  const text = inputText.value.trim()
  if (text) {
    emit('send', text)
    inputText.value = ''
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  // 如果按下Enter键且没有按Shift键，发送消息
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault() // 防止换行
    handleSend()
  }
  // 如果按下Shift+Enter，允许换行（默认行为）
}

const handleFocus = () => {
  isFocused.value = true
  emit('focus')
}

const handleBlur = () => {
  isFocused.value = false
  emit('blur')
}

const toggleToolbar = () => {
  emit('toggleToolbar')
}

const handleVoiceStart = (event: TouchEvent | MouseEvent) => {
  isVoicePressed.value = true
  voiceStartTime.value = Date.now()

  // 等待 200ms 后再开始录音，以确保是长按而不是点击
  voicePressTimer.value = window.setTimeout(() => {
    if (isVoicePressed.value) {
      emit('voiceStart', event)
    }
  }, 200)
}

const handleVoiceMove = (event: TouchEvent | MouseEvent) => {
  if (isVoicePressed.value && recordingState.value.isRecording) {
    emit('voiceMove', event)
  }
}

const handleVoiceEnd = () => {
  const wasPressed = isVoicePressed.value
  const holdDuration = wasPressed ? Date.now() - voiceStartTime.value : 0

  if (voicePressTimer.value) {
    clearTimeout(voicePressTimer.value)
    voicePressTimer.value = null
  }

  if (wasPressed) {
    if (recordingState.value.isRecording) {
      emit('voiceEnd')
    } else if (holdDuration >= 200) {
      emit('voiceEnd')
    } else if (holdDuration < 200) {
      showToast({
        message: '长按录音',
        position: 'top',
        duration: 1500,
        className: 'voice-record-toast',
      })
    }

    isVoicePressed.value = false
    voiceStartTime.value = 0
  }
}

const handlePauseRecording = () => {
  emit('pauseRecording')
}

const handleCancelRecording = () => {
  emit('cancelRecording')
}

const handleTogglePlayback = () => {
  waveSurfer.togglePlayback()
}

const handleSendRecording = () => {
  emit('sendRecording')
}

const handleCancelEdit = () => {
  emit('cancelEdit')
}

const handleCancelReply = () => {
  emit('cancelReply')
}

const getReplyPreviewText = (message: Message) => {
  switch (message.type) {
    case 'text':
      return message.content
    case 'image':
      return '[图片]'
    case 'video':
      return '[视频]'
    case 'voice':
      return '[语音]'
    case 'file':
      return '[文件]'
    default:
      return message.content
  }
}

const updateRecordingState = (state: RecordingState) => {
  recordingState.value = state
}

// 监听 audioUrl 和 showPreview 变化以初始化波形
watch(() => [recordingState.value.audioUrl, recordingState.value.showPreview] as const, async ([audioUrl, showPreview]) => {
  if (showPreview && audioUrl) {
    await nextTick() // 等待 DOM 更新
    // 添加小延迟以确保 Blob URL 完全准备好
    setTimeout(() => {
      if (waveformContainerRef.value && recordingState.value.showPreview) {
        waveSurfer.initWaveSurfer(waveformContainerRef.value, audioUrl)
      }
    }, 100)
  } else {
    // 当不在预览模式时，销毁 WaveSurfer
    waveSurfer.destroy()
  }
})

// 监听 waveSurfer 的播放状态
watch(() => waveSurfer.isPlaying.value, (isPlaying) => {
  recordingState.value.isPlaying = isPlaying
})

// 鼠标事件的全局监听器
onMounted(() => {
  document.addEventListener('mousemove', handleVoiceMove)
  document.addEventListener('mouseup', handleVoiceEnd)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleVoiceMove)
  document.removeEventListener('mouseup', handleVoiceEnd)
})

defineExpose({
  clear: () => {
    inputText.value = ''
  },
  setText: (text: string) => {
    inputText.value = text
  },
  updateRecordingState,
})
</script>

<style scoped>
.message-input {
  background-color: #f7f8fa;
  border-top: 1px solid #ebedf0;
  padding: 12px;
  min-height: 64px;
}

/* 编辑横幅 */
.edit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(135deg, #e3f2fd 0%, #f5f5f5 100%);
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 3px solid var(--van-primary-color);
}

.edit-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--van-primary-color);
  font-size: 14px;
  font-weight: 500;
}

.edit-info :deep(.van-icon) {
  color: var(--van-primary-color);
}

.cancel-edit-button {
  min-width: auto !important;
  padding: 4px !important;
  border: none !important;
  background: transparent !important;
}

.cancel-edit-button :deep(.van-icon) {
  color: #969799;
  font-size: 18px;
}

/* 回复横幅 */
.reply-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #f5f5f5 100%);
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 3px solid #07c160;
}

.reply-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #07c160;
  flex: 1;
  min-width: 0;
}

.reply-info :deep(.van-icon) {
  color: #07c160;
  flex-shrink: 0;
  margin-top: 2px;
}

.reply-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.reply-label {
  font-size: 12px;
  font-weight: 500;
  color: #07c160;
}

.reply-text {
  font-size: 13px;
  color: #646566;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cancel-reply-button {
  min-width: auto !important;
  padding: 4px !important;
  border: none !important;
  background: transparent !important;
  flex-shrink: 0;
}

.cancel-reply-button :deep(.van-icon) {
  color: #969799;
  font-size: 18px;
}

/* 普通输入模式 */
.normal-input {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #f5f5f5 0%, #fff 100%);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  min-height: 52px;
}

.normal-input :deep(.van-field) {
  flex: 1;
  background-color: transparent;
  border: none;
  padding: 0;
}

.normal-input :deep(.van-field__control) {
  font-size: 16px;
  line-height: 1.5;
  background-color: transparent;
}

.input-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

/* 统一按钮样式（无边框、无背景） */
.icon-button {
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  transition: all 0.2s ease;
}

.icon-button :deep(.van-icon) {
  font-size: 24px;
  color: #646566;
}

.icon-button:active {
  transform: scale(0.9);
  opacity: 0.6;
}

/* 按钮颜色变化 */
.send-button :deep(.van-icon) {
  color: var(--van-primary-color);
}

.cancel-button :deep(.van-icon) {
  color: #ee0a24;
}

.pause-button :deep(.van-icon),
.play-button :deep(.van-icon) {
  color: var(--van-primary-color);
}

/* 录音模式 */
.recording-input {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, #fff7f0 0%, #fff 100%);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  min-height: 52px;
}

.recording-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
}

.recording-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.waveform {
  display: flex;
  gap: 4px;
  align-items: center;
}

.wave-bar {
  width: 4px;
  height: 14px;
  background: linear-gradient(to top, var(--van-primary-color), #66b3ff);
  border-radius: 2px;
  animation: wave 1.2s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% {
    height: 14px;
    opacity: 0.6;
  }
  50% {
    height: 24px;
    opacity: 1;
  }
}

.duration {
  font-size: 15px;
  font-weight: 600;
  color: var(--van-text-color);
  font-variant-numeric: tabular-nums;
  min-width: 45px;
}

.gesture-hints {
  display: flex;
  gap: 12px;
}

.hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #969799;
  transition: all 0.2s;
  padding: 6px 10px;
  border-radius: 8px;
  background: transparent;
}

.hint :deep(.van-icon) {
  font-size: 16px;
}

.hint.active {
  color: var(--van-primary-color);
  background: rgba(25, 137, 250, 0.08);
}

.hint span {
  white-space: nowrap;
  font-weight: 500;
}

/* 锁定模式 */
.locked-input {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, #fff8e1 0%, #fff 100%);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.1);
  min-height: 52px;
}

.locked-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.red-dot {
  width: 10px;
  height: 10px;
  background: #ff3b30;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.2);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.95);
  }
}

.locked-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 预览模式 */
.preview-input {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, #e3f2fd 0%, #fff 100%);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
  min-height: 52px;
}

.preview-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.waveform-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.waveform-display {
  flex: 1;
  min-width: 0;
  height: 40px;
}

.preview-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

</style>

<style>
/* 语音录音提示的全局样式 */
.voice-record-toast {
  background-color: rgba(0, 0, 0, 0.8) !important;
}

.voice-record-toast .van-toast__text {
  color: #ffffff !important;
}
</style>
