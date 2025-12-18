import { Router } from "express";
import authController from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validation.middleware";
import { registerSchema, loginSchema, refreshTokenSchema } from "../schemas/auth.schema";

/**
 * 认证路由
 */
class AuthRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // 公开路由（无需认证）
    this.router.post(
      "/auth/register",
      validateBody(registerSchema),
      authController.register.bind(authController)
    );

    this.router.post(
      "/auth/login",
      validateBody(loginSchema),
      authController.login.bind(authController)
    );

    this.router.post(
      "/auth/refresh",
      validateBody(refreshTokenSchema),
      authController.refreshToken.bind(authController)
    );

    this.router.post(
      "/auth/logout",
      validateBody(refreshTokenSchema),
      authController.logout.bind(authController)
    );

    // 受保护路由（需要认证）
    this.router.get(
      "/auth/me",
      authenticateToken,
      authController.getCurrentUser.bind(authController)
    );

    this.router.post(
      "/auth/change-password",
      authenticateToken,
      authController.changePassword.bind(authController)
    );
  }
}

export default new AuthRoutes().router;
