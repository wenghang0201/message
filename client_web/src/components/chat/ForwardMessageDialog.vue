<template>
  <van-popup
    v-model:show="show"
    position="bottom"
    :style="{ height: '70%' }"
    round
    closeable
    @close="handleClose"
  >
    <div class="forward-dialog">
      <div class="forward-header">
        <h3>转发消息</h3>
        <div class="forward-info">选择要转发到的聊天</div>
      </div>

      <div class="search-box">
        <van-search
          v-model="searchQuery"
          placeholder="搜索聊天"
          shape="round"
        />
      </div>

      <div class="chat-list">
        <van-checkbox-group v-model="selectedChatIds">
          <div
            v-for="chat in filteredChats"
            :key="chat.id"
            class="chat-item"
          >
            <van-checkbox :name="chat.id" shape="square">
              <div class="chat-info">
                <van-image
                  :src="chat.avatar || defaultAvatar"
                  round
                  width="40"
                  height="40"
                  fit="cover"
                />
                <div class="chat-details">
                  <div class="chat-name">{{ chat.name }}</div>
                  <div class="chat-type">
                    {{ chat.type === 'single' ? '私聊' : '群聊' }}
                  </div>
                </div>
              </div>
            </van-checkbox>
          </div>
        </van-checkbox-group>

        <van-empty
          v-if="filteredChats.length === 0"
          description="没有找到聊天"
        />
      </div>

      <div class="forward-footer">
        <van-button
          block
          type="primary"
          :disabled="selectedChatIds.length === 0"
          @click="handleForward"
        >
          转发到 {{ selectedChatIds.length }} 个聊天
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import type { Message } from '@/types/message'

interface Props {
  modelValue: boolean
  message: Message | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  forward: [chatIds: string[], message: Message]
}>()

const chatStore = useChatStore()

const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const searchQuery = ref('')
const selectedChatIds = ref<string[]>([])
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'

const filteredChats = computed(() => {
  const chats = chatStore.sortedChats

  if (!searchQuery.value.trim()) {
    return chats
  }

  const query = searchQuery.value.toLowerCase()
  return chats.filter(chat =>
    chat.name.toLowerCase().includes(query)
  )
})

const handleForward = () => {
  if (selectedChatIds.value.length === 0 || !props.message) return

  emit('forward', selectedChatIds.value, props.message)
  handleClose()
}

const handleClose = () => {
  show.value = false
  // 重置状态
  setTimeout(() => {
    searchQuery.value = ''
    selectedChatIds.value = []
  }, 300)
}

// 消息更改时重置选中的聊天
watch(() => props.message, () => {
  selectedChatIds.value = []
})
</script>

<style scoped>
.forward-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--van-background-2);
}

.forward-header {
  padding: 16px;
  background-color: #fff;
  border-bottom: 1px solid var(--van-border-color);
}

.forward-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.forward-info {
  margin-top: 4px;
  font-size: 14px;
  color: #969799;
}

.search-box {
  background-color: #fff;
  padding: 8px 16px 16px;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.chat-item {
  background-color: #fff;
  padding: 12px 16px;
  border-bottom: 1px solid var(--van-border-color);
}

.chat-item:last-child {
  border-bottom: none;
}

.chat-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-details {
  flex: 1;
  min-width: 0;
}

.chat-name {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-type {
  margin-top: 2px;
  font-size: 12px;
  color: #969799;
}

.forward-footer {
  padding: 12px 16px;
  background-color: #fff;
  border-top: 1px solid var(--van-border-color);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
}

:deep(.van-checkbox__label) {
  flex: 1;
  width: 100%;
}
</style>
