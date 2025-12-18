export interface RecordingState {
  isRecording: boolean
  isLocked: boolean
  isPaused: boolean
  showPreview: boolean
  duration: number
  showLockHint: boolean
  showCancelHint: boolean
  audioUrl?: string
  isPlaying?: boolean
}
