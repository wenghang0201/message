import { Repository } from "typeorm";
import { UserProfile } from "../models/UserProfile.entity";
import { AppDataSource } from "../config/database";

/**
 * 隐私设置类型
 */
export type PrivacyLevel = "everyone" | "nobody";

/**
 * 隐私工具类
 */
export class PrivacyUtil {
  private static userProfileRepository: Repository<UserProfile>;

  /**
   * 初始化仓库
   */
  private static initRepositories() {
    if (!this.userProfileRepository) {
      this.userProfileRepository = AppDataSource.getRepository(UserProfile);
    }
  }

  /**
   * 检查查看者是否可以看到目标用户的最后在线时间
   */
  public static async canSeeLastSeen(
    viewerId: string,
    targetUserId: string
  ): Promise<boolean> {
    // 用户总是可以看到自己的状态
    if (viewerId === targetUserId) {
      return true;
    }

    this.initRepositories();

    // 获取目标用户的隐私设置
    const targetProfile = await this.userProfileRepository.findOne({
      where: { userId: targetUserId },
    });

    if (!targetProfile || !targetProfile.privacySettings) {
      // 默认设置：所有人可见
      return true;
    }

    const showLastSeen = targetProfile.privacySettings.showLastSeen || "everyone";

    switch (showLastSeen) {
      case "everyone":
        return true;

      case "nobody":
        return false;

      default:
        return true;
    }
  }

  /**
   * 批量检查查看者可以看到哪些用户的最后在线时间
   * 返回可见用户的ID数组
   */
  public static async filterVisibleUsers(
    viewerId: string,
    targetUserIds: string[]
  ): Promise<string[]> {
    const visibleUserIds: string[] = [];

    for (const targetUserId of targetUserIds) {
      const canSee = await this.canSeeLastSeen(viewerId, targetUserId);
      if (canSee) {
        visibleUserIds.push(targetUserId);
      }
    }

    return visibleUserIds;
  }

  /**
   * 获取所有可以看到目标用户状态的用户ID列表
   * 用于广播用户状态变化时过滤接收者
   */
  public static async getAuthorizedViewers(targetUserId: string): Promise<string[]> {
    this.initRepositories();

    // 获取目标用户的隐私设置
    const targetProfile = await this.userProfileRepository.findOne({
      where: { userId: targetUserId },
    });

    if (!targetProfile || !targetProfile.privacySettings) {
      // 默认设置：所有人可见，返回 null 表示广播给所有人
      return [];
    }

    const showLastSeen = targetProfile.privacySettings.showLastSeen || "everyone";

    switch (showLastSeen) {
      case "everyone":
        // 返回空数组表示所有人可见
        return [];

      case "nobody":
        // 只有自己可见
        return [targetUserId];

      default:
        return [];
    }
  }
}
