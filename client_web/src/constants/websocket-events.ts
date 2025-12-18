/**
 * WebSocket事件常量
 * 集中管理所有WebSocket事件名称，避免硬编码和拼写错误
 * 与后端保持一致
 */

export enum WebSocketEvent {
  // 客户端 -> 服务器事件
  JOIN_CONVERSATION = 'join-conversation',
  LEAVE_CONVERSATION = 'leave-conversation',

  // 服务器 -> 客户端事件
  NEW_MESSAGE = 'new-message',
  MESSAGE_READ = 'message-read',
  MESSAGE_DELETED = 'message-deleted',
  MESSAGE_UPDATED = 'message-updated',
  NEW_CONVERSATION = 'new-conversation',
  CONVERSATION_UPDATED = 'conversation-updated',
  CONVERSATION_DELETED = 'conversation-deleted',
  GROUP_NAME_UPDATED = 'group-name-updated',
  GROUP_AVATAR_UPDATED = 'group-avatar-updated',
  GROUP_DISBANDED = 'group-disbanded',
  MEMBER_ROLE_UPDATED = 'member-role-updated',
  MEMBER_LEFT_GROUP = 'member-left-group',
  FRIEND_REQUEST = 'friend-request',
  FRIEND_REQUEST_ACCEPTED = 'friend-request-accepted',
  USER_STATUS_CHANGED = 'user-status-changed',

  // 连接事件
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
}

/**
 * 类型安全的事件数据接口
 */
export interface WebSocketEventData {
  [WebSocketEvent.NEW_MESSAGE]: {
    id: string;
    conversationId: string;
    senderId: string;
    type: string;
    content: string;
    createdAt: string;
    editedAt?: string | null;
    replyToMessageId?: string | null;
  };

  [WebSocketEvent.MESSAGE_READ]: {
    userId: string;
    conversationId: string;
    messageId: string;
  };

  [WebSocketEvent.MESSAGE_DELETED]: {
    messageId: string;
  };

  [WebSocketEvent.MESSAGE_UPDATED]: {
    messageId: string;
    content: string;
    editedAt: string;
  };

  [WebSocketEvent.NEW_CONVERSATION]: {
    id: string;
    type: 'single' | 'group';
    name?: string;
    avatarUrl?: string | null;
    createdById: string;
    createdAt: string;
  };

  [WebSocketEvent.CONVERSATION_UPDATED]: {
    id: string;
    name?: string;
    avatarUrl?: string | null;
  };

  [WebSocketEvent.CONVERSATION_DELETED]: {
    conversationId: string;
  };

  [WebSocketEvent.GROUP_NAME_UPDATED]: {
    conversationId: string;
    name: string;
    updatedBy: string;
  };

  [WebSocketEvent.GROUP_AVATAR_UPDATED]: {
    conversationId: string;
    avatarUrl: string;
    updatedBy: string;
  };

  [WebSocketEvent.GROUP_DISBANDED]: {
    conversationId: string;
    disbandedAt: string;
    disbandedBy: string;
  };

  [WebSocketEvent.MEMBER_ROLE_UPDATED]: {
    conversationId: string;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    updatedBy: string;
  };

  [WebSocketEvent.MEMBER_LEFT_GROUP]: {
    conversationId: string;
    userId: string;
  };

  [WebSocketEvent.FRIEND_REQUEST]: {
    id: string;
    requesterId: string;
    requesterName: string;
    requesterAvatar?: string | null;
    createdAt: string;
  };

  [WebSocketEvent.FRIEND_REQUEST_ACCEPTED]: {
    friendshipId: string;
    userId: string;
    userName: string;
    userAvatar?: string | null;
  };

  [WebSocketEvent.USER_STATUS_CHANGED]: {
    userId: string;
    isOnline: boolean;
    lastSeenAt?: string | null;
  };

  [WebSocketEvent.JOIN_CONVERSATION]: string;
  [WebSocketEvent.LEAVE_CONVERSATION]: string;
}
