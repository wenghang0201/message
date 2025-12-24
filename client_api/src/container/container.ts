import 'reflect-metadata';
import { container } from 'tsyringe';
import { DataSource, Repository } from 'typeorm';
import { AppDataSource } from '../data-source';

// Import entities
import { Conversation } from '../models/Conversation.entity';
import { ConversationUser } from '../models/ConversationUser.entity';
import { Message } from '../models/Message.entity';
import { MessageStatus } from '../models/MessageStatus.entity';
import { User } from '../models/User.entity';
import { Friend } from '../models/Friend.entity';


// Utility classes
import { PermissionChecker } from '../utils/permission-checker.util';
import { SystemMessageCreator } from '../utils/system-message-creator.util';

// Services
import { ConversationPermissionService } from '../services/conversation-permission.service';
import { GroupService } from '../services/group.service';
import { ConversationCoreService } from '../services/conversation-core.service';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';

/**
 * 简化的依赖注入容器配置
 * 直接注册 TypeORM 仓库，无需接口层
 */
export function setupContainer(): void {
  // 注册数据源
  container.registerInstance('DataSource', AppDataSource);

  // 使用工厂函数直接注册仓库
  container.register('ConversationRepository', {
    useFactory: () => AppDataSource.getRepository(Conversation),
  });

  container.register('ConversationUserRepository', {
    useFactory: () => AppDataSource.getRepository(ConversationUser),
  });

  container.register('MessageRepository', {
    useFactory: () => AppDataSource.getRepository(Message),
  });

  container.register('MessageStatusRepository', {
    useFactory: () => AppDataSource.getRepository(MessageStatus),
  });

  container.register('UserRepository', {
    useFactory: () => AppDataSource.getRepository(User),
  });

  container.register('FriendRepository', {
    useFactory: () => AppDataSource.getRepository(Friend),
  });

  // 注册工具类（这些已经使用 @injectable）
  container.register(PermissionChecker, { useClass: PermissionChecker });
  container.register(SystemMessageCreator, { useClass: SystemMessageCreator });

  // 注册服务（这些已经使用 @injectable）
  container.register(ConversationPermissionService, { useClass: ConversationPermissionService });
  container.register(GroupService, { useClass: GroupService });
  container.register(ConversationCoreService, { useClass: ConversationCoreService });
  container.register(ConversationService, { useClass: ConversationService });
  container.register(MessageService, { useClass: MessageService });
}

export { container };
