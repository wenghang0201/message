import { ref } from 'vue'
import { useAudioRecorder } from './useAudioRecorder'
import { useGestureTracking } from './useGestureTracking'
import type { RecordingState } from '@/types/voice'

export interface VoiceRecordingCallbacks {
  onStateChange?: (state: RecordingState) => void
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void
  onError?: (error: Error) => void
}

/**
 * 结合音频录制、手势跟踪和状态管理
 */
export function useVoiceRecordingWorkflow(callbacks?: VoiceRecordingCallbacks) {
  // 组件状态
  const isLocked = ref(false)
  const isPaused = ref(false)
  const showPreview = ref(false)
  const shouldSendImmediately = ref(false)
  const shouldShowPreview = ref(false)

  // 组合式函数
  const audioRecorder = useAudioRecorder({
    onAudioReady: () => {
      if (shouldSendImmediately.value) {
        shouldSendImmediately.value = false
        sendImmediately()
      }
      if (shouldShowPreview.value) {
        shouldShowPreview.value = false
        showPreview.value = true
        emitState()
      }
    },
    onError: (error) => {
      if (callbacks?.onError) {
        callbacks.onError(error)
      }
      reset()
    },
    onDurationUpdate: () => {
      emitState()
    },
  })

  const gesture = useGestureTracking()

  const emitState = () => {
    if (callbacks?.onStateChange) {
      callbacks.onStateChange({
        isRecording: audioRecorder.isRecording.value,
        isLocked: isLocked.value,
        isPaused: isPaused.value,
        showPreview: showPreview.value,
        duration: audioRecorder.duration.value,
        showLockHint: gesture.showLockHint.value,
        showCancelHint: gesture.showCancelHint.value,
        audioUrl: audioRecorder.audioUrl.value,
        isPlaying: false,
      })
    }
  }

  const startRecording = async (event: TouchEvent | MouseEvent) => {
    await audioRecorder.startRecording()
    isLocked.value = false
    isPaused.value = false
    gesture.startTracking(event)
    emitState()
  }

  const handleMove = (event: TouchEvent | MouseEvent) => {
    if (!audioRecorder.isRecording.value || isLocked.value) return

    const { shouldLock } = gesture.handleMove(event)
    emitState()

    if (shouldLock) {
      lockRecording()
    }
  }

  const handleRelease = () => {
    if (isLocked.value) return

    if (gesture.showCancelHint.value) {
      cancelRecording()
      return
    }

    // 如果录音正在进行，停止并发送
    if (audioRecorder.isRecording.value || audioRecorder.mediaRecorder.value) {
      shouldSendImmediately.value = true
      audioRecorder.stopRecording()
    } else {
      // 如果录音还没开始（可能正在请求权限），取消录音
      audioRecorder.cancelRecording()
    }
  }

  const lockRecording = () => {
    isLocked.value = true
    gesture.showLockHint.value = false
    gesture.showCancelHint.value = false
    emitState()
  }

  const pauseRecording = () => {
    if (!isLocked.value) return

    isPaused.value = true
    shouldShowPreview.value = true
    audioRecorder.stopRecording()
    emitState()
  }

  const cancelRecording = () => {
    audioRecorder.cancelRecording()
    reset()
  }

  const sendRecording = () => {
    if (audioRecorder.audioBlob.value) {
      sendImmediately()
    }
  }

  const sendImmediately = () => {
    if (audioRecorder.audioBlob.value && callbacks?.onRecordingComplete) {
      callbacks.onRecordingComplete(audioRecorder.audioBlob.value, audioRecorder.duration.value)
      reset()
    }
  }

  const reset = () => {
    audioRecorder.reset()
    gesture.reset()
    isLocked.value = false
    isPaused.value = false
    showPreview.value = false
    shouldSendImmediately.value = false
    shouldShowPreview.value = false
    emitState()
  }

  return {
    // 状态（只读）
    isRecording: audioRecorder.isRecording,
    isLocked,
    isPaused,
    showPreview,
    duration: audioRecorder.duration,

    // 方法
    startRecording,
    handleMove,
    handleRelease,
    pauseRecording,
    cancelRecording,
    sendRecording,
    reset,
  }
}
