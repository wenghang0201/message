<template>
  <div class="create-group-view">
    <NavBar
      title="新建群聊"
      fixed
      left-arrow
      @click-left="$router.back()"
    />

    <div class="content">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="groupName"
            name="groupName"
            label="群聊名称"
            placeholder="请输入群聊名称"
            :rules="[{ required: true, message: '请输入群聊名称' }]"
          />
        </van-cell-group>

        <div class="section-title">选择成员 (已选 {{ selectedMembers.length }} 人)</div>

        <van-search
          v-model="searchQuery"
          placeholder="搜索好友..."
          @update:model-value="handleSearch"
        />

        <div v-if="loading" class="loading-container">
          <van-loading size="24px">加载中...</van-loading>
        </div>

        <van-checkbox-group v-else v-model="selectedMembers">
          <van-cell-group inset>
            <van-cell
              v-for="friend in filteredFriends"
              :key="friend.userId"
              clickable
              @click="toggleSelect(friend.userId)"
            >
              <template #icon>
                <van-image
                  round
                  width="40"
                  height="40"
                  :src="friend.avatarUrl || '/default-avatar.png'"
                  fit="cover"
                  class="friend-avatar"
                />
              </template>
              <template #title>
                <div class="friend-name">{{ friend.username }}</div>
              </template>
              <template #right-icon>
                <van-checkbox
                  :name="friend.userId"
                  @click.stop
                />
              </template>
            </van-cell>
          </van-cell-group>
        </van-checkbox-group>

        <van-empty
          v-if="!loading && filteredFriends.length === 0"
          description="暂无好友"
          image="search"
        />

        <div class="submit-button">
          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="submitting"
            :disabled="selectedMembers.length === 0"
          >
            创建群聊 ({{ selectedMembers.length }})
          </van-button>
        </div>
      </van-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showNotify } from '@/utils/notify'
import friendService from '@/services/friend.service'
import conversationService from '@/services/conversation.service'
import type { FriendListItem } from '@/types/api'
import NavBar from '@/components/common/NavBar.vue'

const router = useRouter()

const groupName = ref('')
const searchQuery = ref('')
const selectedMembers = ref<string[]>([])
const friends = ref<FriendListItem[]>([])
const loading = ref(false)
const submitting = ref(false)

const filteredFriends = computed(() => {
  if (!searchQuery.value) {
    return friends.value
  }
  const query = searchQuery.value.toLowerCase()
  return friends.value.filter(friend =>
    friend.username.toLowerCase().includes(query) ||
    friend.email.toLowerCase().includes(query)
  )
})

onMounted(async () => {
  await loadFriends()
})

const loadFriends = async () => {
  try {
    loading.value = true
    friends.value = await friendService.getFriends()
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '加载好友列表失败',
    })
  } finally {
    loading.value = false
  }
}

const handleSearch = (value: string) => {
  searchQuery.value = value
}

const toggleSelect = (userId: string) => {
  const index = selectedMembers.value.indexOf(userId)
  if (index > -1) {
    selectedMembers.value.splice(index, 1)
  } else {
    selectedMembers.value.push(userId)
  }
}

const handleSubmit = async () => {
  if (selectedMembers.value.length === 0) {
    showNotify({
      type: 'warning',
      message: '请至少选择一个成员',
    })
    return
  }

  try {
    submitting.value = true

    const conversation = await conversationService.createGroup({
      name: groupName.value,
      memberIds: selectedMembers.value,
    })

    showNotify({
      type: 'success',
      message: '群聊创建成功',
    })

    // 跳转到群聊详情页
    router.replace(`/chats/${conversation.id}`)
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.response?.data?.message || '创建群聊失败',
    })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.create-group-view {
  min-height: 100dvh;
  background-color: var(--van-background, #f7f8fa);
  padding-top: 46px;
}

.content {
  padding-bottom: 100px;
}

.section-title {
  padding: 16px 16px 8px;
  font-size: 14px;
  color: var(--van-text-color-2);
  font-weight: 500;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
}

.friend-avatar {
  margin-right: 12px;
}

.friend-name {
  font-size: 15px;
  color: var(--van-text-color);
}

.submit-button {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background-color: var(--van-background);
  border-top: 1px solid var(--van-border-color);
}
</style>
