import { Request, Response, NextFunction } from "express";
import authService from "../services/auth.service";
import { RegisterDto, LoginDto, RefreshTokenDto } from "../schemas/auth.schema";
import { ResponseUtil } from "../utils/response.util";

/**
 * 认证控制器
 */
export class AuthController {
  /**
   * 用户注册
   * POST /auth/register
   */
  public async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { username, email, password } = req.body as RegisterDto;

      const result = await authService.register(username, email, password);

      ResponseUtil.created(
        res,
        {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            createdAt: result.user.createdAt,
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        "User registered successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户登录
   * POST /auth/login
   */
  public async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { usernameOrEmail, password } = req.body as LoginDto;

      const result = await authService.login(usernameOrEmail, password);

      ResponseUtil.success(
        res,
        {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            createdAt: result.user.createdAt,
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        "Login successful"
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * 刷新访问令牌
   * POST /auth/refresh
   */
  public async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenDto;

      const result = await authService.refreshAccessToken(refreshToken);

      ResponseUtil.success(
        res,
        {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        "Token refreshed successfully"
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * 登出
   * POST /auth/logout
   */
  public async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenDto;

      await authService.logout(refreshToken);

      ResponseUtil.success(res, undefined, "登出成功");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取当前用户信息
   * GET /auth/me
   */
  public async getCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!; // 由认证中间件设置

      const user = await authService.getUserById(userId);

      ResponseUtil.success(res, {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 修改密码
   * POST /auth/change-password
   */
  public async changePassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!; // 由认证中间件设置
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(userId, currentPassword, newPassword);

      ResponseUtil.success(res, undefined, "密码修改成功");
    } catch (error) {
      next(error);
    }
  }

}

export default new AuthController();
