/**
 * Repository Factory
 * Abstracts repository creation for easier testing and dependency injection
 *
 * This provides a clean interface for obtaining TypeORM repositories
 * without directly coupling to AppDataSource throughout the codebase.
 */

import { Repository, ObjectLiteral, EntityTarget } from 'typeorm';
import { container } from './di-container';

export interface IRepositoryFactory {
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T>;
}

export class RepositoryFactory implements IRepositoryFactory {
  /**
   * Get a repository instance for the given entity
   * Repositories are cached in the DI container
   */
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return container.getRepository(entity);
  }
}

export const repositoryFactory = new RepositoryFactory();
