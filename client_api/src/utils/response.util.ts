import { Response } from "express";

/**
 * 统一API响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    statusCode: number;
    details?: any;
  };
  message?: string;
}

/**
 * 响应工具类
 */
export class ResponseUtil {
  /**
   * 成功响应
   * @param res Express Response对象
   * @param data 返回数据
   * @param message 成功消息（可选）
   * @param statusCode HTTP状态码（默认200）
   */
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };

    if (message) {
      response.message = message;
    }

    res.status(statusCode).json(response);
  }

  /**
   * 创建成功响应 - 201 Created
   */
  static created<T>(res: Response, data?: T, message?: string): void {
    this.success(res, data, message, 201);
  }

  /**
   * 错误响应
   * @param res Express Response对象
   * @param message 错误消息
   * @param statusCode HTTP状态码（默认500）
   * @param details 错误详情（可选）
   */
  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    details?: any
  ): void {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        statusCode,
        ...(details && { details }),
      },
    };

    res.status(statusCode).json(response);
  }

  /**
   * 400 Bad Request
   */
  static badRequest(res: Response, message: string = "错误的请求", details?: any): void {
    this.error(res, message, 400, details);
  }

  /**
   * 401 Unauthorized
   */
  static unauthorized(res: Response, message: string = "未授权", details?: any): void {
    this.error(res, message, 401, details);
  }

  /**
   * 403 Forbidden
   */
  static forbidden(res: Response, message: string = "禁止访问", details?: any): void {
    this.error(res, message, 403, details);
  }

  /**
   * 404 Not Found
   */
  static notFound(res: Response, message: string = "资源未找到", details?: any): void {
    this.error(res, message, 404, details);
  }

  /**
   * 409 Conflict
   */
  static conflict(res: Response, message: string = "资源冲突", details?: any): void {
    this.error(res, message, 409, details);
  }

  /**
   * 422 Unprocessable Entity (Validation Error)
   */
  static validationError(res: Response, message: string = "验证失败", details?: any): void {
    this.error(res, message, 422, details);
  }

  /**
   * 500 Internal Server Error
   */
  static serverError(res: Response, message: string = "服务器内部错误", details?: any): void {
    this.error(res, message, 500, details);
  }
}
