import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.config";

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
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 从Authorization头获取令牌
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          message: "No authorization header provided",
          statusCode: 401,
        },
      });
      return;
    }

    // 检查格式：Bearer <token>
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        success: false,
        error: {
          message: "Invalid authorization header format. Expected: Bearer <token>",
          statusCode: 401,
        },
      });
      return;
    }

    const token = parts[1];

    // 验证令牌
    const payload = jwt.verify(token, jwtConfig.secret) as { userId: string };

    // 将用户ID附加到请求对象
    req.userId = payload.userId;

    next();
  } catch (error) {
    if ((error as any).name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        error: {
          message: "Invalid token",
          statusCode: 401,
        },
      });
      return;
    }

    if ((error as any).name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: {
          message: "Token expired",
          statusCode: 401,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: "Authentication failed",
        statusCode: 500,
      },
    });
  }
}
