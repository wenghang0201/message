import { ref, onBeforeUnmount } from 'vue'

export interface UseMessageReadObserverOptions {
  onMessageVisible?: (messageId: string) => void
  threshold?: number
}

/**
 * 使用 Intersection Observer 监听消息是否可见
 * 当消息进入可视区域时触发回调
 */
export function useMessageReadObserver(options?: UseMessageReadObserverOptions) {
  const observer = ref<IntersectionObserver | null>(null)
  const observedElements = new Map<Element, string>() // 存储元素和对应的 messageId

  const threshold = options?.threshold ?? 0.5 // 默认 50% 可见时触发

  // 创建 Intersection Observer
  const createObserver = () => {
    if (observer.value) return

    observer.value = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 当元素进入可视区域且可见度超过阈值
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            const messageId = observedElements.get(entry.target)
            if (messageId && options?.onMessageVisible) {
              options.onMessageVisible(messageId)
              // 触发后停止观察该元素
              unobserve(entry.target)
            }
          }
        })
      },
      {
        root: null, // 使用视口作为根
        threshold: threshold,
        rootMargin: '0px',
      }
    )
  }

  /**
   * 开始观察一个元素
   */
  const observe = (element: Element, messageId: string) => {
    if (!observer.value) {
      createObserver()
    }

    if (observer.value && element) {
      observedElements.set(element, messageId)
      observer.value.observe(element)
    }
  }

  /**
   * 停止观察一个元素
   */
  const unobserve = (element: Element) => {
    if (observer.value && element) {
      observer.value.unobserve(element)
      observedElements.delete(element)
    }
  }

  /**
   * 停止观察所有元素
   */
  const disconnect = () => {
    if (observer.value) {
      observer.value.disconnect()
      observedElements.clear()
    }
  }

  // 组件卸载时清理
  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    observe,
    unobserve,
    disconnect,
  }
}
