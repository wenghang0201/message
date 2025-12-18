import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 添加数据库索引以优化性能
 * 为常用查询列添加索引以加速查询
 */
export class AddDatabaseIndexes1765200000000 implements MigrationInterface {
  /**
   * 安全地创建索引（如果不存在）
   */
  private async createIndexIfNotExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columns: string
  ): Promise<void> {
    const result = await queryRunner.query(
      `SELECT COUNT(*) as count FROM information_schema.statistics
       WHERE table_schema = DATABASE()
       AND table_name = '${tableName}'
       AND index_name = '${indexName}'`
    );

    if (result[0].count === 0) {
      await queryRunner.query(
        `CREATE INDEX ${indexName} ON ${tableName}(${columns})`
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 用户表索引
    await this.createIndexIfNotExists(queryRunner, 'users', 'idx_users_email', 'email');
    await this.createIndexIfNotExists(queryRunner, 'users', 'idx_users_username', 'username');

    // 消息表索引 - 用于高效的消息查询
    await this.createIndexIfNotExists(queryRunner, 'messages', 'idx_messages_conversation_id', 'conversation_id');
    await this.createIndexIfNotExists(queryRunner, 'messages', 'idx_messages_sender_id', 'sender_id');
    await this.createIndexIfNotExists(queryRunner, 'messages', 'idx_messages_created_at', 'created_at DESC');
    await this.createIndexIfNotExists(queryRunner, 'messages', 'idx_messages_conversation_created', 'conversation_id, created_at DESC');

    // 对话用户表索引 - 用于成员查询
    await this.createIndexIfNotExists(queryRunner, 'conversation_users', 'idx_conversation_users_user_id', 'user_id');
    await this.createIndexIfNotExists(queryRunner, 'conversation_users', 'idx_conversation_users_conversation_id', 'conversation_id');
    await this.createIndexIfNotExists(queryRunner, 'conversation_users', 'idx_conversation_users_deleted_at', 'deleted_at');
    await this.createIndexIfNotExists(queryRunner, 'conversation_users', 'idx_conversation_users_user_deleted', 'user_id, deleted_at');

    // 对话表索引
    await this.createIndexIfNotExists(queryRunner, 'conversations', 'idx_conversations_type', 'type');
    await this.createIndexIfNotExists(queryRunner, 'conversations', 'idx_conversations_created_at', 'created_at DESC');

    // 好友表索引 - 用于好友关系查询
    await this.createIndexIfNotExists(queryRunner, 'friends', 'idx_friends_requester_id', 'requester_id');
    await this.createIndexIfNotExists(queryRunner, 'friends', 'idx_friends_recipient_id', 'recipient_id');
    await this.createIndexIfNotExists(queryRunner, 'friends', 'idx_friends_status', 'status');
    await this.createIndexIfNotExists(queryRunner, 'friends', 'idx_friends_requester_status', 'requester_id, status');
    await this.createIndexIfNotExists(queryRunner, 'friends', 'idx_friends_recipient_status', 'recipient_id, status');

    // 刷新令牌表索引
    await this.createIndexIfNotExists(queryRunner, 'refresh_tokens', 'idx_refresh_tokens_user_id', 'user_id');
    await this.createIndexIfNotExists(queryRunner, 'refresh_tokens', 'idx_refresh_tokens_token', 'token');
    await this.createIndexIfNotExists(queryRunner, 'refresh_tokens', 'idx_refresh_tokens_expires_at', 'expires_at');

    // 消息状态表索引
    await this.createIndexIfNotExists(queryRunner, 'message_status', 'idx_message_status_message_id', 'message_id');
    await this.createIndexIfNotExists(queryRunner, 'message_status', 'idx_message_status_user_id', 'user_id');
    await this.createIndexIfNotExists(queryRunner, 'message_status', 'idx_message_status_status', 'status');

    // 通知表索引
    await this.createIndexIfNotExists(queryRunner, 'notifications', 'idx_notifications_user_id', 'user_id');
    await this.createIndexIfNotExists(queryRunner, 'notifications', 'idx_notifications_is_read', 'is_read');
    await this.createIndexIfNotExists(queryRunner, 'notifications', 'idx_notifications_created_at', 'created_at DESC');
    await this.createIndexIfNotExists(queryRunner, 'notifications', 'idx_notifications_user_read', 'user_id, is_read');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 按相反顺序删除所有索引
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_user_read ON notifications`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_created_at ON notifications`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_is_read ON notifications`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_user_id ON notifications`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_message_status_status ON message_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_message_status_user_id ON message_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_message_status_message_id ON message_status`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_expires_at ON refresh_tokens`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_token ON refresh_tokens`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_user_id ON refresh_tokens`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_friends_recipient_status ON friends`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_friends_requester_status ON friends`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_friends_status ON friends`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_friends_recipient_id ON friends`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_friends_requester_id ON friends`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversations_created_at ON conversations`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversations_type ON conversations`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversation_users_user_deleted ON conversation_users`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversation_users_deleted_at ON conversation_users`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversation_users_conversation_id ON conversation_users`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversation_users_user_id ON conversation_users`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_conversation_created ON messages`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_created_at ON messages`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_sender_id ON messages`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_messages_conversation_id ON messages`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_username ON users`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_email ON users`);
  }
}
