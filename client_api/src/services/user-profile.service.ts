import { Repository } from "typeorm";
import { AppDataSource } from "../config/database";
import { UserProfile } from "../models/UserProfile.entity";
import { User } from "../models/User.entity";
import { Friend, FriendStatus } from "../models/Friend.entity";
import { NotFoundError } from "../utils/app-error.util";

/**
 * 用户资料服务
 */
export class UserProfileService {
  private userProfileRepository: Repository<UserProfile>;
  private userRepository: Repository<User>;
  private friendRepository: Repository<Friend>;

  constructor() {
    this.userProfileRepository = AppDataSource.getRepository(UserProfile);
    this.userRepository = AppDataSource.getRepository(User);
    this.friendRepository = AppDataSource.getRepository(Friend);
  }

  /**
   * 获取或创建用户资料
   */
  public async getOrCreateProfile(userId: string): Promise<UserProfile> {
    let profile = await this.userProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      profile = this.userProfileRepository.create({
        userId,
        privacySettings: {
          showLastSeen: "everyone",
        },
      });
      await this.userProfileRepository.save(profile);
    }

    return profile;
  }

  /**
   * 获取用户资料（带隐私检查）
   */
  public async getProfile(
    userId: string,
    requesterId?: string
  ): Promise<UserProfile> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["profile"],
    });

    if (!user) {
      throw new NotFoundError("用户不存在");
    }

    let profile = user.profile;
    if (!profile) {
      profile = await this.getOrCreateProfile(userId);
    }

    // 如果是查看自己的资料，直接返回
    if (requesterId === userId) {
      return { ...profile, user: { ...user, passwordHash: undefined } } as any;
    }

    // 检查是否为好友
    let isFriend = false;
    if (requesterId) {
      const friendship = await this.friendRepository.findOne({
        where: [
          { requesterId, recipientId: userId, status: FriendStatus.ACCEPTED },
          { requesterId: userId, recipientId: requesterId, status: FriendStatus.ACCEPTED },
        ],
      });
      isFriend = !!friendship;
    }

    // 应用隐私设置
    const privacySettings = profile.privacySettings || {};

    // 隐藏上次在线时间
    if (
      privacySettings.showLastSeen === "nobody" ||
      (privacySettings.showLastSeen === "friends" && !isFriend)
    ) {
      profile.lastSeenAt = null;
      profile.isOnline = false;
    }

    return { ...profile, user: { ...user, passwordHash: undefined } } as any;
  }

  /**
   * 更新用户资料
   */
  public async updateProfile(
    userId: string,
    updates: {
      avatarUrl?: string | null;
      bio?: string | null;
      phoneNumber?: string | null;
      statusMessage?: string | null;
    }
  ): Promise<UserProfile> {
    let profile = await this.getOrCreateProfile(userId);

    Object.assign(profile, updates);
    await this.userProfileRepository.save(profile);

    return profile;
  }

  /**
   * 更新在线状态
   */
  public async updateOnlineStatus(
    userId: string,
    isOnline: boolean
  ): Promise<UserProfile> {
    let profile = await this.getOrCreateProfile(userId);

    profile.isOnline = isOnline;
    if (!isOnline) {
      profile.lastSeenAt = new Date();
    } else {
      // 当用户上线时，清除 lastSeenAt
      profile.lastSeenAt = null;
    }

    await this.userProfileRepository.save(profile);

    return profile;
  }

  /**
   * 更新隐私设置
   */
  public async updatePrivacySettings(
    userId: string,
    settings: {
      showLastSeen?: "everyone" | "friends" | "nobody";
    }
  ): Promise<UserProfile> {
    let profile = await this.getOrCreateProfile(userId);

    profile.privacySettings = {
      ...profile.privacySettings,
      ...settings,
    };

    await this.userProfileRepository.save(profile);

    return profile;
  }

  /**
   * 批量获取用户资料（用于好友列表等）
   */
  public async getProfilesByIds(
    userIds: string[],
    requesterId: string
  ): Promise<UserProfile[]> {
    const profiles = await Promise.all(
      userIds.map((userId) => this.getProfile(userId, requesterId))
    );
    return profiles;
  }
}

export default new UserProfileService();
