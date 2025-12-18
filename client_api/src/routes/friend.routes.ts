import { Router } from "express";
import friendController from "../controllers/friend.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validation.middleware";
import { sendFriendRequestSchema } from "../schemas/friend.schema";

/**
 * 好友路由
 */
class FriendRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // 所有好友路由都需要认证
    this.router.use(authenticateToken);

    // 搜索用户
    this.router.get(
      "/users/search",
      friendController.searchUsers.bind(friendController)
    );

    // 发送好友请求
    this.router.post(
      "/friends/request",
      validateBody(sendFriendRequestSchema),
      friendController.sendFriendRequest.bind(friendController)
    );

    // 获取好友列表
    this.router.get(
      "/friends",
      friendController.getFriends.bind(friendController)
    );

    // 获取待处理的好友请求
    this.router.get(
      "/friends/requests/pending",
      friendController.getPendingRequests.bind(friendController)
    );

    // 获取发送的好友请求
    this.router.get(
      "/friends/requests/sent",
      friendController.getSentRequests.bind(friendController)
    );

    // 接受好友请求
    this.router.post(
      "/friends/requests/:friendshipId/accept",
      friendController.acceptFriendRequest.bind(friendController)
    );

    // 拒绝好友请求
    this.router.post(
      "/friends/requests/:friendshipId/reject",
      friendController.rejectFriendRequest.bind(friendController)
    );

    // 删除好友
    this.router.delete(
      "/friends/:friendshipId",
      friendController.removeFriend.bind(friendController)
    );
  }
}

export default new FriendRoutes().router;
