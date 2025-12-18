import { Request, Response, NextFunction } from "express";
import { AnyObjectSchema } from "yup";
import { ResponseUtil } from "../utils/response.util";

/**
 * 通用验证中间件
 * @param schema Yup验证模式
 * @param source 验证来源：'body' | 'query' | 'params'
 */
function validate(schema: AnyObjectSchema, source: "body" | "query" | "params") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 验证并转换数据
      const validatedData = await schema.validate(req[source], {
        abortEarly: false, // 返回所有错误
        stripUnknown: true, // 移除未定义的字段
      });

      // 将验证后的数据附加到请求对象
      (req[source] as any) = validatedData;

      next();
    } catch (error: any) {
      if (error.name === "ValidationError") {
        // 格式化Yup验证错误
        const formattedErrors = error.inner.map((err: any) => ({
          field: err.path,
          message: err.message,
        }));

        const sourceLabel = source.charAt(0).toUpperCase() + source.slice(1);
        ResponseUtil.validationError(res, `${sourceLabel} validation failed`, formattedErrors);
        return;
      }

      next(error);
    }
  };
}

/**
 * 验证请求体中间件
 * @param schema Yup验证模式
 */
export function validateBody(schema: AnyObjectSchema) {
  return validate(schema, "body");
}

/**
 * 验证查询参数中间件
 * @param schema Yup验证模式
 */
export function validateQuery(schema: AnyObjectSchema) {
  return validate(schema, "query");
}

/**
 * 验证路径参数中间件
 * @param schema Yup验证模式
 */
export function validateParams(schema: AnyObjectSchema) {
  return validate(schema, "params");
}
