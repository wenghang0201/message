import { Request, Response, NextFunction } from "express";
import authService from "../services/auth.service";
import { AuthenticationError } from "../utils/app-error.util";

/**
 * 扩展Express Request接口以包含用户信息
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * JWT认证中间件
 * 验证访问令牌并将用户ID附加到请求对象
 */
export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 从Authorization头获取令牌
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError("未提供授权头");
    }

    // 检查格式：Bearer <token>
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new AuthenticationError(
        "授权头格式不正确，应为 'Bearer <token>'"
      );
    }

    const token = parts[1];

    // 验证令牌
    const { userId } = authService.verifyAccessToken(token);

    // 将用户ID附加到请求对象
    req.userId = userId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 可选的JWT认证中间件
 * 如果提供了令牌则验证，但不强制要求
 */
export async function optionalAuthenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        const token = parts[1];
        const { userId } = authService.verifyAccessToken(token);
        req.userId = userId;
      }
    }

    next();
  } catch (error) {
    // 忽略认证错误，继续处理请求
    next();
  }
}
