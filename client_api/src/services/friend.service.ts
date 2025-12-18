import { Repository, Not, In } from "typeorm";
import { Friend, FriendStatus } from "../models/Friend.entity";
import { User } from "../models/User.entity";
import { UserProfile } from "../models/UserProfile.entity";
import { AppDataSource } from "../config/database";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../utils/app-error.util";
import { FriendListItem, FriendRequestItem } from "../types/friend.types";

/**
 * 好友服务
 */
export class FriendService {
  private friendRepository: Repository<Friend>;
  private userRepository: Repository<User>;
  private userProfileRepository: Repository<UserProfile>;

  constructor() {
    this.friendRepository = AppDataSource.getRepository(Friend);
    this.userRepository = AppDataSource.getRepository(User);
    this.userProfileRepository = AppDataSource.getRepository(UserProfile);
  }

  /**
   * 发送好友请求
   */
  public async sendFriendRequest(
    requesterId: string,
    recipientId: string
  ): Promise<{ friendRequest: Friend; requesterName: string; requesterAvatar: string | null }> {
    // 不能向自己发送好友请求
    if (requesterId === recipientId) {
      throw new ValidationError("无法向自己发送好友请求");
    }

    // 检查接收者是否存在
    const recipient = await this.userRepository.findOne({
      where: { id: recipientId },
    });
    if (!recipient) {
      throw new NotFoundError("用户未找到");
    }

    // 获取请求者信息
    const requester = await this.userRepository.findOne({
      where: { id: requesterId },
      relations: ['profile'],
    });
    if (!requester) {
      throw new NotFoundError("请求者未找到");
    }

    // 检查是否已经存在好友关系（任一方向）
    const existingFriendship = await this.friendRepository.findOne({
      where: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendStatus.PENDING) {
        throw new ConflictError("好友请求已在等待中");
      }
      if (existingFriendship.status === FriendStatus.ACCEPTED) {
        throw new ConflictError("已经是好友");
      }
      if (existingFriendship.status === FriendStatus.BLOCKED) {
        throw new ConflictError("无法发送好友请求");
      }
    }

    // 创建好友请求
    const friendRequest = this.friendRepository.create({
      requesterId,
      recipientId,
      status: FriendStatus.PENDING,
    });

    await this.friendRepository.save(friendRequest);

    return {
      friendRequest,
      requesterName: requester.username,
      requesterAvatar: requester.profile?.avatarUrl || null,
    };
  }

  /**
   * 接受好友请求
   */
  public async acceptFriendRequest(
    userId: string,
    friendshipId: string
  ): Promise<{ friendship: Friend; accepterName: string; accepterAvatar: string | null }> {
    const friendship = await this.friendRepository.findOne({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundError("好友请求未找到");
    }

    // 只有接收者可以接受请求
    if (friendship.recipientId !== userId) {
      throw new ValidationError("只有接收者可以接受好友请求");
    }

    if (friendship.status !== FriendStatus.PENDING) {
      throw new ValidationError("好友请求不在等待状态");
    }

    // 获取接受者信息
    const accepter = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!accepter) {
      throw new NotFoundError("用户未找到");
    }

    friendship.status = FriendStatus.ACCEPTED;
    await this.friendRepository.save(friendship);

    return {
      friendship,
      accepterName: accepter.username,
      accepterAvatar: accepter.profile?.avatarUrl || null,
    };
  }

