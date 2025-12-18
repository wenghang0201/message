/**
 * 自定义应用错误类
 */

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误 (422 Unprocessable Entity)
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 422);
  }
}

/**
 * 认证错误 (401 Unauthorized)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, 401);
  }
}

/**
 * 授权错误 (403 Forbidden)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403);
  }
}

/**
 * 资源未找到错误 (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

/**
 * 重复资源错误 (409 Conflict)
 */
export class DuplicateError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409);
  }
}

/**
 * 数据库错误 (500 Internal Server Error)
 */
export class DatabaseError extends AppError {
  constructor(message: string = "Database operation failed") {
    super(message, 500);
  }
}

/**
 * 文件上传错误 (400 Bad Request)
 */
export class FileUploadError extends AppError {
  constructor(message: string = "File upload failed") {
    super(message, 400);
  }
}
