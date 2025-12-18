export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  VOICE = 'voice',
  FILE = 'file',
  SYSTEM = 'system'
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  type: MessageType
  content: string        // text content or file URL
  thumbnail?: string     // for video/image preview
  duration?: number      // for voice/video in seconds
  timestamp: number
  status: MessageStatus
  isEdited: boolean
  isRecalled?: boolean   // whether the message was recalled
  isForwarded?: boolean  // whether the message was forwarded
  replyTo?: string      // replied message ID
}
