<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    :style="{ height: '100%' }"
    @closed="handleClose"
  >
    <div class="camera-modal">
      <div class="camera-header">
        <van-icon name="cross" size="24" color="#fff" @click="handleClose" />
        <span class="title">{{ mode === 'photo' ? '拍照' : '录制视频' }}</span>
        <van-icon
          :name="mode === 'photo' ? 'video-o' : 'photograph'"
          size="24"
          color="#fff"
          @click="toggleMode"
        />
      </div>

      <div class="camera-preview">
        <video v-show="!capturedImage && !recordedVideo" ref="videoRef" autoplay playsinline class="video-preview"></video>
        <canvas ref="canvasRef" class="canvas-hidden"></canvas>

        <!-- 照片预览 -->
        <div v-if="capturedImage" class="preview-image">
          <img :src="capturedImage" alt="已拍摄" />
        </div>

        <!-- 视频预览 -->
        <div v-if="recordedVideo" class="preview-video">
          <video :src="recordedVideo" controls playsinline class="video-preview"></video>
        </div>

        <!-- 录制指示器 -->
        <div v-if="isRecording" class="recording-indicator">
          <span class="recording-dot"></span>
          <span class="recording-time">{{ formattedRecordingTime }}</span>
        </div>
      </div>

      <div class="camera-controls">
        <!-- 拍照模式控制 -->
        <template v-if="mode === 'photo'">
          <van-button
            v-if="!capturedImage"
            round
            type="primary"
            size="large"
            icon="photograph"
            @click="capturePhoto"
          >
            拍摄
          </van-button>
          <template v-else>
            <van-button round size="large" @click="retake">
              重拍
            </van-button>
            <van-button round type="primary" size="large" @click="sendPhoto">
              发送
            </van-button>
          </template>
        </template>

        <!-- 视频模式控制 -->
        <template v-else>
          <van-button
            v-if="!recordedVideo && !isRecording"
            round
            type="danger"
            size="large"
            icon="play-circle"
            @click="startRecording"
          >
            录制
          </van-button>
          <van-button
            v-if="isRecording"
            round
            type="primary"
            size="large"
            icon="stop-circle"
            @click="stopRecording"
          >
            停止
          </van-button>
          <template v-if="recordedVideo && !isRecording">
            <van-button round size="large" @click="retakeVideo">
              重录
            </van-button>
            <van-button round type="primary" size="large" @click="sendVideo">
              发送
            </van-button>
          </template>
        </template>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:show': [value: boolean]
  'photo-captured': [dataUrl: string]
  'video-captured': [videoBlob: Blob, duration: number, thumbnail: string]
}>()

const visible = ref(props.show)
const mode = ref<'photo' | 'video'>('photo')
const videoRef = ref<HTMLVideoElement>()
const canvasRef = ref<HTMLCanvasElement>()
const stream = ref<MediaStream | null>(null)
const capturedImage = ref<string>('')
const recordedVideo = ref<string>('')
const isRecording = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])
const recordingStartTime = ref(0)
const recordingTime = ref(0)
const recordingTimer = ref<number | null>(null)

const formattedRecordingTime = computed(() => {
  const mins = Math.floor(recordingTime.value / 60)
  const secs = recordingTime.value % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

watch(() => props.show, async (newValue) => {
  visible.value = newValue
  if (newValue) {
    await startCamera()
  } else {
    stopCamera()
  }
})

watch(visible, (newValue) => {
  emit('update:show', newValue)
})

const startCamera = async () => {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: mode.value === 'video'
    })

    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
    }
  } catch (error) {
    emit('update:show', false)
  }
}

const toggleMode = async () => {
  if (isRecording.value || capturedImage.value || recordedVideo.value) return

  mode.value = mode.value === 'photo' ? 'video' : 'photo'
  stopCamera()
  await startCamera()
}

const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
}

const capturePhoto = () => {
  if (!videoRef.value || !canvasRef.value) {
    return
  }

  const video = videoRef.value
  const canvas = canvasRef.value

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return
  }

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

    stopCamera()

    capturedImage.value = dataUrl
  }
}

const retake = async () => {
  capturedImage.value = ''
  await startCamera()
}

const startRecording = () => {
  if (!stream.value) return

  recordedChunks.value = []
  mediaRecorder.value = new MediaRecorder(stream.value, {
    mimeType: 'video/webm'
  })

  mediaRecorder.value.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.value.push(event.data)
    }
  }

  mediaRecorder.value.onstop = () => {
    const videoBlob = new Blob(recordedChunks.value, { type: 'video/webm' })
    recordedVideo.value = URL.createObjectURL(videoBlob)
    stopCamera()
  }

  mediaRecorder.value.start()
  isRecording.value = true
  recordingStartTime.value = Date.now()
  recordingTime.value = 0

  recordingTimer.value = window.setInterval(() => {
    recordingTime.value = Math.floor((Date.now() - recordingStartTime.value) / 1000)
    if (recordingTime.value >= 300) {
      stopRecording()
    }
  }, 1000)
}

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false

    if (recordingTimer.value) {
      clearInterval(recordingTimer.value)
      recordingTimer.value = null
    }
  }
}

const createVideoThumbnail = async (): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = recordedVideo.value
    video.currentTime = 0.5

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        resolve(canvas.toDataURL('image/jpeg'))
      }
    }
  })
}

const retakeVideo = async () => {
  if (recordedVideo.value) {
    URL.revokeObjectURL(recordedVideo.value)
  }
  recordedVideo.value = ''
  recordingTime.value = 0
  await startCamera()
}

const sendPhoto = () => {
  if (capturedImage.value) {
    emit('photo-captured', capturedImage.value)
    handleClose()
  }
}

const sendVideo = async () => {
  if (recordedVideo.value && recordedChunks.value.length > 0) {
    const videoBlob = new Blob(recordedChunks.value, { type: 'video/webm' })
    const thumbnail = await createVideoThumbnail()
    emit('video-captured', videoBlob, recordingTime.value, thumbnail)
    handleClose()
  }
}

const handleClose = () => {
  stopCamera()
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
  if (recordedVideo.value) {
    URL.revokeObjectURL(recordedVideo.value)
  }
  capturedImage.value = ''
  recordedVideo.value = ''
  recordingTime.value = 0
  isRecording.value = false
  mode.value = 'photo'
  emit('update:show', false)
}

onBeforeUnmount(() => {
  stopCamera()
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
  }
  if (recordedVideo.value) {
    URL.revokeObjectURL(recordedVideo.value)
  }
})
</script>

<style scoped>
.camera-modal {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #000;
}

.camera-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
}

.camera-header .title {
  font-size: 18px;
  font-weight: 500;
}

.camera-preview {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.canvas-hidden {
  display: none;
}

.preview-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  z-index: 10;
}

.preview-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.camera-controls {
  padding: 24px;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  gap: 12px;
  justify-content: center;
}

.camera-controls .van-button {
  flex: 1;
  max-width: 200px;
}

.preview-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  z-index: 10;
}

.preview-video video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.recording-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 20px;
  z-index: 20;
}

.recording-dot {
  width: 12px;
  height: 12px;
  background-color: #ff4444;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.8);
  }
}

.recording-time {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  font-family: monospace;
}

.camera-header .van-icon {
  cursor: pointer;
}
</style>
