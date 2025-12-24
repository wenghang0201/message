/**
 * Dependency Injection Container
 * Provides centralized service instantiation and lifecycle management
 *
 * Phase 1: Co-exists with existing singletons
 * Phase 3: Replaces singleton pattern entirely
 *
 * Features:
 * - Repository caching (prevents duplicate instances)
 * - Service registration/resolution
 * - Supports gradual migration from singletons
 */

import { Repository, ObjectLiteral, EntityTarget } from 'typeorm';
import { AppDataSource } from '../config/database';

type Constructor<T> = new (...args: any[]) => T;

/**
 * Service container for dependency injection
 */
export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, any> = new Map();
  private repositories: Map<EntityTarget<any>, Repository<any>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance of container
   */
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Register a singleton service
   */
  register<T>(key: string, instance: T): void {
    this.services.set(key, instance);
  }

  /**
   * Resolve a service by key
   */
  resolve<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service not found: ${key}`);
    }
    return service;
  }

  /**
   * Get repository instance (cached)
   * Prevents creating multiple instances of the same repository
   */
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    if (!this.repositories.has(entity)) {
      this.repositories.set(entity, AppDataSource.getRepository(entity));
    }
    return this.repositories.get(entity)!;
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
    this.repositories.clear();
  }
}

export const container = DIContainer.getInstance();
