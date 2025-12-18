import { io, Socket } from 'socket.io-client';
import authService from './auth.service';
import { WebSocketEvent, WebSocketEventData } from '@/constants/websocket-events';

/**
 * WebSocket服务
 * 处理实时消息通信
 */
class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private messageListeners: Set<(message: WebSocketEventData[WebSocketEvent.NEW_MESSAGE]) => void> = new Set();
  private messageDeletedListeners: Set<(messageId: string) => void> = new Set();
  private messageReadListeners: Set<(data: WebSocketEventData[WebSocketEvent.MESSAGE_READ]) => void> = new Set();
  private newConversationListeners: Set<(conversation: WebSocketEventData[WebSocketEvent.NEW_CONVERSATION]) => void> = new Set();
  private groupNameUpdatedListeners: Set<(data: WebSocketEventData[WebSocketEvent.GROUP_NAME_UPDATED]) => void> = new Set();
  private groupAvatarUpdatedListeners: Set<(data: WebSocketEventData[WebSocketEvent.GROUP_AVATAR_UPDATED]) => void> = new Set();
  private groupDisbandedListeners: Set<(data: WebSocketEventData[WebSocketEvent.GROUP_DISBANDED]) => void> = new Set();
  private memberRoleUpdatedListeners: Set<(data: WebSocketEventData[WebSocketEvent.MEMBER_ROLE_UPDATED]) => void> = new Set();
  private memberLeftGroupListeners: Set<(data: WebSocketEventData[WebSocketEvent.MEMBER_LEFT_GROUP]) => void> = new Set();
  private friendRequestListeners: Set<(request: WebSocketEventData[WebSocketEvent.FRIEND_REQUEST]) => void> = new Set();
  private friendRequestAcceptedListeners: Set<(data: WebSocketEventData[WebSocketEvent.FRIEND_REQUEST_ACCEPTED]) => void> = new Set();
  private userStatusChangedListeners: Set<(data: WebSocketEventData[WebSocketEvent.USER_STATUS_CHANGED]) => void> = new Set();
  private currentConversationId: string | null = null;

  /**
   * 连接到WebSocket服务器
   */
  public connect(): void {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    const token = authService.getAccessToken();
    if (!token) {
      return;
    }

    this.isConnecting = true;

    // 从环境变量或配置中获取服务器URL
    const serverUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9003';

    this.socket = io(serverUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      // 重新加入当前会话房间
      if (this.currentConversationId) {
        this.joinConversation(this.currentConversationId);
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnecting = false;
    });

    this.socket.on('connect_error', () => {
      this.isConnecting = false;
      this.reconnectAttempts++;
    });

    this.socket.on(WebSocketEvent.NEW_MESSAGE, (message: WebSocketEventData[WebSocketEvent.NEW_MESSAGE]) => {
      this.messageListeners.forEach(listener => listener(message));
    });

    this.socket.on(WebSocketEvent.MESSAGE_DELETED, (data: WebSocketEventData[WebSocketEvent.MESSAGE_DELETED]) => {
      this.messageDeletedListeners.forEach(listener => listener(data.messageId));
    });

    this.socket.on(WebSocketEvent.MESSAGE_READ, (data: WebSocketEventData[WebSocketEvent.MESSAGE_READ]) => {
      this.messageReadListeners.forEach(listener => listener(data));
    });

    this.socket.on(WebSocketEvent.NEW_CONVERSATION, (conversation: WebSocketEventData[WebSocketEvent.NEW_CONVERSATION]) => {
      this.newConversationListeners.forEach(listener => listener(conversation));
    });

    this.socket.on(WebSocketEvent.GROUP_NAME_UPDATED, (data: WebSocketEventData[WebSocketEvent.GROUP_NAME_UPDATED]) => {
      this.groupNameUpdatedListeners.forEach(listener => listener(data));
    });

    this.socket.on(WebSocketEvent.GROUP_AVATAR_UPDATED, (data: WebSocketEventData[WebSocketEvent.GROUP_AVATAR_UPDATED]) => {
      this.groupAvatarUpdatedListeners.forEach(listener => listener(data));
    });

    this.socket.on(WebSocketEvent.GROUP_DISBANDED, (data: WebSocketEventData[WebSocketEvent.GROUP_DISBANDED]) => {
      this.groupDisbandedListeners.forEach(listener => listener(data));
    });

    this.socket.on(WebSocketEvent.MEMBER_ROLE_UPDATED, (data: WebSocketEventData[WebSocketEvent.MEMBER_ROLE_UPDATED]) => {
      this.memberRoleUpdatedListeners.forEach(listener => listener(data));
    });

    this.socket.on(WebSocketEvent.MEMBER_LEFT_GROUP, (data: WebSocketEventData[WebSocketEvent.MEMBER_LEFT_GROUP]) => {
      this.memberLeftGroupListeners.forEach(listener => listener(data));
    });

    this.socket.on(WebSocketEvent.FRIEND_REQUEST, (request: WebSocketEventData[WebSocketEvent.FRIEND_REQUEST]) => {
      this.friendRequestListeners.forEach(listener => listener(request));
    });

    this.socket.on(WebSocketEvent.FRIEND_REQUEST_ACCEPTED, (data: WebSocketEventData[WebSocketEvent.FRIEND_REQUEST_ACCEPTED]) => {
      this.friendRequestAcceptedListeners.forEach(listener => listener(data));
    });

    this.socket.on(WebSocketEvent.USER_STATUS_CHANGED, (data: WebSocketEventData[WebSocketEvent.USER_STATUS_CHANGED]) => {
      this.userStatusChangedListeners.forEach(listener => listener(data));
    });
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      this.currentConversationId = null;
    }
  }

  /**
   * 加入会话房间
   */
  public joinConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.currentConversationId = conversationId;
    this.socket.emit(WebSocketEvent.JOIN_CONVERSATION, conversationId);
  }

  /**
   * 离开会话房间
   */
  public leaveConversation(conversationId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }

    this.socket.emit(WebSocketEvent.LEAVE_CONVERSATION, conversationId);
  }

  /**
   * 监听新消息
   */
  public onMessage(callback: (message: WebSocketEventData[WebSocketEvent.NEW_MESSAGE]) => void): () => void {
    this.messageListeners.add(callback);

    // 返回取消监听的函数
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * 监听消息删除
   */
  public onMessageDeleted(callback: (messageId: string) => void): () => void {
    this.messageDeletedListeners.add(callback);

    return () => {
      this.messageDeletedListeners.delete(callback);
    };
  }

  /**
   * 监听消息已读
   */
  public onMessageRead(callback: (data: WebSocketEventData[WebSocketEvent.MESSAGE_READ]) => void): () => void {
    this.messageReadListeners.add(callback);

    return () => {
      this.messageReadListeners.delete(callback);
    };
  }

  /**
   * 监听新会话创建
   */
  public onNewConversation(callback: (conversation: WebSocketEventData[WebSocketEvent.NEW_CONVERSATION]) => void): () => void {
    this.newConversationListeners.add(callback);

    return () => {
      this.newConversationListeners.delete(callback);
    };
  }

  /**
   * 监听好友请求
   */
  public onFriendRequest(callback: (request: WebSocketEventData[WebSocketEvent.FRIEND_REQUEST]) => void): () => void {
    this.friendRequestListeners.add(callback);

    return () => {
      this.friendRequestListeners.delete(callback);
    };
  }

  /**
   * 监听群名称更新
   */
  public onGroupNameUpdated(callback: (data: WebSocketEventData[WebSocketEvent.GROUP_NAME_UPDATED]) => void): () => void {
    this.groupNameUpdatedListeners.add(callback);

    return () => {
      this.groupNameUpdatedListeners.delete(callback);
    };
  }

  /**
   * 监听群头像更新
   */
  public onGroupAvatarUpdated(callback: (data: WebSocketEventData[WebSocketEvent.GROUP_AVATAR_UPDATED]) => void): () => void {
    this.groupAvatarUpdatedListeners.add(callback);

    return () => {
      this.groupAvatarUpdatedListeners.delete(callback);
    };
  }

  /**
   * 监听群组解散
   */
  public onGroupDisbanded(callback: (data: WebSocketEventData[WebSocketEvent.GROUP_DISBANDED]) => void): () => void {
    this.groupDisbandedListeners.add(callback);

    return () => {
      this.groupDisbandedListeners.delete(callback);
    };
  }

  /**
   * 监听成员角色更新
   */
  public onMemberRoleUpdated(callback: (data: WebSocketEventData[WebSocketEvent.MEMBER_ROLE_UPDATED]) => void): () => void {
    this.memberRoleUpdatedListeners.add(callback);

    return () => {
      this.memberRoleUpdatedListeners.delete(callback);
    };
  }

  /**
   * 监听好友请求被接受
   */
  public onFriendRequestAccepted(callback: (data: WebSocketEventData[WebSocketEvent.FRIEND_REQUEST_ACCEPTED]) => void): () => void {
    this.friendRequestAcceptedListeners.add(callback);

    return () => {
      this.friendRequestAcceptedListeners.delete(callback);
    };
  }

  /**
   * 监听成员退出群组
   */
  public onMemberLeftGroup(callback: (data: WebSocketEventData[WebSocketEvent.MEMBER_LEFT_GROUP]) => void): () => void {
    this.memberLeftGroupListeners.add(callback);

    return () => {
      this.memberLeftGroupListeners.delete(callback);
    };
  }

  /**
   * 监听用户状态变化
   */
  public onUserStatusChanged(callback: (data: WebSocketEventData[WebSocketEvent.USER_STATUS_CHANGED]) => void): () => void {
    this.userStatusChangedListeners.add(callback);

    return () => {
      this.userStatusChangedListeners.delete(callback);
    };
  }

  /**
   * 检查连接状态
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export default new WebSocketService();
