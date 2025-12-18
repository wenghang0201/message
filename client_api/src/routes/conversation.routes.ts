import { Router } from "express";
import conversationController from "../controllers/conversation.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validation.middleware";
import {
  createSingleConversationSchema,
  createGroupConversationSchema,
  markAsReadSchema,
  updateGroupNameSchema,
  updateGroupAvatarSchema,
  updateMessageSendPermissionSchema,
  updateMemberAddPermissionSchema,
  updateRequireApprovalSchema,
  transferOwnershipSchema,
} from "../schemas/conversation.schema";

/**
 * 对话路由
 */
class ConversationRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // 所有对话路由都需要认证
    this.router.use(authenticateToken);

    // 获取用户的所有对话列表
    this.router.get(
      "/conversations",
      conversationController.getConversations.bind(conversationController)
    );

    // 创建或获取单聊对话
    this.router.post(
      "/conversations/single",
      validateBody(createSingleConversationSchema),
      conversationController.getOrCreateSingle.bind(conversationController)
    );

    // 创建群聊
    this.router.post(
      "/conversations/group",
      validateBody(createGroupConversationSchema),
      conversationController.createGroup.bind(conversationController)
    );

    // 获取对话详情
    this.router.get(
      "/conversations/:conversationId",
      conversationController.getConversation.bind(conversationController)
    );

    // 删除对话
    this.router.delete(
      "/conversations/:conversationId",
      conversationController.deleteConversation.bind(conversationController)
    );

    // 标记消息为已读
    this.router.post(
      "/conversations/:conversationId/read",
      validateBody(markAsReadSchema),
      conversationController.markAsRead.bind(conversationController)
    );

    // 获取群聊成员列表
    this.router.get(
      "/conversations/:conversationId/members",
      conversationController.getGroupMembers.bind(conversationController)
    );

    // 添加成员到群聊
    this.router.post(
      "/conversations/:conversationId/members",
      conversationController.addGroupMember.bind(conversationController)
    );

    // 更新成员角色
    this.router.put(
      "/conversations/:conversationId/members/:memberId/role",
      conversationController.updateMemberRole.bind(conversationController)
    );

    // 从群聊中移除成员
    this.router.delete(
      "/conversations/:conversationId/members/:memberId",
      conversationController.removeGroupMember.bind(conversationController)
    );

    // 置顶/取消置顶对话
    this.router.post(
      "/conversations/:conversationId/pin",
      conversationController.togglePin.bind(conversationController)
    );

    // 设置对话静音
    this.router.post(
      "/conversations/:conversationId/mute",
      conversationController.setMute.bind(conversationController)
    );

    // 取消对话静音
    this.router.post(
      "/conversations/:conversationId/unmute",
      conversationController.unmute.bind(conversationController)
    );

    // 更新群聊名称
    this.router.put(
      "/conversations/:conversationId/name",
      validateBody(updateGroupNameSchema),
      conversationController.updateGroupName.bind(conversationController)
    );

    // 更新群聊头像
    this.router.put(
      "/conversations/:conversationId/avatar",
      validateBody(updateGroupAvatarSchema),
      conversationController.updateGroupAvatar.bind(conversationController)
    );

    // 更新消息发送权限
    this.router.put(
      "/conversations/:conversationId/permissions/message-send",
      validateBody(updateMessageSendPermissionSchema),
      conversationController.updateMessageSendPermission.bind(conversationController)
    );

    // 更新成员添加权限
    this.router.put(
      "/conversations/:conversationId/permissions/member-add",
      validateBody(updateMemberAddPermissionSchema),
      conversationController.updateMemberAddPermission.bind(conversationController)
    );

    // 更新入群验证设置
    this.router.put(
      "/conversations/:conversationId/permissions/require-approval",
      validateBody(updateRequireApprovalSchema),
      conversationController.updateRequireApproval.bind(conversationController)
    );

    // 退出群组
    this.router.post(
      "/conversations/:conversationId/leave",
      conversationController.leaveGroup.bind(conversationController)
    );

    // 转让群主
    this.router.post(
      "/conversations/:conversationId/transfer-ownership",
      validateBody(transferOwnershipSchema),
      conversationController.transferOwnership.bind(conversationController)
    );

    // 解散群组
    this.router.post(
      "/conversations/:conversationId/disband",
      conversationController.disbandGroup.bind(conversationController)
    );
  }
}

export default new ConversationRoutes().router;
