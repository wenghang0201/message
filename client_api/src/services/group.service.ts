/**
 * 群组服务
 * 处理群组特定操作（成员、角色、解散）
 *
 * 从 ConversationService 提取的群组管理功能
 * 专注于群组成员管理和权限控制
 */

import { Repository, IsNull, In } from "typeorm";
import { AppDataSource } from "../config/database";
import { Conversation, ConversationType } from "../models/Conversation.entity";
import { ConversationUser, MemberRole } from "../models/ConversationUser.entity";
import { User } from "../models/User.entity";
import { Message } from "../models/Message.entity";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../utils/app-error.util";
import { SystemMessageCreator } from "../utils/system-message-creator.util";
import { SPECIAL_DATES } from "../constants/business.config";
import websocketService from "./websocket.service";
import { WebSocketEvent } from "../constants/websocket-events";

/**
 * 群组服务类
 */
export class GroupService {
  private conversationRepository: Repository<Conversation>;
  private conversationUserRepository: Repository<ConversationUser>;
  private userRepository: Repository<User>;
  private messageRepository: Repository<Message>;
  private systemMessageCreator: SystemMessageCreator;

  constructor() {
    this.conversationRepository = AppDataSource.getRepository(Conversation);
    this.conversationUserRepository = AppDataSource.getRepository(ConversationUser);
    this.userRepository = AppDataSource.getRepository(User);
    this.messageRepository = AppDataSource.getRepository(Message);
    this.systemMessageCreator = new SystemMessageCreator(
      this.messageRepository,
      this.conversationUserRepository
    );
  }

  /**
   * 获取群组成员列表
   */
  public async getGroupMembers(
    conversationId: string,
    userId: string
  ): Promise<ConversationUser[]> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 验证请求者是否为成员
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    // 获取所有活跃成员（使用预加载防止 N+1 查询）
    const members = await this.conversationUserRepository
      .createQueryBuilder("cu")
      .leftJoinAndSelect("cu.user", "user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("cu.conversationId = :conversationId", { conversationId })
      .andWhere("cu.deletedAt IS NULL")
      .getMany();

    return members;
  }

