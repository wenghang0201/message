import { Request, Response, NextFunction } from "express";
import conversationService from "../services/conversation.service";
import websocketService from "../services/websocket.service";
import { ResponseUtil } from "../utils/response.util";
import { WebSocketEvent } from "../constants/websocket-events";

/**
 * 对话控制器
 */
export class ConversationController {
  /**
   * 获取用户的所有对话列表
   * GET /conversations
   */
  public async getConversations(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;

      const conversations = await conversationService.getUserConversations(
        userId
      );

      ResponseUtil.success(res, conversations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建或获取单聊对话
   * POST /conversations/single
   */
  public async getOrCreateSingle(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { otherUserId } = req.body;

      const result = await conversationService.getOrCreateSingleConversation(
        userId,
        otherUserId
      );

      ResponseUtil.success(res, result.conversation, "会话已创建");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建群聊
   * POST /conversations/group
   */
  public async createGroup(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { name, memberIds, avatarUrl } = req.body;

      const conversation = await conversationService.createGroupConversation(
        userId,
        name,
        memberIds,
        avatarUrl
      );

      // 通知所有群成员
      const allMemberIds = [userId, ...memberIds];
      allMemberIds.forEach(memberId => {
        websocketService.sendMessageToUser(memberId, WebSocketEvent.NEW_CONVERSATION, conversation);
      });

      ResponseUtil.created(res, conversation, "群组已创建");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取对话详情
   * GET /conversations/:conversationId
   */
  public async getConversation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;

      const conversation = await conversationService.getConversation(
        conversationId,
        userId
      );

      ResponseUtil.success(res, conversation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除对话
   * DELETE /conversations/:conversationId
   */
  public async deleteConversation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;

      await conversationService.deleteConversation(conversationId, userId);

      ResponseUtil.success(res, undefined, "会话已删除");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 标记消息为已读
   * POST /conversations/:conversationId/read
   */
  public async markAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { messageId } = req.body;

      await conversationService.markAsRead(conversationId, userId, messageId);

      // 通知会话中的其他用户消息已读
      websocketService.notifyMessageRead(conversationId, {
        userId,
        conversationId,
        messageId,
      });

      ResponseUtil.success(res, undefined, "已标记为已读");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取群聊成员列表
   * GET /conversations/:conversationId/members
   */
  public async getGroupMembers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;

      const members = await conversationService.getGroupMembers(
        conversationId,
        userId
      );

      ResponseUtil.success(res, members);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 添加成员到群聊
   * POST /conversations/:conversationId/members
   */
  public async addGroupMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { memberIds } = req.body;

      await conversationService.addGroupMembers(
        conversationId,
        userId,
        memberIds
      );

      ResponseUtil.success(res, undefined, "成员已添加");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新成员角色
   * PUT /conversations/:conversationId/members/:memberId/role
   */
  public async updateMemberRole(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId, memberId } = req.params;
      const { role } = req.body;

      await conversationService.updateMemberRole(
        conversationId,
        userId,
        memberId,
        role
      );

      // 推送消息给所有成员
      const members = await conversationService.getGroupMembers(
        conversationId,
        userId
      );
      const memberIds = members.map(m => m.userId);

      memberIds.forEach(id => {
        websocketService.sendMessageToUser(id, WebSocketEvent.MEMBER_ROLE_UPDATED, {
          conversationId,
          userId: memberId,
          role,
          updatedBy: userId,
        });
      });

      ResponseUtil.success(res, undefined, "成员角色已更新");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 从群聊中移除成员
   * DELETE /conversations/:conversationId/members/:memberId
   */
  public async removeGroupMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId, memberId } = req.params;

      await conversationService.removeGroupMember(
        conversationId,
        userId,
        memberId
      );

      ResponseUtil.success(res, undefined, "成员已移除");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 置顶/取消置顶对话
   * POST /conversations/:conversationId/pin
   */
  public async togglePin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;

      await conversationService.togglePin(conversationId, userId);

      ResponseUtil.success(res, undefined, "置顶状态已切换");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 设置对话静音
   * POST /conversations/:conversationId/mute
   */
  public async setMute(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { duration } = req.body;

      await conversationService.setMute(conversationId, userId, duration);

      ResponseUtil.success(res, undefined, "会话已静音");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 取消对话静音
   * POST /conversations/:conversationId/unmute
   */
  public async unmute(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;

      await conversationService.unmute(conversationId, userId);

      ResponseUtil.success(res, undefined, "会话已取消静音");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新群聊名称
   * PUT /conversations/:conversationId/name
   */
  public async updateGroupName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { name } = req.body;

      const conversation = await conversationService.updateGroupName(
        conversationId,
        userId,
        name
      );

      // 通知所有成员名称已更改
      const members = await conversationService.getGroupMembers(
        conversationId,
        userId
      );
      const memberIds = members.map(m => m.userId);

      memberIds.forEach(memberId => {
        websocketService.sendMessageToUser(memberId, WebSocketEvent.GROUP_NAME_UPDATED, {
          conversationId,
          name,
          updatedBy: userId,
        });
      });

      ResponseUtil.success(res, conversation, "群组名称已更新");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新群聊头像
   * PUT /conversations/:conversationId/avatar
   */
  public async updateGroupAvatar(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { avatarUrl } = req.body;

      const conversation = await conversationService.updateGroupAvatar(
        conversationId,
        userId,
        avatarUrl
      );

      // 通知所有成员头像已更改
      const members = await conversationService.getGroupMembers(
        conversationId,
        userId
      );
      const memberIds = members.map(m => m.userId);

      memberIds.forEach(memberId => {
        websocketService.sendMessageToUser(memberId, WebSocketEvent.GROUP_AVATAR_UPDATED, {
          conversationId,
          avatarUrl,
          updatedBy: userId,
        });
      });

      ResponseUtil.success(res, conversation, "群组头像已更新");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新消息发送权限
   * PUT /conversations/:conversationId/permissions/message-send
   */
  public async updateMessageSendPermission(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { permission } = req.body;

      await conversationService.updateMessageSendPermission(
        conversationId,
        userId,
        permission
      );

      ResponseUtil.success(res, undefined, "消息发送权限已更新");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新成员添加权限
   * PUT /conversations/:conversationId/permissions/member-add
   */
  public async updateMemberAddPermission(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { permission } = req.body;

      await conversationService.updateMemberAddPermission(
        conversationId,
        userId,
        permission
      );

      ResponseUtil.success(res, undefined, "成员添加权限已更新");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新入群验证设置
   * PUT /conversations/:conversationId/permissions/require-approval
   */
  public async updateRequireApproval(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { requireApproval } = req.body;

      await conversationService.updateRequireApproval(
        conversationId,
        userId,
        requireApproval
      );

      ResponseUtil.success(res, undefined, "入群验证设置已更新");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 退出群组
   * POST /conversations/:conversationId/leave
   */
  public async leaveGroup(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;

      await conversationService.leaveGroup(conversationId, userId);

      ResponseUtil.success(res, undefined, "已退出群组");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 转让群主
   * POST /conversations/:conversationId/transfer-ownership
   */
  public async transferOwnership(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const { newOwnerId } = req.body;

      await conversationService.transferOwnership(
        conversationId,
        userId,
        newOwnerId
      );

      ResponseUtil.success(res, undefined, "群主已转让");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 解散群组
   * POST /conversations/:conversationId/disband
   */
  public async disbandGroup(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;

      await conversationService.disbandGroup(conversationId, userId);

      ResponseUtil.success(res, undefined, "群组已解散");
    } catch (error) {
      next(error);
    }
  }
}

export default new ConversationController();
