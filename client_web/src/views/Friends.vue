<template>
  <div class="friends-view">
    <NavBar
      title="好友"
      fixed
    />

    <van-tabs v-model:active="activeTab" sticky offset-top="46px">
      <!-- 好友列表 -->
      <van-tab title="好友" name="friends">
        <van-pull-refresh
          v-model="refreshing"
          @refresh="onRefresh"
        >
          <van-list
            v-model:loading="loading"
            :finished="true"
          >
            <div v-if="friendStore.friends.length > 0" class="friend-list">
              <van-swipe-cell
                v-for="friend in friendStore.friends"
                :key="friend.id"
              >
                <van-cell
                  :title="friend.username"
                  :label="friend.bio || friend.email"
                  center
                  clickable
                  is-link
                  @click="handleViewProfile(friend.userId)"
                >
                  <template #icon>
                    <van-image
                      round
                      width="40"
                      height="40"
                      :src="friend.avatarUrl || '/default-avatar.png'"
                      class="friend-avatar"
                    />
                  </template>
                </van-cell>
                <template #right>
                  <van-button
                    square
                    type="primary"
                    text="发消息"
                    class="swipe-button"
                    @click="handleStartChat(friend.userId)"
                  />
                  <van-button
                    square
                    type="danger"
                    text="删除"
                    class="swipe-button"
                    @click="handleRemoveFriend(friend.id)"
                  />
                </template>
              </van-swipe-cell>
            </div>

            <EmptyState
              v-else-if="!loading"
              description="暂无好友"
            >
              <p>去添加好友吧</p>
            </EmptyState>
          </van-list>
        </van-pull-refresh>
      </van-tab>

      <!-- 添加好友 -->
      <van-tab title="添加" name="add">
        <div class="add-friend-section">
          <van-search
            v-model="searchQuery"
            placeholder="搜索用户名或邮箱"
            @search="handleSearch"
            @clear="friendStore.clearSearch()"
          />

          <div v-if="friendStore.searchResults.length > 0" class="search-results">
            <van-cell
              v-for="user in friendStore.searchResults"
              :key="user.id"
              :title="user.username"
              :label="user.bio || user.email"
              center
            >
              <template #icon>
                <van-image
                  round
                  width="40"
                  height="40"
                  :src="user.avatarUrl || '/default-avatar.png'"
                  class="friend-avatar"
                />
              </template>
              <template #right-icon>
                <van-button
                  v-if="user.friendshipStatus === null"
                  type="primary"
                  size="small"
                  @click="handleSendRequest(user.id)"
                >
                  添加
                </van-button>
                <van-tag v-else-if="user.friendshipStatus === 'pending'" type="warning">
                  待确认
                </van-tag>
                <van-tag v-else-if="user.friendshipStatus === 'accepted'" type="success">
                  已是好友
                </van-tag>
              </template>
            </van-cell>
          </div>

          <EmptyState
            v-else-if="searchQuery && friendStore.searchResults.length === 0"
            description="未找到用户"
            image="search"
          />
        </div>
      </van-tab>

      <!-- 好友请求 -->
      <van-tab title="请求" name="requests">
        <van-tabs v-model:active="requestTab">
          <van-tab title="收到的" name="pending">
            <div v-if="friendStore.pendingRequests.length > 0" class="request-list">
              <van-cell
                v-for="request in friendStore.pendingRequests"
                :key="request.id"
                :title="request.requesterUsername"
                :label="request.requesterBio || request.requesterEmail"
                center
              >
                <template #icon>
                  <van-image
                    round
                    width="40"
                    height="40"
                    :src="request.requesterAvatarUrl || '/default-avatar.png'"
                    class="friend-avatar"
                  />
                </template>
                <template #right-icon>
                  <div class="request-actions">
                    <van-button
                      type="success"
                      size="small"
                      @click="handleAcceptRequest(request.id)"
                    >
                      接受
                    </van-button>
                    <van-button
                      type="default"
                      size="small"
                      @click="handleRejectRequest(request.id)"
                    >
                      拒绝
                    </van-button>
                  </div>
                </template>
              </van-cell>
            </div>

            <EmptyState
              v-else
              description="暂无好友请求"
            />
          </van-tab>

          <van-tab title="发出的" name="sent">
            <div v-if="friendStore.sentRequests.length > 0" class="request-list">
              <van-cell
                v-for="request in friendStore.sentRequests"
                :key="request.id"
                :title="request.requesterUsername"
                :label="request.requesterBio || request.requesterEmail"
                center
              >
                <template #icon>
                  <van-image
                    round
                    width="40"
                    height="40"
                    :src="request.requesterAvatarUrl || '/default-avatar.png'"
                    class="friend-avatar"
                  />
                </template>
                <template #right-icon>
                  <van-tag type="warning">待确认</van-tag>
                </template>
              </van-cell>
            </div>

            <EmptyState
              v-else
              description="暂无发送的请求"
            />
          </van-tab>
        </van-tabs>
      </van-tab>
    </van-tabs>

    <TabBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { showNotify } from '@/utils/notify'
