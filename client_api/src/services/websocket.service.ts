import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Log from '../utils/log.util';
import { jwtConfig } from '../config/jwt.config';
import { WebSocketEvent, WebSocketEventData } from '../constants/websocket-events';
import { AppDataSource } from '../config/database';
import { UserProfile } from '../models/UserProfile.entity';
import { PrivacyUtil } from '../utils/privacy.util';

/**
 * WebSocket服务
 * 处理实时消息推送
 */
class WebSocketService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); 

  /**
   * 初始化WebSocket服务器
   */
  public initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // 允许所有来源，上线后需要修改
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    Log.info('✅ WebSocket服务器初始化成功');
  }

  /**
   * Socket认证中间件
   */
  private authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('缺少认证令牌'));
      }

      const decoded = jwt.verify(token, jwtConfig.secret) as { userId: string };
      socket.data.userId = decoded.userId;

      next();
    } catch (error) {
      Log.error(`Socket认证失败: ${error}`);
      next(new Error('认证失败'));
    }
  }

  /**
   * 处理新连接
   */
  private async handleConnection(socket: Socket): Promise<void> {
    const userId = socket.data.userId;

    // 存储用户socket连接
    const wasOffline = !this.userSockets.has(userId);
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // 加入用户房间
    socket.join(`user:${userId}`);

    // 如果用户从离线变为在线，广播状态变化
    if (wasOffline) {
      await this.updateUserOnlineStatus(userId, true);
    }

    // 处理断开连接
    socket.on('disconnect', async () => {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          // 用户所有连接都断开，标记为离线
          await this.updateUserOnlineStatus(userId, false);
        }
      }
    });

    // 处理加入会话房间
    socket.on(WebSocketEvent.JOIN_CONVERSATION, async (conversationId: string) => {
      // 验证用户是否是会话的活跃成员
      const isMember = await this.isActiveMember(userId, conversationId);
      if (isMember) {
        socket.join(`conversation:${conversationId}`);
      } else {
        Log.warn(`用户 ${userId} 尝试加入非成员会话 ${conversationId}`);
      }
    });

    // 处理离开会话房间
    socket.on(WebSocketEvent.LEAVE_CONVERSATION, (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });
  }

  /**
   * 发送新消息给会话参与者（优化版本，避免重复）
   */
  public sendMessageToConversation(
    conversationId: string,
    message: WebSocketEventData[WebSocketEvent.NEW_MESSAGE],
    memberIds?: string[]
  ): void {
    if (!this.io) {
      Log.warn('WebSocket服务器未初始化');
      return;
    }

    // 使用 Socket.IO 的多房间广播，自动去重
    // 同时发送到会话房间和所有成员的用户房间
    const rooms = [`conversation:${conversationId}`];

    if (memberIds && memberIds.length > 0) {
      memberIds.forEach(userId => {
        rooms.push(`user:${userId}`);
      });
    }

    // Socket.IO 会自动处理去重 - 如果一个 socket 在多个房间，只接收一次
    this.io.to(rooms).emit(WebSocketEvent.NEW_MESSAGE, message);
  }

  /**
   * 发送消息给特定用户的所有连接
   */
  public sendMessageToUser(userId: string, event: string, data: any): void {
    if (!this.io) {
      Log.warn('WebSocket服务器未初始化');
      return;
    }

    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * 通知消息已读
   */
  public notifyMessageRead(
    conversationId: string,
    data: WebSocketEventData[WebSocketEvent.MESSAGE_READ]
  ): void {
    if (!this.io) {
      Log.warn('WebSocket服务器未初始化');
      return;
    }

    this.io.to(`conversation:${conversationId}`).emit(WebSocketEvent.MESSAGE_READ, data);
  }

  /**
   * 通知消息删除
   */
  public notifyMessageDeleted(conversationId: string, messageId: string): void {
    if (!this.io) {
      Log.warn('WebSocket服务器未初始化');
      return;
    }

    const data: WebSocketEventData[WebSocketEvent.MESSAGE_DELETED] = { messageId };
    this.io.to(`conversation:${conversationId}`).emit(WebSocketEvent.MESSAGE_DELETED, data);
  }

  /**
   * 通知消息已撤回
   */
  public notifyMessageRecalled(conversationId: string, messageId: string): void {
    if (!this.io) {
      Log.warn('WebSocket服务器未初始化');
      return;
    }

    const data: WebSocketEventData[WebSocketEvent.MESSAGE_DELETED] = { messageId };
    this.io.to(`conversation:${conversationId}`).emit(WebSocketEvent.MESSAGE_DELETED, data);
  }

  /**
   * 检查用户是否是会话的活跃成员
   */
  private async isActiveMember(userId: string, conversationId: string): Promise<boolean> {
    try {
      const { ConversationUser } = await import('../models/ConversationUser.entity');
      const { IsNull } = await import('typeorm');
      const conversationUserRepository = AppDataSource.getRepository(ConversationUser);

      const member = await conversationUserRepository.findOne({
        where: { conversationId, userId, deletedAt: IsNull() },
      });

      return member !== null;
    } catch (error) {
      Log.error(`检查会话成员失败: ${error}`);
      return false;
    }
  }

  /**
   * 强制用户离开会话房间（用于被移除/踢出群组）
   */
  public forceLeaveConversation(userId: string, conversationId: string): void {
    if (!this.io) {
      Log.warn('WebSocket服务器未初始化');
      return;
    }

    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      userSocketIds.forEach(socketId => {
        const socket = this.io!.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(`conversation:${conversationId}`);
        }
      });
    }
  }

  /**
   * 获取在线用户数
   */
  public getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * 检查用户是否在线
   */
  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * 更新用户在线状态并广播
   */
  private async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      const userProfileRepository = AppDataSource.getRepository(UserProfile);

      // 更新数据库中的在线状态
      const profile = await userProfileRepository.findOne({ where: { userId } });
      if (profile) {
        profile.isOnline = isOnline;
        if (!isOnline) {
          profile.lastSeenAt = new Date();
        } else {
          // 当用户上线时，清除 lastSeenAt
          profile.lastSeenAt = null;
        }
        await userProfileRepository.save(profile);

        // 根据隐私设置获取授权查看者
        const authorizedViewers = await PrivacyUtil.getAuthorizedViewers(userId);

        const statusData: WebSocketEventData[WebSocketEvent.USER_STATUS_CHANGED] = {
          userId,
          isOnline,
          lastSeenAt: profile.lastSeenAt,
        };

        if (this.io) {
          if (authorizedViewers.length === 0) {
            // 空数组表示所有人可见（隐私设置为 "everyone"）
            this.io.emit(WebSocketEvent.USER_STATUS_CHANGED, statusData);
          } else {
            // 只广播给授权的用户
            authorizedViewers.forEach(viewerId => {
              this.io!.to(`user:${viewerId}`).emit(WebSocketEvent.USER_STATUS_CHANGED, statusData);
            });
          }
        }
      }
    } catch (error) {
      Log.error(`更新用户在线状态失败: ${error}`);
    }
  }
}

export default new WebSocketService();
