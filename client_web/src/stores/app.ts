import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const width = ref(window.innerWidth)
  const height = ref(window.innerHeight)

  const show_width = computed(() => {
    const viewportWidth = width.value

    // 移动端：使用全宽
    if (viewportWidth < 768) {
      return viewportWidth
    }

    // 平板：最大 600px
    if (viewportWidth < 1024) {
      return Math.min(viewportWidth, 600)
    }

    // 桌面端：最大 800px
    return Math.min(viewportWidth, 800)
  })

  const changeSize = (newWidth: number, newHeight: number) => {
    width.value = newWidth
    height.value = newHeight
  }

  return {
    width,
    height,
    show_width,
    changeSize,
  }
})