import { useFriendStore } from '@/stores/friend'
import { useChatStore } from '@/stores/chat'
import websocketService from '@/services/websocket.service'
import NavBar from '@/components/common/NavBar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import TabBar from '@/components/common/TabBar.vue'

const router = useRouter()
const friendStore = useFriendStore()
const chatStore = useChatStore()

const activeTab = ref('friends')
const requestTab = ref('pending')
const loading = ref(false)
const refreshing = ref(false)
const searchQuery = ref('')

let unsubscribeFriendRequest: (() => void) | null = null
let unsubscribeFriendRequestAccepted: (() => void) | null = null

onMounted(async () => {
  await loadData()

  // 监听新的好友请求
  unsubscribeFriendRequest = websocketService.onFriendRequest(async (request) => {
    // 刷新待处理的请求以显示新请求
    await friendStore.fetchPendingRequests()

    // 显示通知
    showNotify({
      type: 'primary',
      message: `${request.requesterName} 向您发送了好友请求`,
    })

    // 如果还没在请求标签，切换到请求标签
    if (activeTab.value !== 'requests') {
      activeTab.value = 'requests'
      requestTab.value = 'pending'
    }
  })

  // 监听好友请求被接受
  unsubscribeFriendRequestAccepted = websocketService.onFriendRequestAccepted(async (data) => {
    // 刷新好友列表和已发送的请求
    await Promise.all([
      friendStore.fetchFriends(),
      friendStore.fetchSentRequests(),
    ])

    // 显示通知
    showNotify({
      type: 'success',
      message: `${data.userName} 接受了您的好友请求`,
    })
  })
})

onBeforeUnmount(() => {
  if (unsubscribeFriendRequest) {
    unsubscribeFriendRequest()
  }
  if (unsubscribeFriendRequestAccepted) {
    unsubscribeFriendRequestAccepted()
  }
})

const loadData = async () => {
  try {
    loading.value = true
    await Promise.all([
      friendStore.fetchFriends(),
      friendStore.fetchPendingRequests(),
      friendStore.fetchSentRequests(),
    ])
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '加载数据失败',
    })
  } finally {
    loading.value = false
  }
}

const onRefresh = async () => {
  refreshing.value = true
  await loadData()
  refreshing.value = false
  showNotify({
    type: 'success',
    message: '刷新成功',
  })
}

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    return
  }

  try {
    await friendStore.searchUsers(searchQuery.value.trim())
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '搜索失败',
    })
  }
}

const handleSendRequest = async (recipientId: string) => {
  try {
    await friendStore.sendFriendRequest(recipientId)
    showNotify({
      type: 'success',
      message: '好友请求已发送',
    })
    // 刷新搜索以更新状态
    await handleSearch()
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '发送好友请求失败',
    })
  }
}

const handleAcceptRequest = async (friendshipId: string) => {
  try {
    await friendStore.acceptFriendRequest(friendshipId)
    showNotify({
      type: 'success',
      message: '已添加好友',
    })
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '接受好友请求失败',
    })
  }
}

const handleRejectRequest = async (friendshipId: string) => {
  try {
    await friendStore.rejectFriendRequest(friendshipId)
    showNotify({
      type: 'success',
      message: '已拒绝好友请求',
    })
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '拒绝好友请求失败',
    })
  }
}

const handleViewProfile = (friendUserId: string) => {
  router.push({
    name: 'FriendProfile',
    params: { userId: friendUserId },
  })
}

const handleStartChat = async (friendUserId: string) => {
  try {
    // 创建或获取与好友的会话
    const conversationId = await chatStore.createOrGetChat(friendUserId)
    // 导航到聊天
    router.push(`/chats/${conversationId}`)
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '打开聊天失败',
    })
  }
}

const handleRemoveFriend = async (friendshipId: string) => {
  try {
    await friendStore.removeFriend(friendshipId)
    showNotify({
      type: 'success',
      message: '已删除好友',
    })
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '删除好友失败',
    })
  }
}
</script>

<style scoped>
.friends-view {
  height: 100dvh;
  background-color: var(--van-background-2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.friend-list,
.search-results,
.request-list {
  background-color: var(--van-background-2);
}

.friend-avatar {
  margin-right: 12px;
}

.add-friend-section {
  padding-top: 8px;
}

.request-actions {
  display: flex;
  gap: 8px;
}

.delete-button {
  height: 100%;
}
</style>