  /**
   * 拒绝好友请求
   */
  public async rejectFriendRequest(
    userId: string,
    friendshipId: string
  ): Promise<void> {
    const friendship = await this.friendRepository.findOne({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundError("好友请求未找到");
    }

    // 只有接收者可以拒绝请求
    if (friendship.recipientId !== userId) {
      throw new ValidationError("只有接收者可以拒绝好友请求");
    }

    if (friendship.status !== FriendStatus.PENDING) {
      throw new ValidationError("好友请求不在等待状态");
    }

    friendship.status = FriendStatus.REJECTED;
    await this.friendRepository.save(friendship);
  }

  /**
   * 获取好友列表
   */
  public async getFriends(userId: string): Promise<FriendListItem[]> {
    // 获取所有已接受的好友关系（双向）
    const friendships = await this.friendRepository.find({
      where: [
        { requesterId: userId, status: FriendStatus.ACCEPTED },
        { recipientId: userId, status: FriendStatus.ACCEPTED },
      ],
      relations: ["requester", "requester.profile", "recipient", "recipient.profile"],
    });

    const friends: FriendListItem[] = [];

    for (const friendship of friendships) {
      // 确定哪个用户是好友（不是当前用户）
      const isFriendRequester = friendship.recipientId === userId;
      const friendUser = isFriendRequester
        ? friendship.requester
        : friendship.recipient;

      friends.push({
        id: friendship.id,
        userId: friendUser.id,
        username: friendUser.username,
        email: friendUser.email,
        avatarUrl: friendUser.profile?.avatarUrl || null,
        bio: friendUser.profile?.bio || null,
        friendshipId: friendship.id,
        friendshipStatus: friendship.status,
        createdAt: friendship.createdAt,
      });
    }

    return friends;
  }

  /**
   * 获取待处理的好友请求
   */
  public async getPendingRequests(
    userId: string
  ): Promise<FriendRequestItem[]> {
    const requests = await this.friendRepository.find({
      where: {
        recipientId: userId,
        status: FriendStatus.PENDING,
      },
      relations: ["requester", "requester.profile"],
      order: { createdAt: "DESC" },
    });

    return requests.map((request) => ({
      id: request.id,
      requesterId: request.requesterId,
      requesterUsername: request.requester.username,
      requesterEmail: request.requester.email,
      requesterAvatarUrl: request.requester.profile?.avatarUrl || null,
      requesterBio: request.requester.profile?.bio || null,
      createdAt: request.createdAt,
    }));
  }

  /**
   * 获取发送的好友请求
   */
  public async getSentRequests(userId: string): Promise<FriendRequestItem[]> {
    const requests = await this.friendRepository.find({
      where: {
        requesterId: userId,
        status: FriendStatus.PENDING,
      },
      relations: ["recipient", "recipient.profile"],
      order: { createdAt: "DESC" },
    });

    return requests.map((request) => ({
      id: request.id,
      requesterId: request.recipientId,
      requesterUsername: request.recipient.username,
      requesterEmail: request.recipient.email,
      requesterAvatarUrl: request.recipient.profile?.avatarUrl || null,
      requesterBio: request.recipient.profile?.bio || null,
      createdAt: request.createdAt,
    }));
  }

  /**
   * 删除好友
   */
  public async removeFriend(
    userId: string,
    friendshipId: string
  ): Promise<void> {
    const friendship = await this.friendRepository.findOne({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundError("好友关系未找到");
    }

    // 只有好友关系的参与者可以删除
    if (
      friendship.requesterId !== userId &&
      friendship.recipientId !== userId
    ) {
      throw new ValidationError("您不在此好友关系中");
    }

    await this.friendRepository.remove(friendship);
  }

  /**
   * 搜索用户（用于添加好友）
   */
  public async searchUsers(
    currentUserId: string,
    query: string
  ): Promise<
    Array<{
      id: string;
      username: string;
      email: string;
      avatarUrl: string | null;
      bio: string | null;
      friendshipStatus: FriendStatus | null;
    }>
  > {
    // 搜索用户名或邮箱
    const users = await this.userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("user.id != :currentUserId", { currentUserId })
      .andWhere(
        "(LOWER(user.username) LIKE LOWER(:query) OR LOWER(user.email) LIKE LOWER(:query))",
        { query: `%${query}%` }
      )
      .take(20)
      .getMany();

    // 获取当前用户与这些用户的好友关系
    const userIds = users.map((u) => u.id);
    const friendships = await this.friendRepository.find({
      where: [
        { requesterId: currentUserId, recipientId: In(userIds) },
        { requesterId: In(userIds), recipientId: currentUserId },
      ],
    });

    // 创建好友关系映射
    const friendshipMap = new Map<string, FriendStatus>();
    friendships.forEach((f) => {
      const otherUserId =
        f.requesterId === currentUserId ? f.recipientId : f.requesterId;
      friendshipMap.set(otherUserId, f.status);
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.profile?.avatarUrl || null,
      bio: user.profile?.bio || null,
      friendshipStatus: friendshipMap.get(user.id) || null,
    }));
  }

  /**
   * 检查两个用户是否是好友
   */
  public async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId1, recipientId: userId2, status: FriendStatus.ACCEPTED },
        { requesterId: userId2, recipientId: userId1, status: FriendStatus.ACCEPTED },
      ],
    });

    return !!friendship;
  }
}

export default new FriendService();
