import http from '../utils/http';
import {
  ApiMessage,
  SendMessageDto,
  GetMessagesResponse,
} from '@/types/api';

/**
 * 消息服务
 */

class MessageService {
  /**
   * 发送消息
   */
  async sendMessage(data: SendMessageDto): Promise<ApiMessage> {
    const response = await http.post('/messages', data);
    return response.data.data;
  }

  /**
   * 获取对话消息列表（分页）
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 30
  ): Promise<GetMessagesResponse> {
    const response = await http.get(
      `/conversations/${conversationId}/messages`,
      {
        params: { page, limit },
      }
    );
    return response.data.data;
  }

  /**
   * 编辑消息
   */
  async updateMessage(messageId: string, content: string): Promise<ApiMessage> {
    const response = await http.put(`/messages/${messageId}`, { content });
    return response.data.data;
  }

  /**
   * 删除消息
   */
  async deleteMessage(messageId: string): Promise<void> {
    await http.delete(`/messages/${messageId}`);
  }

  /**
   * 批量删除消息
   */
  async batchDeleteMessages(messageIds: string[]): Promise<void> {
    await http.post('/messages/batch-delete', { messageIds });
  }

  /**
   * 获取单条消息
   */
  async getMessage(messageId: string): Promise<ApiMessage> {
    const response = await http.get(`/messages/${messageId}`);
    return response.data.data;
  }

  /**
   * 撤回消息
   */
  async recallMessage(messageId: string): Promise<void> {
    await http.post(`/messages/${messageId}/recall`);
  }
}

export default new MessageService();
