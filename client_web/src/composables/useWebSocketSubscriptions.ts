/**
 * WebSocket 订阅管理 Composable
 * 简化 WebSocket 事件订阅和自动清理
 *
 * 消除了 ChatDetail 和 ChatList 中的样板代码
 */

import { onUnmounted } from 'vue'

type UnsubscribeFn = () => void

export function useWebSocketSubscriptions() {
  const subscriptions: UnsubscribeFn[] = []

  /**
   * 添加订阅
   * 订阅将在组件卸载时自动清理
   */
  function subscribe(unsubscribe: UnsubscribeFn) {
    subscriptions.push(unsubscribe)
  }

  /**
   * 取消所有订阅
   */
  function unsubscribeAll() {
    subscriptions.forEach((unsub) => unsub())
    subscriptions.length = 0
  }

  // 组件卸载时自动清理所有订阅
  onUnmounted(() => {
    unsubscribeAll()
  })

  return {
    subscribe,
    unsubscribeAll,
  }
}
