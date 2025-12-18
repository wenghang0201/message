import { ref } from 'vue'

/**
 * 手势阈值配置接口
 */
export interface GestureThresholds {
  /** 显示锁定提示的阈值（像素） */
  lockHintThreshold?: number
  /** 显示取消提示的阈值（像素） */
  cancelHintThreshold?: number
  /** 触发锁定的阈值（像素） */
  lockThreshold?: number
}

/**
 * 手势追踪 Composable
 * 用于追踪触摸/鼠标手势并根据滑动距离显示提示或触发操作
 *
 * @param thresholds - 可选的自定义阈值配置
 * @returns 手势追踪状态和控制方法
 */
export function useGestureTracking(thresholds?: GestureThresholds) {
  // 起始位置
  const startY = ref(0)
  const startX = ref(0)

  // 提示状态
  const showLockHint = ref(false)
  const showCancelHint = ref(false)

  // 默认阈值配置
  const defaultThresholds = {
    lockHintThreshold: 50,    // 上滑 50px 显示锁定提示
    cancelHintThreshold: 50,  // 左滑 50px 显示取消提示
    lockThreshold: 100,       // 上滑 100px 触发锁定
  }

  const config = { ...defaultThresholds, ...thresholds }

  /**
   * 开始追踪手势
   * 记录起始位置并重置提示状态
   */
  const startTracking = (event: TouchEvent | MouseEvent) => {
    if ('touches' in event) {
      // 触摸事件
      startY.value = event.touches[0].clientY
      startX.value = event.touches[0].clientX
    } else {
      // 鼠标事件
      startY.value = event.clientY
      startX.value = event.clientX
    }

    // 重置提示
    showLockHint.value = false
    showCancelHint.value = false
  }

  /**
   * 处理移动事件
   * 计算滑动距离并更新提示状态
   *
   * @returns 包含是否应该锁定的对象
   */
  const handleMove = (event: TouchEvent | MouseEvent): { shouldLock: boolean } => {
    const currentY = 'touches' in event ? event.touches[0].clientY : event.clientY
    const currentX = 'touches' in event ? event.touches[0].clientX : event.clientX

    // 计算滑动距离（正值表示向上/向左滑动）
    const deltaY = startY.value - currentY
    const deltaX = startX.value - currentX

    // 根据滑动距离更新提示状态
    showLockHint.value = deltaY > config.lockHintThreshold
    showCancelHint.value = deltaX > config.cancelHintThreshold

    return {
      shouldLock: deltaY > config.lockThreshold,
    }
  }

  /**
   * 重置追踪状态
   * 清空所有位置和提示状态
   */
  const reset = () => {
    startY.value = 0
    startX.value = 0
    showLockHint.value = false
    showCancelHint.value = false
  }

  return {
    startY,
    startX,
    showLockHint,
    showCancelHint,
    startTracking,
    handleMove,
    reset,
  }
}
