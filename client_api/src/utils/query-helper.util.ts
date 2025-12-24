/**
 * Query Helper Utilities
 * Common query patterns to prevent N+1 queries
 *
 * These helpers encapsulate common eager loading and filtering patterns
 * to ensure consistent query optimization across the application.
 *
 * Benefits:
 * - Prevents N+1 query problems
 * - Ensures consistent eager loading patterns
 * - Reduces boilerplate in services
 */

import { SelectQueryBuilder } from 'typeorm';
import { ConversationUser } from '../models/ConversationUser.entity';

export class QueryHelper {
  /**
   * Apply eager loading for conversation users with user and profile relations
   *
   * This prevents N+1 queries when fetching conversation members by loading
   * related user and profile data in a single query.
   *
   * @param queryBuilder - Query builder for ConversationUser
   * @returns Query builder with eager loading applied
   */
  static applyConversationUserEagerLoading(
    queryBuilder: SelectQueryBuilder<ConversationUser>
  ): SelectQueryBuilder<ConversationUser> {
    return queryBuilder
      .leftJoinAndSelect('cu.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile');
  }

  /**
   * Apply filter for active (non-deleted) members
   *
   * Ensures only active conversation members are returned
   * by filtering out soft-deleted entries.
   *
   * @param queryBuilder - Query builder for ConversationUser
   * @returns Query builder with active member filter
   */
  static applyActiveMemberFilter(
    queryBuilder: SelectQueryBuilder<ConversationUser>
  ): SelectQueryBuilder<ConversationUser> {
    return queryBuilder.andWhere('cu.deletedAt IS NULL');
  }

  /**
   * Apply both eager loading and active member filter
   *
   * Convenience method that combines both common patterns.
   *
   * @param queryBuilder - Query builder for ConversationUser
   * @returns Query builder with eager loading and active filter
   */
  static applyStandardConversationUserQuery(
    queryBuilder: SelectQueryBuilder<ConversationUser>
  ): SelectQueryBuilder<ConversationUser> {
    return this.applyActiveMemberFilter(
      this.applyConversationUserEagerLoading(queryBuilder)
    );
  }
}
