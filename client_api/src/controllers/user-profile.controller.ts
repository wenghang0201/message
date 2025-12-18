import { Request, Response, NextFunction } from "express";
import userProfileService from "../services/user-profile.service";
import { ResponseUtil } from "../utils/response.util";
import {
  updateProfileSchema,
  updatePrivacySchema,
  updateOnlineStatusSchema,
} from "../schemas/user-profile.schema";

/**
 * 用户资料控制器
 */
export class UserProfileController {
  /**
   * 获取当前用户资料
   * GET /api/profile/me
   */
  public async getMyProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const profile = await userProfileService.getProfile(userId, userId);

      ResponseUtil.success(res, profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取指定用户资料
   * GET /api/profile/:userId
   */
  public async getUserProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const requesterId = req.userId!;

      const profile = await userProfileService.getProfile(userId, requesterId);

      ResponseUtil.success(res, profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新当前用户资料
   * PUT /api/profile/me
   */
  public async updateMyProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;

      // 验证输入
      const validatedData = await updateProfileSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      const profile = await userProfileService.updateProfile(
        userId,
        validatedData
      );

      ResponseUtil.success(res, profile, "资料更新成功");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新在线状态
   * PATCH /api/profile/status
   */
  public async updateOnlineStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;

      // 验证输入
      const { isOnline } = await updateOnlineStatusSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      const profile = await userProfileService.updateOnlineStatus(
        userId,
        isOnline
      );

      ResponseUtil.success(res, profile, "在线状态更新成功");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新隐私设置
   * PATCH /api/profile/privacy
   */
  public async updatePrivacySettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;

      // 验证输入
      const validatedData = await updatePrivacySchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      const profile = await userProfileService.updatePrivacySettings(
        userId,
        validatedData as any
      );

      ResponseUtil.success(res, profile, "隐私设置更新成功");
    } catch (error) {
      next(error);
    }
  }
}

export default new UserProfileController();
