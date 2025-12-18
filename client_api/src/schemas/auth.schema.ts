import * as yup from "yup";

/**
 * 用户注册
 */
export const registerSchema = yup.object({
  username: yup
    .string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters long")
    .max(50, "Username must not exceed 50 characters")
    .matches(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens"
    ),
  email: yup
    .string()
    .required("Email is required")
    .email("Invalid email format")
    .max(255, "Email must not exceed 255 characters"),
  password: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 8 characters long")
    .max(100, "Password must not exceed 100 characters")
    // .matches(
    //   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    //   "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    // ),
});

/**
 * 用户登录
 */
export const loginSchema = yup.object({
  usernameOrEmail: yup
    .string()
    .required("Username or email is required")
    .min(1, "Username or email is required"),
  password: yup
    .string()
    .required("Password is required")
    .min(1, "Password is required"),
});

/**
 * 刷新令牌
 */
export const refreshTokenSchema = yup.object({
  refreshToken: yup
    .string()
    .required("Refresh token is required")
    .min(1, "Refresh token is required"),
});

/**
 * 类型定义
 */
export type RegisterDto = yup.InferType<typeof registerSchema>;
export type LoginDto = yup.InferType<typeof loginSchema>;
export type RefreshTokenDto = yup.InferType<typeof refreshTokenSchema>;
