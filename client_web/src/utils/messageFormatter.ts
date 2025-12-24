/**
 * 消息格式化工具类
 * 集中处理消息类型预览和图标逻辑
 *
 * 消除了 ChatListItem、MessageBubble、MessageInput 中的重复代码
 */

import type { MessageType } from '@/types/message'

/**
 * 根据消息类型获取预览文本
 * 替换了 3 个组件中的 switch 语句
 */
export function getMessagePreview(type: MessageType, content: string): string {
  switch (type) {
    case 'text':
      return content
    case 'image':
      return '[图片]'
    case 'video':
      return '[视频]'
    case 'voice':
      return '[语音]'
    case 'file':
      return '[文件]'
    case 'system':
      return content
    default:
      return content
  }
}

/**
 * 根据消息类型获取对应的图标名称
 * 用于显示消息类型的视觉提示
 */
export function getMessageTypeIcon(type: MessageType): string {
  const icons: Record<string, string> = {
    image: 'photo-o',
    video: 'video-o',
    voice: 'volume-o',
    file: 'description',
  }

  return icons[type] || 'chat-o'
}
