/**
 * 仓库工厂
 * 抽象仓库创建以便于测试和依赖注入
 *
 * 提供一个清晰的接口来获取 TypeORM 仓库
 * 避免在整个代码库中直接耦合到 AppDataSource
 */

import { Repository, ObjectLiteral, EntityTarget } from 'typeorm';
import { container } from './di-container';

export interface IRepositoryFactory {
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T>;
}

export class RepositoryFactory implements IRepositoryFactory {
  /**
   * 获取给定实体的仓库实例
   * 仓库在 DI 容器中被缓存
   */
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return container.getRepository(entity);
  }
}

export const repositoryFactory = new RepositoryFactory();
