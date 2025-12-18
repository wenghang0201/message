import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.util";
import { ResponseUtil } from "../utils/response.util";
import Log from "../utils/log.util";

/**
 * 404错误处理中间件
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  ResponseUtil.notFound(res, `Route not found: ${req.method} ${req.path}`);
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 记录错误日志
  Log.error(
    `Error: ${err.message} | Path: ${req.method} ${req.path} | Stack: ${err.stack}`
  );

  // 如果是自定义应用错误
  if (err instanceof AppError) {
    ResponseUtil.error(res, err.message, err.statusCode);
    return;
  }

  // TypeORM数据库错误
  if ((err as any).name === "QueryFailedError") {
    ResponseUtil.serverError(res, "数据库操作失败");
    return;
  }

  // JWT错误
  if ((err as any).name === "JsonWebTokenError") {
    ResponseUtil.unauthorized(res, "无效的令牌");
    return;
  }

  if ((err as any).name === "TokenExpiredError") {
    ResponseUtil.unauthorized(res, "令牌已过期");
    return;
  }

  // 默认服务器错误
  const message = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;
  ResponseUtil.serverError(res, message);
}
