import { ref, onBeforeUnmount } from 'vue'
import WaveSurfer from 'wavesurfer.js'

export interface WaveSurferOptions {
  waveColor?: string
  progressColor?: string
  cursorColor?: string
  barWidth?: number
  barGap?: number
  barRadius?: number
  height?: number
  normalize?: boolean
}

export function useWaveSurfer(options?: WaveSurferOptions) {
  const wavesurfer = ref<WaveSurfer | null>(null)
  const isPlaying = ref(false)
  const waveformRef = ref<HTMLElement | null>(null)

  const defaultOptions: WaveSurferOptions = {
    waveColor: '#dcdee0',
    progressColor: 'var(--van-primary-color)',
    cursorColor: 'var(--van-primary-color)',
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: 40,
    normalize: true,
  }

  const initWaveSurfer = (container: HTMLElement, audioUrl: string) => {
    // 销毁现有实例
    if (wavesurfer.value) {
      wavesurfer.value.destroy()
    }

    waveformRef.value = container

    // 创建新的 WaveSurfer 实例
    wavesurfer.value = WaveSurfer.create({
      container,
      ...defaultOptions,
      ...options,
      backend: 'MediaElement', // 使用 MediaElement 以避免音频上下文问题
      mediaControls: false,
    })

    // 加载音频
    wavesurfer.value.load(audioUrl)

    // 监听播放/暂停事件
    wavesurfer.value.on('play', () => {
      isPlaying.value = true
    })

    wavesurfer.value.on('pause', () => {
      isPlaying.value = false
    })

    wavesurfer.value.on('finish', () => {
      isPlaying.value = false
    })

    return wavesurfer.value
  }

  const togglePlayback = async () => {
    if (!wavesurfer.value) return

    try {
      if (wavesurfer.value.isPlaying()) {
        wavesurfer.value.pause()
      } else {
        await wavesurfer.value.play()
      }
    } catch (error) {
      // 忽略错误
    }
  }

  const play = async () => {
    if (wavesurfer.value) {
      try {
        await wavesurfer.value.play()
      } catch (error) {
        // 忽略错误
      }
    }
  }

  const pause = () => {
    if (wavesurfer.value) {
      wavesurfer.value.pause()
    }
  }

  const destroy = () => {
    if (wavesurfer.value) {
      wavesurfer.value.destroy()
      wavesurfer.value = null
    }
  }

  onBeforeUnmount(() => {
    destroy()
  })

  return {
    wavesurfer,
    isPlaying,
    waveformRef,
    initWaveSurfer,
    togglePlayback,
    play,
    pause,
    destroy,
  }
}