  /**
   * 添加成员到群组
   */
  public async addGroupMembers(
    conversationId: string,
    requesterId: string,
    memberIds: string[]
  ): Promise<void> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能向群组添加成员");
    }

    if (conversation.disbandedAt) {
      throw new ValidationError("无法向已解散的群组添加成员");
    }

    // 验证请求者权限
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: requesterId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    // 检查添加成员权限
    const canAdd = this.checkMemberAddPermission(
      conversation.memberAddPermission,
      requesterMembership.role
    );

    if (!canAdd) {
      throw new ForbiddenError("您没有权限添加成员");
    }

    // 验证所有新成员是否存在
    const users = await this.userRepository.find({
      where: { id: In(memberIds) },
    });

    if (users.length !== memberIds.length) {
      throw new NotFoundError("一个或多个用户未找到");
    }

    // 检查是否已经是成员
    const existingMembers = await this.conversationUserRepository.find({
      where: {
        conversationId,
        userId: In(memberIds),
      },
    });

    const existingMemberIds = new Set(
      existingMembers
        .filter(m => m.deletedAt === null)
        .map(m => m.userId)
    );

    const newMemberIds = memberIds.filter(id => !existingMemberIds.has(id));

    if (newMemberIds.length === 0) {
      throw new ValidationError("所有用户已经是群组成员");
    }

    // 添加新成员
    const newMembers = newMemberIds.map(memberId =>
      this.conversationUserRepository.create({
        conversationId,
        userId: memberId,
        role: MemberRole.MEMBER,
      })
    );

    await this.conversationUserRepository.save(newMembers);

    // 创建系统消息
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterId },
    });
    const addedUsers = users.filter(u => newMemberIds.includes(u.id));
    const memberNames = addedUsers.map(u => u.username).join("、");

    const systemMessageContent = `${requesterUser?.username || "用户"} 邀请 ${memberNames} 加入群聊`;

    await this.systemMessageCreator.createSystemMessage(
      conversationId,
      systemMessageContent,
      requesterId
    );

    // 通知所有成员（包括新成员）
    const allMembers = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    allMembers.forEach(member => {
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.CONVERSATION_UPDATED, {
        id: conversationId,
      });
    });
  }

  /**
   * 离开群组
   */
  public async leaveGroup(
    conversationId: string,
    userId: string
  ): Promise<void> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能离开群组会话");
    }

    // 验证用户是否为成员
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    // 群主不能直接离开，必须先转让群主
    if (membership.role === MemberRole.OWNER) {
      throw new ValidationError("群主必须先转让群主身份才能离开群组");
    }

    // 软删除成员记录
    membership.deletedAt = new Date();
    await this.conversationUserRepository.save(membership);

    // 创建系统消息
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const systemMessageContent = `${user?.username || "用户"} 离开了群聊`;

    await this.systemMessageCreator.createSystemMessage(
      conversationId,
      systemMessageContent,
      userId,
      userId // 排除离开的用户
    );

    // 通知其他成员
    const remainingMembers = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    remainingMembers.forEach(member => {
      if (member.userId !== userId) {
        websocketService.sendMessageToUser(member.userId, WebSocketEvent.MEMBER_LEFT_GROUP, {
          conversationId,
          userId,
        });
      }
    });
  }

  /**
   * 更新成员角色
   */
  public async updateMemberRole(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
    newRole: MemberRole
  ): Promise<void> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能在群组中更改成员角色");
    }

    // 不能设置为群主角色（使用转让群主功能）
    if (newRole === MemberRole.OWNER) {
      throw new ValidationError("请使用转让群主功能");
    }

    // 验证请求者权限
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: requesterId, deletedAt: IsNull() },
    });

    if (!requesterMembership || requesterMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以更改成员角色");
    }

    // 验证目标用户是否为成员
    const targetMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: targetUserId, deletedAt: IsNull() },
    });

    if (!targetMembership) {
      throw new NotFoundError("目标用户不是群组成员");
    }

    // 不能更改群主角色
    if (targetMembership.role === MemberRole.OWNER) {
      throw new ValidationError("不能更改群主的角色");
    }

    // 更新角色
    targetMembership.role = newRole;
    await this.conversationUserRepository.save(targetMembership);

    // 通知所有成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    members.forEach(member => {
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.MEMBER_ROLE_UPDATED, {
        conversationId,
        userId: targetUserId,
        newRole,
      });
    });
  }

  /**
   * 移除群组成员
   */
  public async removeGroupMember(
    conversationId: string,
    requesterId: string,
    targetUserId: string
  ): Promise<void> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能从群组中移除成员");
    }

    // 验证请求者权限
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: requesterId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    // 只有管理员和群主可以移除成员
    if (
      requesterMembership.role !== MemberRole.ADMIN &&
      requesterMembership.role !== MemberRole.OWNER
    ) {
      throw new ForbiddenError("只有管理员和群主可以移除成员");
    }

    // 验证目标用户是否为成员
    const targetMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: targetUserId, deletedAt: IsNull() },
    });

    if (!targetMembership) {
      throw new NotFoundError("目标用户不是群组成员");
    }

    // 不能移除群主
    if (targetMembership.role === MemberRole.OWNER) {
      throw new ValidationError("不能移除群主");
    }

    // 管理员不能移除其他管理员
    if (
      requesterMembership.role === MemberRole.ADMIN &&
      targetMembership.role === MemberRole.ADMIN
    ) {
      throw new ForbiddenError("管理员不能移除其他管理员");
    }

    // 软删除成员记录
    targetMembership.deletedAt = new Date();
    await this.conversationUserRepository.save(targetMembership);

    // 创建系统消息
    const requesterUser = await this.userRepository.findOne({
      where: { id: requesterId },
    });
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    const systemMessageContent = `${requesterUser?.username || "用户"} 将 ${targetUser?.username || "用户"} 移出群聊`;

    await this.systemMessageCreator.createSystemMessage(
      conversationId,
      systemMessageContent,
      requesterId,
      targetUserId // 排除被移除的用户
    );

    // 通知所有成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    // 通知被移除的用户
    websocketService.sendMessageToUser(targetUserId, WebSocketEvent.CONVERSATION_DELETED, {
      conversationId,
    });

    // 通知其他成员
    members.forEach(member => {
      if (member.userId !== targetUserId) {
        websocketService.sendMessageToUser(member.userId, WebSocketEvent.MEMBER_LEFT_GROUP, {
          conversationId,
          userId: targetUserId,
        });
      }
    });
  }

  /**
   * 转让群主
   */
  public async transferOwnership(
    conversationId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<void> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能在群组中转让群主");
    }

    // 验证当前用户是否为群主
    const currentOwnerMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: currentOwnerId, deletedAt: IsNull() },
    });

    if (!currentOwnerMembership || currentOwnerMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以转让群主身份");
    }

    // 验证新群主是否为成员
    const newOwnerMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: newOwnerId, deletedAt: IsNull() },
    });

    if (!newOwnerMembership) {
      throw new NotFoundError("目标用户不是群组成员");
    }

    // 更新角色
    currentOwnerMembership.role = MemberRole.MEMBER;
    newOwnerMembership.role = MemberRole.OWNER;

    await this.conversationUserRepository.save([
      currentOwnerMembership,
      newOwnerMembership,
    ]);

    // 创建系统消息
    const currentOwnerUser = await this.userRepository.findOne({
      where: { id: currentOwnerId },
    });
    const newOwnerUser = await this.userRepository.findOne({
      where: { id: newOwnerId },
    });

    const systemMessageContent = `${currentOwnerUser?.username || "用户"} 将群主转让给 ${newOwnerUser?.username || "用户"}`;

    await this.systemMessageCreator.createSystemMessage(
      conversationId,
      systemMessageContent,
      currentOwnerId
    );

    // 通知所有成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ["userId"],
    });

    members.forEach(member => {
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.MEMBER_ROLE_UPDATED, {
        conversationId,
        userId: newOwnerId,
        role: 'owner' as any,
        updatedBy: currentOwnerId,
      });
    });
  }

  /**
   * 解散群组
   */
  public async disbandGroup(
    conversationId: string,
    userId: string
  ): Promise<void> {
    // 验证会话是否存在且为群组
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("只能解散群组会话");
    }

    if (conversation.disbandedAt) {
      throw new ValidationError("群组已经解散");
    }

    // 验证用户是否为群主
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership || membership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以解散群组");
    }

    // 标记群组为已解散
    conversation.disbandedAt = new Date();
    await this.conversationRepository.save(conversation);

    // 软删除所有成员记录（设置为未来日期以保留历史）
    const allMembers = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
    });

    const farFutureDate = new Date(SPECIAL_DATES.FAR_FUTURE_DATE);
    allMembers.forEach(member => {
      member.deletedAt = farFutureDate;
    });

    await this.conversationUserRepository.save(allMembers);

    // 创建系统消息
    const ownerUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    const systemMessageContent = `${ownerUser?.username || "群主"} 解散了群聊`;

    await this.systemMessageCreator.createSystemMessage(
      conversationId,
      systemMessageContent,
      userId
    );

    // 通知所有成员
    const memberIds = allMembers.map(m => m.userId);
    memberIds.forEach(memberId => {
      websocketService.sendMessageToUser(memberId, WebSocketEvent.GROUP_DISBANDED, {
        conversationId,
      });
    });
  }

  /**
   * 检查成员添加权限（私有辅助方法）
   */
  private checkMemberAddPermission(
    permission: string,
    role: MemberRole
  ): boolean {
    switch (permission) {
      case "ALL_MEMBERS":
        return true;
      case "ADMIN_ONLY":
        return role === MemberRole.ADMIN || role === MemberRole.OWNER;
      case "OWNER_ONLY":
        return role === MemberRole.OWNER;
      default:
        return role === MemberRole.ADMIN || role === MemberRole.OWNER;
    }
  }
}

export default new GroupService();
