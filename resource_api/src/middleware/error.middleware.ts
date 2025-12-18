import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.util";
import Log from "../utils/log.util";

/**
 * 全局错误处理中间件
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  //默认错误
  let statusCode = 500;
  let message = "服务器内部错误";

  //判断是否为自定义错误
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.message) {
    message = err.message;
  }

  //记录错误日志
  Log.error(`[错误] ${statusCode} - ${message}`);
  if (err.stack) {
    Log.error(err.stack);
  }

  //返回错误响应
  res.status(statusCode).json({
    result: 0,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
}

/**
 * 处理未捕获的路由
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  res.status(404).json({
    result: 0,
    error: `路由未找到: ${req.method} ${req.path}`
  });
}
