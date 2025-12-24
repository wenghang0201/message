/**
 * 查询助手工具类
 * 通用查询模式以防止 N+1 查询
 *
 * 这些助手封装了通用的预加载和过滤模式
 * 以确保整个应用程序中一致的查询优化
 *
 * 优势：
 * - 防止 N+1 查询问题
 * - 确保一致的预加载模式
 * - 减少服务中的样板代码
 */

import { SelectQueryBuilder } from 'typeorm';
import { ConversationUser } from '../models/ConversationUser.entity';

export class QueryHelper {
  /**
   * 为会话用户应用预加载（包含用户和个人资料关系）
   *
   * 通过在单个查询中加载相关的用户和个人资料数据
   * 防止在获取会话成员时出现 N+1 查询
   *
   * @param queryBuilder - ConversationUser 的查询构建器
   * @returns 应用了预加载的查询构建器
   */
  static applyConversationUserEagerLoading(
    queryBuilder: SelectQueryBuilder<ConversationUser>
  ): SelectQueryBuilder<ConversationUser> {
    return queryBuilder
      .leftJoinAndSelect('cu.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile');
  }

  /**
   * 应用活跃（未删除）成员过滤器
   *
   * 通过过滤软删除的条目
   * 确保只返回活跃的会话成员
   *
   * @param queryBuilder - ConversationUser 的查询构建器
   * @returns 应用了活跃成员过滤器的查询构建器
   */
  static applyActiveMemberFilter(
    queryBuilder: SelectQueryBuilder<ConversationUser>
  ): SelectQueryBuilder<ConversationUser> {
    return queryBuilder.andWhere('cu.deletedAt IS NULL');
  }

  /**
   * 同时应用预加载和活跃成员过滤器
   *
   * 结合两种通用模式的便捷方法
   *
   * @param queryBuilder - ConversationUser 的查询构建器
   * @returns 应用了预加载和活跃过滤器的查询构建器
   */
  static applyStandardConversationUserQuery(
    queryBuilder: SelectQueryBuilder<ConversationUser>
  ): SelectQueryBuilder<ConversationUser> {
    return this.applyActiveMemberFilter(
      this.applyConversationUserEagerLoading(queryBuilder)
    );
  }
}
