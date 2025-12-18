import { ref } from 'vue'

export interface AudioRecorderCallbacks {
  onAudioReady?: (audioBlob: Blob, audioUrl: string, mimeType: string) => void
  onError?: (error: Error) => void
  onDurationUpdate?: (duration: number) => void
}

export function useAudioRecorder(callbacks?: AudioRecorderCallbacks) {
  const isRecording = ref(false)
  const audioBlob = ref<Blob | null>(null)
  const audioUrl = ref('')
  const duration = ref(0)
  const mimeType = ref('audio/webm')
  const timer = ref<number | null>(null)
  const mediaRecorder = ref<MediaRecorder | null>(null)
  const audioChunks = ref<Blob[]>([])
  const startTime = ref(0)
  const pausedTime = ref(0)
  const shouldCancelRecording = ref(false) // 用于取消录音的标志

  const getSupportedMimeType = (): string => {
    const supportedTypes = [
      'audio/mp4',
      'audio/mpeg',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ]

    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return 'audio/webm'
  }

  const startRecording = async () => {
    try {
      // 重置取消标志
      shouldCancelRecording.value = false

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // 在获取权限后检查是否已被取消（用户可能已经释放按钮）
      if (shouldCancelRecording.value) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      mimeType.value = getSupportedMimeType()
      mediaRecorder.value = new MediaRecorder(stream, { mimeType: mimeType.value })
      audioChunks.value = []

      mediaRecorder.value.ondataavailable = (e) => {
        audioChunks.value.push(e.data)
      }

      mediaRecorder.value.onstop = async () => {
        // 检查录音时长，太短的录音可能无法正常解码
        const recordDuration = Math.floor((Date.now() - startTime.value - pausedTime.value) / 1000)

        if (audioChunks.value.length === 0 || recordDuration < 1) {
          if (callbacks?.onError) {
            callbacks.onError(new Error('录音时长太短'))
          }
          stream.getTracks().forEach(track => track.stop())
          return
        }

        audioBlob.value = new Blob(audioChunks.value, { type: mimeType.value })

        // 检查 blob 大小
        if (audioBlob.value.size < 100) {
          if (callbacks?.onError) {
            callbacks.onError(new Error('音频数据无效'))
          }
          stream.getTracks().forEach(track => track.stop())
          return
        }

        // 使用 Blob URL 而不是 Data URL，以提高性能和兼容性
        audioUrl.value = URL.createObjectURL(audioBlob.value)

        if (callbacks?.onAudioReady && audioBlob.value) {
          callbacks.onAudioReady(audioBlob.value, audioUrl.value, mimeType.value)
        }

        stream.getTracks().forEach(track => track.stop())
      }

      // 使用 timeslice 参数确保定期收集音频数据（每 100ms）
      mediaRecorder.value.start(100)
      isRecording.value = true
      startTime.value = Date.now()
      pausedTime.value = 0
      duration.value = 0

      // 启动计时器
      timer.value = window.setInterval(() => {
        duration.value = Math.floor((Date.now() - startTime.value - pausedTime.value) / 1000)
        if (callbacks?.onDurationUpdate) {
          callbacks.onDurationUpdate(duration.value)
        }
      }, 1000)

    } catch (error) {
      if (callbacks?.onError) {
        callbacks.onError(error as Error)
      }
      reset()
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
      isRecording.value = false
    }

    if (timer.value) {
      clearInterval(timer.value)
      timer.value = null
    }
  }

  const cancelRecording = () => {
    // 设置取消标志，防止权限请求后开始录音
    shouldCancelRecording.value = true

    // 如果正在录音，立即停止
    if (isRecording.value) {
      stopRecording()
    }

    reset()
  }

  const reset = () => {
    if (timer.value) {
      clearInterval(timer.value)
      timer.value = null
    }

    if (mediaRecorder.value) {
      const stream = mediaRecorder.value.stream
      stream.getTracks().forEach(track => track.stop())
    }

    // 清理 Blob URL 以释放内存
    if (audioUrl.value && audioUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl.value)
    }

    isRecording.value = false
    audioUrl.value = ''
    audioBlob.value = null
    duration.value = 0
    pausedTime.value = 0
    audioChunks.value = []
    mediaRecorder.value = null
  }

  return {
    isRecording,
    audioBlob,
    audioUrl,
    duration,
    mimeType,
    mediaRecorder,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  }
}
