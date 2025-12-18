import { Request, Response, NextFunction } from "express";
import friendService from "../services/friend.service";
import websocketService from "../services/websocket.service";
import { ResponseUtil } from "../utils/response.util";
import { WebSocketEvent } from "../constants/websocket-events";

/**
 * 好友控制器
 */
class FriendController {
  /**
   * 发送好友请求
   */
  public async sendFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { recipientId } = req.body;

      const result = await friendService.sendFriendRequest(
        userId,
        recipientId
      );

      // 发送 WebSocket 通知给接收者
      websocketService.sendMessageToUser(recipientId, WebSocketEvent.FRIEND_REQUEST, {
        id: result.friendRequest.id,
        requesterId: result.friendRequest.requesterId,
        requesterName: result.requesterName,
        requesterAvatar: result.requesterAvatar,
        createdAt: result.friendRequest.createdAt,
      });

      ResponseUtil.success(
        res,
        {
          id: result.friendRequest.id,
          requesterId: result.friendRequest.requesterId,
          recipientId: result.friendRequest.recipientId,
          status: result.friendRequest.status,
          createdAt: result.friendRequest.createdAt,
        },
        "Friend request sent successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * 接受好友请求
   */
  public async acceptFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { friendshipId } = req.params;

      const result = await friendService.acceptFriendRequest(
        userId,
        friendshipId
      );

      // 发送 WebSocket 通知给请求者
      websocketService.sendMessageToUser(result.friendship.requesterId, WebSocketEvent.FRIEND_REQUEST_ACCEPTED, {
        friendshipId: result.friendship.id,
        userId: userId,
        userName: result.accepterName,
        userAvatar: result.accepterAvatar,
      });

      ResponseUtil.success(
        res,
        {
          id: result.friendship.id,
          requesterId: result.friendship.requesterId,
          recipientId: result.friendship.recipientId,
          status: result.friendship.status,
          updatedAt: result.friendship.updatedAt,
        },
        "Friend request accepted"
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * 拒绝好友请求
   */
  public async rejectFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { friendshipId } = req.params;

      await friendService.rejectFriendRequest(userId, friendshipId);

      ResponseUtil.success(res, null, "好友请求已拒绝");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取好友列表
   */
  public async getFriends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;

      const friends = await friendService.getFriends(userId);

      ResponseUtil.success(res, friends);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取待处理的好友请求
   */
  public async getPendingRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;

      const requests = await friendService.getPendingRequests(userId);

      ResponseUtil.success(res, requests);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取发送的好友请求
   */
  public async getSentRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;

      const requests = await friendService.getSentRequests(userId);

      ResponseUtil.success(res, requests);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除好友
   */
  public async removeFriend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { friendshipId } = req.params;

      await friendService.removeFriend(userId, friendshipId);

      ResponseUtil.success(res, null, "好友已删除");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 搜索用户
   */
  public async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { query } = req.query;

      if (!query || typeof query !== "string") {
        ResponseUtil.error(res, "搜索查询必填", 400);
        return;
      }

      const users = await friendService.searchUsers(userId, query);

      ResponseUtil.success(res, users);
    } catch (error) {
      next(error);
    }
  }
}

export default new FriendController();
