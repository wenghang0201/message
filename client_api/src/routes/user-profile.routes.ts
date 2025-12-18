import { Router } from "express";
import userProfileController from "../controllers/user-profile.controller";
import { authenticateToken } from "../middleware/auth.middleware";

/**
 * 用户资料路由
 */
class UserProfileRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // 所有用户资料路由都需要认证
    this.router.use(authenticateToken);

    // 获取当前用户资料
    this.router.get(
      "/profile/me",
      userProfileController.getMyProfile.bind(userProfileController)
    );

    // 更新当前用户资料
    this.router.put(
      "/profile/me",
      userProfileController.updateMyProfile.bind(userProfileController)
    );

    // 更新在线状态
    this.router.patch(
      "/profile/status",
      userProfileController.updateOnlineStatus.bind(userProfileController)
    );

    // 更新隐私设置
    this.router.patch(
      "/profile/privacy",
      userProfileController.updatePrivacySettings.bind(userProfileController)
    );

    // 获取指定用户资料
    this.router.get(
      "/profile/:userId",
      userProfileController.getUserProfile.bind(userProfileController)
    );
  }
}

export default new UserProfileRoutes().router;
