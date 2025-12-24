/**
 * 会话权限服务
 * 处理权限检查和权限更新操作
 *
 * 从 ConversationService 提取的权限管理功能
 * 使用 PermissionChecker 工具类消除重复代码
 */

import { injectable, inject } from "tsyringe";
import { Repository, IsNull } from "typeorm";
import { AppDataSource } from "../config/database";
import {
  Conversation,
  ConversationType,
  MessageSendPermission,
  MemberAddPermission,
} from "../models/Conversation.entity";
import { ConversationUser, MemberRole } from "../models/ConversationUser.entity";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../utils/app-error.util";
import { PermissionChecker } from "../utils/permission-checker.util";
import websocketService from "../services/websocket.service";
import { WebSocketEvent } from "../constants/websocket-events";

/**
 * 会话权限服务类
 */
@injectable()
export class ConversationPermissionService {
  constructor(
    @inject('ConversationRepository') private conversationRepository: Repository<Conversation>,
    @inject('ConversationUserRepository') private conversationUserRepository: Repository<ConversationUser>,
    @inject(PermissionChecker) private permissionChecker: PermissionChecker
  ) {}

  /**
   * 检查用户是否可以在会话中发送消息
   */
  public async canSendMessage(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return this.permissionChecker.canSendMessage(conversationId, userId);
  }

  /**
   * 检查用户是否可以添加成员到会话
   */
  public async canAddMember(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return this.permissionChecker.canAddMember(conversationId, userId);
  }

  /**
   * 更新消息发送权限
   */
  public async updateMessageSendPermission(
    conversationId: string,
    userId: string,
    permission: MessageSendPermission
  ): Promise<Conversation> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能在群组中设置消息发送权限");
    }

    // 验证用户是否为群主
    const isOwner = await this.permissionChecker.isOwner(conversationId, userId);

    if (!isOwner) {
      throw new ForbiddenError("只有群主可以更改消息发送权限");
    }

    // 更新权限
    conversation.messageSendPermission = permission;
    await this.conversationRepository.save(conversation);

    // 通知所有成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    members.forEach(member => {
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.CONVERSATION_UPDATED, {
        id: conversationId,
      });
    });

    return conversation;
  }

  /**
   * 更新成员添加权限
   */
  public async updateMemberAddPermission(
    conversationId: string,
    userId: string,
    permission: MemberAddPermission
  ): Promise<Conversation> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能在群组中设置成员添加权限");
    }

    // 验证用户是否为群主
    const isOwner = await this.permissionChecker.isOwner(conversationId, userId);

    if (!isOwner) {
      throw new ForbiddenError("只有群主可以更改成员添加权限");
    }

    // 更新权限
    conversation.memberAddPermission = permission;
    await this.conversationRepository.save(conversation);

    // 通知所有成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    members.forEach(member => {
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.CONVERSATION_UPDATED, {
        id: conversationId,
      });
    });

    return conversation;
  }

  /**
   * 更新入群审批设置
   */
  public async updateRequireApproval(
    conversationId: string,
    userId: string,
    requireApproval: boolean
  ): Promise<Conversation> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能在群组中设置入群审批");
    }

    // 验证用户是否为管理员或群主
    const isAdminOrOwner = await this.permissionChecker.isAdminOrOwner(
      conversationId,
      userId
    );

    if (!isAdminOrOwner) {
      throw new ForbiddenError("只有管理员和群主可以更改入群审批设置");
    }

    // 更新设置
    conversation.requireApproval = requireApproval;
    await this.conversationRepository.save(conversation);

    // 通知所有成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    members.forEach(member => {
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.CONVERSATION_UPDATED, {
        id: conversationId,
      });
    });

    return conversation;
  }
}

// Dual export for backward compatibility
export default new ConversationPermissionService(
  AppDataSource.getRepository(Conversation),
  AppDataSource.getRepository(ConversationUser),
  new PermissionChecker(
    AppDataSource.getRepository(Conversation),
    AppDataSource.getRepository(ConversationUser)
  )
);
