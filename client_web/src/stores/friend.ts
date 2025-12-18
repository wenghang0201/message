import { defineStore } from 'pinia'
import { ref } from 'vue'
import friendService from '@/services/friend.service'
import type { FriendListItem, FriendRequestItem, SearchUserItem } from '@/types/api'

export const useFriendStore = defineStore('friend', () => {
  const friends = ref<FriendListItem[]>([])
  const pendingRequests = ref<FriendRequestItem[]>([])
  const sentRequests = ref<FriendRequestItem[]>([])
  const searchResults = ref<SearchUserItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 获取好友列表
  async function fetchFriends() {
    isLoading.value = true
    error.value = null
    try {
      friends.value = await friendService.getFriends()
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch friends'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // 获取待处理的好友请求
  async function fetchPendingRequests() {
    error.value = null
    try {
      pendingRequests.value = await friendService.getPendingRequests()
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch pending requests'
      throw err
    }
  }

  // 获取已发送的好友请求
  async function fetchSentRequests() {
    error.value = null
    try {
      sentRequests.value = await friendService.getSentRequests()
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch sent requests'
      throw err
    }
  }

  // 发送好友请求
  async function sendFriendRequest(recipientId: string) {
    error.value = null
    try {
      await friendService.sendFriendRequest(recipientId)
      // 刷新已发送的请求
      await fetchSentRequests()
    } catch (err: any) {
      error.value = err.message || 'Failed to send friend request'
      throw err
    }
  }

  // 接受好友请求
  async function acceptFriendRequest(friendshipId: string) {
    error.value = null
    try {
      await friendService.acceptFriendRequest(friendshipId)
      // 从待处理请求中移除
      pendingRequests.value = pendingRequests.value.filter(r => r.id !== friendshipId)
      // 刷新好友列表
      await fetchFriends()
    } catch (err: any) {
      error.value = err.message || 'Failed to accept friend request'
      throw err
    }
  }

  // 拒绝好友请求
  async function rejectFriendRequest(friendshipId: string) {
    error.value = null
    try {
      await friendService.rejectFriendRequest(friendshipId)
      // 从待处理请求中移除
      pendingRequests.value = pendingRequests.value.filter(r => r.id !== friendshipId)
    } catch (err: any) {
      error.value = err.message || 'Failed to reject friend request'
      throw err
    }
  }

  // 移除好友
  async function removeFriend(friendshipId: string) {
    error.value = null
    try {
      await friendService.removeFriend(friendshipId)
      // 从好友列表中移除
      friends.value = friends.value.filter(f => f.friendshipId !== friendshipId)
    } catch (err: any) {
      error.value = err.message || 'Failed to remove friend'
      throw err
    }
  }

  // 搜索用户
  async function searchUsers(query: string) {
    error.value = null
    try {
      searchResults.value = await friendService.searchUsers(query)
    } catch (err: any) {
      error.value = err.message || 'Failed to search users'
      throw err
    }
  }

  // 清空搜索结果
  function clearSearch() {
    searchResults.value = []
  }

  return {
    friends,
    pendingRequests,
    sentRequests,
    searchResults,
    isLoading,
    error,
    fetchFriends,
    fetchPendingRequests,
    fetchSentRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    searchUsers,
    clearSearch,
  }
})
