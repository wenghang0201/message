import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { User } from "../models/User.entity";
import { RefreshToken } from "../models/RefreshToken.entity";
import { AppDataSource } from "../config/database";
import { jwtConfig } from "../config/jwt.config";
import {
  AuthenticationError,
  DuplicateError,
  NotFoundError,
} from "../utils/app-error.util";

/**
 * 认证服务
 */
export class AuthService {
  private userRepository: Repository<User>;
  private refreshTokenRepository: Repository<RefreshToken>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
  }

  /**
   * 用户注册
   */
  public async register(
    username: string,
    email: string,
    password: string
  ): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    // 检查用户名是否已存在
    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUsername) {
      throw new DuplicateError("用户名已存在");
    }

    // 检查邮箱是否已存在
    const existingEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new DuplicateError("邮箱已存在");
    }

    // 生成密码哈希
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const user = this.userRepository.create({
      username,
      email,
      passwordHash,
    });

    await this.userRepository.save(user);

    // 生成令牌
    const { accessToken, refreshToken: refreshTokenString } =
      await this.generateTokens(user.id);

    // 返回用户信息和令牌
    return {
      user,
      accessToken,
      refreshToken: refreshTokenString,
    };
  }

  /**
   * 用户登录
   */
  public async login(
    usernameOrEmail: string,
    password: string
  ): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    // 查找用户（通过用户名或邮箱）
    const user = await this.userRepository.findOne({
      where: [
        { username: usernameOrEmail },
        { email: usernameOrEmail }
      ],
      select: ["id", "username", "email", "passwordHash", "createdAt", "updatedAt"],
    });

    if (!user) {
      throw new AuthenticationError("无效的凭证");
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError("无效的凭证");
    }

    // 生成令牌
    const { accessToken, refreshToken: refreshTokenString } =
      await this.generateTokens(user.id);

    // 移除密码哈希（不返回给客户端）
    delete (user as any).passwordHash;

    return {
      user,
      accessToken,
      refreshToken: refreshTokenString,
    };
  }

  /**
   * 刷新访问令牌
   */
  public async refreshAccessToken(refreshTokenString: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // 查找刷新令牌
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
      relations: ["user"],
    });

    if (!refreshToken) {
      throw new AuthenticationError("无效的刷新令牌");
    }

    // 检查令牌是否过期
    if (new Date() > refreshToken.expiresAt) {
      // 删除过期令牌
      await this.refreshTokenRepository.remove(refreshToken);
      throw new AuthenticationError("刷新令牌已过期");
    }

    // 删除旧的刷新令牌
    await this.refreshTokenRepository.remove(refreshToken);

    // 生成新令牌
    return await this.generateTokens(refreshToken.user.id);
  }

  /**
   * 登出（删除刷新令牌）
   */
  public async logout(refreshTokenString: string): Promise<void> {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
    });

    if (refreshToken) {
      await this.refreshTokenRepository.remove(refreshToken);
    }
  }

  /**
   * 根据用户ID获取用户信息
   */
  public async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("用户未找到");
    }

    return user;
  }


  /**
   * 生成访问令牌和刷新令牌
   */
  private async generateTokens(
    userId: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // 生成访问令牌
    const accessToken = jwt.sign(
      { userId },
      jwtConfig.secret,
      { expiresIn: jwtConfig.accessTokenExpiration } as jwt.SignOptions
    );

    // 生成刷新令牌
    const refreshTokenString = jwt.sign(
      { userId },
      jwtConfig.secret,
      { expiresIn: jwtConfig.refreshTokenExpiration } as jwt.SignOptions
    );

    // 计算刷新令牌过期时间
    const expiresAt = new Date();
    // 解析过期时间（365d -> 365天）
    const expirationMatch = jwtConfig.refreshTokenExpiration.match(/^(\d+)([dhm])$/);
    if (expirationMatch) {
      const value = parseInt(expirationMatch[1]);
      const unit = expirationMatch[2];

      if (unit === "d") {
        expiresAt.setDate(expiresAt.getDate() + value);
      } else if (unit === "h") {
        expiresAt.setHours(expiresAt.getHours() + value);
      } else if (unit === "m") {
        expiresAt.setMinutes(expiresAt.getMinutes() + value);
      }
    }

    // 保存刷新令牌到数据库
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token: refreshTokenString,
      expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return { accessToken, refreshToken: refreshTokenString };
  }

  /**
   * 验证访问令牌
   */
  public verifyAccessToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, jwtConfig.secret) as { userId: string };
      return payload;
    } catch (error) {
      throw new AuthenticationError("无效或已过期的访问令牌");
    }
  }

  /**
   * 修改密码
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // 查找用户
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "username", "email", "passwordHash", "createdAt", "updatedAt"],
    });

    if (!user) {
      throw new NotFoundError("用户不存在");
    }

    // 验证当前密码
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError("当前密码错误");
    }

    // 生成新密码哈希
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    user.passwordHash = newPasswordHash;
    await this.userRepository.save(user);
  }
}

export default new AuthService();
