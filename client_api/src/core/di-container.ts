/**
 * 依赖注入容器
 * 提供集中的服务实例化和生命周期管理
 *
 * 第一阶段：与现有单例模式共存
 * 第三阶段：完全替换单例模式
 *
 * 功能：
 * - 仓库缓存（防止重复实例）
 * - 服务注册/解析
 * - 支持从单例模式逐步迁移
 */

import { Repository, ObjectLiteral, EntityTarget } from 'typeorm';
import { AppDataSource } from '../config/database';

type Constructor<T> = new (...args: any[]) => T;

/**
 * 依赖注入服务容器
 */
export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, any> = new Map();
  private repositories: Map<EntityTarget<any>, Repository<any>> = new Map();

  private constructor() {}

  /**
   * 获取容器的单例实例
   */
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * 注册单例服务
   */
  register<T>(key: string, instance: T): void {
    this.services.set(key, instance);
  }

  /**
   * 根据键解析服务
   */
  resolve<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`服务未找到: ${key}`);
    }
    return service;
  }

  /**
   * 获取仓库实例（已缓存）
   * 防止创建同一仓库的多个实例
   */
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    if (!this.repositories.has(entity)) {
      this.repositories.set(entity, AppDataSource.getRepository(entity));
    }
    return this.repositories.get(entity)!;
  }

  /**
   * 清除所有服务（用于测试）
   */
  clear(): void {
    this.services.clear();
    this.repositories.clear();
  }
}

export const container = DIContainer.getInstance();
