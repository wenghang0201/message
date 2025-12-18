<template>
  <div class="group-settings-view">
    <NavBar
      title="群设置"
      left-arrow
      fixed
      @click-left="goBack"
    />

    <div class="settings-content">
      <!-- Group Info Section -->
      <div v-if="!isDisbanded" class="section">
        <van-cell-group>
          <van-cell
            title="群头像"
            is-link
            @click="showAvatarUpload = true"
          >
            <template #icon>
              <van-image
                :src="groupAvatar || '/default-avatar.png'"
                round
                width="40"
                height="40"
                fit="cover"
                class="group-avatar"
              />
            </template>
          </van-cell>
          <van-cell
            title="群名称"
            :value="groupName"
            is-link
            @click="showEditNameDialog = true"
          />
        </van-cell-group>
      </div>

      <!-- Group Members Section -->
      <div v-if="!isDisbanded" class="section">
        <div class="section-header">
          <span>群成员 ({{ members.length }})</span>
          <van-button
            type="primary"
            size="small"
            icon="plus"
            @click="showAddMemberDialog = true"
          >
            添加成员
          </van-button>
        </div>

        <van-loading v-if="loading" class="loading-indicator" />

        <div v-else class="members-list">
          <div
            v-for="member in members"
            :key="member.userId"
            class="member-item"
          >
            <van-image
              :src="member.avatarUrl || '/default-avatar.png'"
              round
              width="40"
              height="40"
              fit="cover"
            />
            <div class="member-info">
              <div class="member-name">
                {{ member.username }}
                <van-tag v-if="member.role === 'owner'" type="danger">群主</van-tag>
                <van-tag v-else-if="member.role === 'admin'" type="primary">管理员</van-tag>
              </div>
              <div class="member-email">{{ member.email }}</div>
            </div>
            <div class="member-actions">
              <van-popover
                v-if="canManageMember(member)"
                v-model:show="member.showMenu"
                :actions="getMemberActions(member)"
                placement="bottom-end"
                @select="onMemberActionSelect($event, member)"
              >
                <template #reference>
                  <van-icon name="ellipsis" size="20" />
                </template>
              </van-popover>
            </div>
          </div>
        </div>
      </div>

      <!-- Group Permissions Section (Owner Only) -->
      <div v-if="!isDisbanded && isOwner" class="section">
        <div class="section-header">
          <span>群权限设置</span>
        </div>
        <van-cell-group>
          <van-cell title="消息发送权限" is-link @click="showMessagePermissionPicker = true">
            <template #value>
              <span>{{ messageSendPermissionText }}</span>
            </template>
          </van-cell>
          <van-cell title="成员添加权限" is-link @click="showMemberPermissionPicker = true">
            <template #value>
              <span>{{ memberAddPermissionText }}</span>
            </template>
          </van-cell>
          <van-cell title="入群验证" is-link>
            <template #right-icon>
              <van-switch
                v-model="groupRequireApproval"
                @change="onRequireApprovalChange"
                size="20"
              />
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <!-- Group Operations Section -->
      <div class="section">
        <div class="section-header">
          <span>{{ isDisbanded ? '群组已解散' : '群操作' }}</span>
        </div>
        <van-cell-group>
          <van-cell
            v-if="!isDisbanded && isOwner"
            title="转让群主"
            is-link
            @click="showTransferOwnerDialog = true"
          />
          <van-cell
            v-if="!isDisbanded && !isOwner"
            title="退出群聊"
            is-link
            @click="confirmLeaveGroup"
          />
          <van-cell
            v-if="!isDisbanded && isOwner"
            title="解散群聊"
            is-link
            title-class="danger-text"
            @click="confirmDisbandGroup"
          />
          <van-cell
            v-if="isDisbanded"
            title="删除会话"
            is-link
            title-class="danger-text"
            @click="confirmDeleteConversation"
          />
        </van-cell-group>
      </div>
    </div>

    <!-- Add Member Dialog -->
    <van-popup
      v-model:show="showAddMemberDialog"
      position="bottom"
      round
      :style="{ height: '70%' }"
    >
      <div class="add-member-dialog">
        <div class="dialog-header">
          <span>添加成员</span>
          <van-icon name="cross" @click="showAddMemberDialog = false" />
        </div>

        <van-search
          v-model="searchQuery"
          placeholder="搜索好友"
          @search="searchFriends"
        />

        <van-loading v-if="searchingFriends" class="loading-indicator" />

        <div v-else class="friends-list">
          <van-cell
            v-for="friend in availableFriends"
            :key="friend.userId"
            clickable
            @click="addMember(friend.userId)"
          >
            <template #icon>
              <van-image
                :src="friend.avatarUrl || '/default-avatar.png'"
                round
                width="40"
                height="40"
                fit="cover"
                class="friend-avatar"
              />
            </template>
            <template #title>
              {{ friend.username }}
            </template>
            <template #label>
              {{ friend.email }}
            </template>
            <template #right-icon>
              <van-button type="primary" size="small">添加</van-button>
            </template>
          </van-cell>
        </div>
      </div>
    </van-popup>

    <!-- Edit Group Name Dialog -->
    <van-dialog
      v-model:show="showEditNameDialog"
      title="修改群名称"
      show-cancel-button
      @confirm="updateGroupName"
    >
      <van-field
        v-model="newGroupName"
        placeholder="请输入新群名称"
        maxlength="100"
        show-word-limit
        :error-message="nameError"
      />
    </van-dialog>

    <!-- Avatar Upload Dialog -->
    <van-popup
      v-model:show="showAvatarUpload"
      position="bottom"
      round
    >
      <div class="avatar-upload-dialog">
        <div class="dialog-header">
          <span>修改群头像</span>
          <van-icon name="cross" @click="showAvatarUpload = false" />
        </div>
        <van-uploader
          v-model="fileList"
          :max-count="1"
          :after-read="onAvatarSelected"
          :max-size="5 * 1024 * 1024"
          @oversize="onOversize"
          accept="image/*"
        >
          <van-button type="primary" block>选择图片</van-button>
        </van-uploader>
        <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
          <van-progress :percentage="uploadProgress" />
        </div>
      </div>
    </van-popup>

    <!-- Message Permission Picker -->
    <van-popup v-model:show="showMessagePermissionPicker" position="bottom" round>
      <van-picker
        :columns="permissionColumns"
        @confirm="onMessagePermissionConfirm"
        @cancel="showMessagePermissionPicker = false"
      />
    </van-popup>

    <!-- Member Permission Picker -->
    <van-popup v-model:show="showMemberPermissionPicker" position="bottom" round>
      <van-picker
        :columns="permissionColumns"
        @confirm="onMemberPermissionConfirm"
        @cancel="showMemberPermissionPicker = false"
      />
    </van-popup>

    <!-- Transfer Owner Dialog -->
    <van-popup
      v-model:show="showTransferOwnerDialog"
      position="bottom"
      round
      :style="{ height: '60%' }"
    >
      <div class="transfer-owner-dialog">
        <div class="dialog-header">
          <span>转让群主</span>
          <van-icon name="cross" @click="showTransferOwnerDialog = false" />
        </div>
        <div class="transfer-members-list">
          <van-cell
            v-for="member in transferCandidates"
            :key="member.userId"
            clickable
            @click="confirmTransferOwnership(member.userId)"
          >
            <template #icon>
              <van-image
                :src="member.avatarUrl || '/default-avatar.png'"
                round
                width="40"
                height="40"
                fit="cover"
                class="member-avatar"
              />
            </template>
            <template #title>
              {{ member.username }}
              <van-tag v-if="member.role === 'admin'" type="primary">管理员</van-tag>
            </template>
            <template #label>
              {{ member.email }}
            </template>
          </van-cell>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showNotify } from 'vant'
import type { PopoverAction } from 'vant'
import NavBar from '@/components/common/NavBar.vue'
import { useAuthStore } from '@/stores/auth'
import { useFriendStore } from '@/stores/friend'
import { useChatStore } from '@/stores/chat'
import conversationService from '@/services/conversation.service'
import websocketService from '@/services/websocket.service'
import uploadService from '@/services/upload.service'
import type { GroupMember } from '@/types/api'
import type { UploaderFileListItem } from 'vant'

interface Props {
  id: string
}

interface GroupMemberWithMenu extends GroupMember {
  showMenu?: boolean
}

const props = defineProps<Props>()
const router = useRouter()
const authStore = useAuthStore()
const friendStore = useFriendStore()
const chatStore = useChatStore()

const members = ref<GroupMemberWithMenu[]>([])
const loading = ref(false)
const showAddMemberDialog = ref(false)
const searchQuery = ref('')
const searchingFriends = ref(false)
const showEditNameDialog = ref(false)
const groupName = ref('')
const newGroupName = ref('')
const nameError = ref('')
const showAvatarUpload = ref(false)
const groupAvatar = ref('')
const fileList = ref<UploaderFileListItem[]>([])
const uploadProgress = ref(0)
const showMessagePermissionPicker = ref(false)
const showMemberPermissionPicker = ref(false)
const showTransferOwnerDialog = ref(false)
const groupMessageSendPermission = ref('all_members')
const groupMemberAddPermission = ref('admin_only')
const groupRequireApproval = ref(false)
const groupDisbandedAt = ref<number | undefined>(undefined)

const permissionColumns = [
  { text: '所有成员', value: 'all_members' },
  { text: '仅管理员', value: 'admin_only' },
  { text: '仅群主', value: 'owner_only' },
]

const currentUserId = computed(() => authStore.userId || '')
const currentUserMember = computed(() =>
  members.value.find(m => m.userId === currentUserId.value)
)

const isOwner = computed(() => currentUserMember.value?.role === 'owner')

const isDisbanded = computed(() => !!groupDisbandedAt.value)

const transferCandidates = computed(() =>
  members.value.filter(m => m.userId !== currentUserId.value)
)

const messageSendPermissionText = computed(() => {
  const option = permissionColumns.find(col => col.value === groupMessageSendPermission.value)
  return option?.text || '所有成员'
})

const memberAddPermissionText = computed(() => {
  const option = permissionColumns.find(col => col.value === groupMemberAddPermission.value)
  return option?.text || '仅管理员'
})

// 获取尚未在群组中的好友
const availableFriends = computed(() => {
  const memberIds = new Set(members.value.map(m => m.userId))
  return friendStore.friends.filter(f => !memberIds.has(f.userId))
})

let unsubscribeGroupNameUpdated: (() => void) | null = null
let unsubscribeGroupAvatarUpdated: (() => void) | null = null
let unsubscribeMemberRoleUpdated: (() => void) | null = null

onMounted(async () => {
  await loadGroupMembers()
  await loadGroupInfo()
  await friendStore.fetchFriends()

  // 监听群组名称更新
  unsubscribeGroupNameUpdated = websocketService.onGroupNameUpdated((data) => {
    if (data.conversationId === props.id) {
      groupName.value = data.name
      newGroupName.value = data.name
    }
  })

  // 监听群组头像更新
  unsubscribeGroupAvatarUpdated = websocketService.onGroupAvatarUpdated((data) => {
    if (data.conversationId === props.id) {
      groupAvatar.value = data.avatarUrl
    }
  })

  // 监听成员角色更新
  unsubscribeMemberRoleUpdated = websocketService.onMemberRoleUpdated((data) => {
    if (data.conversationId === props.id) {
      // 在本地成员列表中更新成员角色
      const member = members.value.find(m => m.userId === data.userId)
      if (member) {
        member.role = data.role
      }
    }
  })
})

onBeforeUnmount(() => {
  if (unsubscribeGroupNameUpdated) {
    unsubscribeGroupNameUpdated()
  }
  if (unsubscribeGroupAvatarUpdated) {
    unsubscribeGroupAvatarUpdated()
  }
  if (unsubscribeMemberRoleUpdated) {
    unsubscribeMemberRoleUpdated()
  }
})

const loadGroupMembers = async () => {
  loading.value = true
  try {
    const data = await conversationService.getGroupMembers(props.id)
    members.value = data.map(member => ({
      ...member,
      showMenu: false,
    }))
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '加载成员列表失败',
    })
  } finally {
    loading.value = false
  }
}

const loadGroupInfo = async () => {
  try {
    const conversation = await conversationService.getConversation(props.id)
    groupName.value = conversation.name || '未命名群组'
    newGroupName.value = groupName.value
    groupAvatar.value = conversation.avatarUrl || ''
    groupMessageSendPermission.value = conversation.messageSendPermission || 'all_members'
    groupMemberAddPermission.value = conversation.memberAddPermission || 'admin_only'
    groupRequireApproval.value = conversation.requireApproval || false

    // 从聊天 store 获取解散状态
    const chat = chatStore.getChatById(props.id)
    groupDisbandedAt.value = chat?.disbandedAt
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '加载群信息失败',
    })
  }
}

const canManageMember = (member: GroupMember): boolean => {
  const currentMember = currentUserMember.value
  if (!currentMember) return false

  // 群主可以管理所有人（除了自己）
  if (currentMember.role === 'owner') {
    return member.userId !== currentUserId.value
  }

  // 管理员可以管理成员（不包括群主或其他管理员）
  if (currentMember.role === 'admin') {
    return member.role === 'member'
  }

  return false
}

const getMemberActions = (member: GroupMember): PopoverAction[] => {
  const actions: PopoverAction[] = []
  const currentMember = currentUserMember.value

  if (!currentMember) return actions

  // 群主可以设置/移除管理员和移除成员
  if (currentMember.role === 'owner') {
    if (member.role === 'member') {
      actions.push({ text: '设为管理员', value: 'set-admin' })
    } else if (member.role === 'admin') {
      actions.push({ text: '取消管理员', value: 'remove-admin' })
    }
    actions.push({ text: '移出群聊', value: 'remove' })
  }

  // 管理员只能移除普通成员
  if (currentMember.role === 'admin' && member.role === 'member') {
    actions.push({ text: '移出群聊', value: 'remove' })
  }

  return actions
}

const onMemberActionSelect = async (action: PopoverAction, member: GroupMemberWithMenu) => {
  member.showMenu = false

  switch (action.value) {
    case 'set-admin':
      await setMemberRole(member.userId, 'admin')
      break
    case 'remove-admin':
      await setMemberRole(member.userId, 'member')
      break
    case 'remove':
      await removeMember(member.userId)
      break
  }
}

const setMemberRole = async (userId: string, role: 'admin' | 'member') => {
  try {
    await conversationService.updateMemberRole(props.id, userId, { role })

    const member = members.value.find(m => m.userId === userId)
    if (member) {
      member.role = role
    }

    showNotify({
      type: 'success',
      message: role === 'admin' ? '已设为管理员' : '已取消管理员',
    })
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '操作失败',
    })
  }
}

const removeMember = async (userId: string) => {
  const member = members.value.find(m => m.userId === userId)
  if (!member) return

  showDialog({
    title: '移出群聊',
    message: `确定要将 ${member.username} 移出群聊吗？该用户将无法查看之前的消息记录。`,
    showCancelButton: true,
    confirmButtonText: '移出',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await conversationService.removeGroupMember(props.id, userId)
      members.value = members.value.filter(m => m.userId !== userId)
      showNotify({
        type: 'success',
        message: '已移出群聊',
      })
    } catch (error: any) {
      showNotify({
        type: 'danger',
        message: error.message || '移出失败',
      })
    }
  }).catch(() => {
    // 用户取消
  })
}

const searchFriends = async () => {
  searchingFriends.value = true
  try {
    // 好友已在 onMounted 中加载
    // 如果需要，仅按搜索查询过滤
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '搜索好友失败',
    })
  } finally {
    searchingFriends.value = false
  }
}

const addMember = async (userId: string) => {
  try {
    await conversationService.addGroupMembers(props.id, { memberIds: [userId] })
    showNotify({
      type: 'success',
      message: '已添加成员',
    })
    showAddMemberDialog.value = false
    await loadGroupMembers()
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '添加成员失败',
    })
  }
}

const updateGroupName = async () => {
  nameError.value = ''

  // 验证
  if (!newGroupName.value.trim()) {
    nameError.value = '群名称不能为空'
    return
  }

  if (newGroupName.value.trim().length > 100) {
    nameError.value = '群名称最多100个字符'
    return
  }

  // 检查用户是否有权限
  const currentMember = currentUserMember.value
  if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
    showNotify({
      type: 'danger',
      message: '只有群主和管理员可以修改群名称',
    })
    return
  }

  try {
    await conversationService.updateGroupName(props.id, newGroupName.value.trim())
    groupName.value = newGroupName.value.trim()

    // 立即为当前用户更新聊天 store
    chatStore.updateChat(props.id, {
      name: newGroupName.value.trim(),
    })

    showEditNameDialog.value = false
    showNotify({
      type: 'success',
      message: '群名称已更新',
    })
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '更新群名称失败',
    })
  }
}

const onAvatarSelected = async (file: UploaderFileListItem | UploaderFileListItem[]) => {
  const selectedFile = Array.isArray(file) ? file[0] : file

  if (!selectedFile.file) {
    return
  }

  // 检查用户是否有权限
  const currentMember = currentUserMember.value
  if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
    showNotify({
      type: 'danger',
      message: '只有群主和管理员可以修改群头像',
    })
    fileList.value = []
    return
  }

  try {
    uploadProgress.value = 0

    // 上传文件
    const avatarUrl = await uploadService.uploadFile(selectedFile.file, (progress) => {
      uploadProgress.value = progress
    })

    // 更新群组头像
    await conversationService.updateGroupAvatar(props.id, avatarUrl)
    groupAvatar.value = avatarUrl

    // 立即为当前用户更新聊天 store
    chatStore.updateChat(props.id, {
      avatar: avatarUrl,
    })

    showAvatarUpload.value = false
    fileList.value = []
    uploadProgress.value = 0

    showNotify({
      type: 'success',
      message: '群头像已更新',
    })
  } catch (error: any) {
    uploadProgress.value = 0
    fileList.value = []
    showNotify({
      type: 'danger',
      message: error.message || '更新群头像失败',
    })
  }
}

const onOversize = () => {
  showNotify({
    type: 'danger',
    message: '图片大小不能超过 5MB',
  })
}

const onMessagePermissionConfirm = async (value: { selectedOptions: any[] }) => {
  const permission = value.selectedOptions[0]?.value
  if (!permission) return

  try {
    await conversationService.updateMessageSendPermission(props.id, permission)
    groupMessageSendPermission.value = permission
    showMessagePermissionPicker.value = false
    showNotify({
      type: 'success',
      message: '消息发送权限已更新',
    })
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '更新失败',
    })
  }
}

const onMemberPermissionConfirm = async (value: { selectedOptions: any[] }) => {
  const permission = value.selectedOptions[0]?.value
  if (!permission) return

  try {
    await conversationService.updateMemberAddPermission(props.id, permission)
    groupMemberAddPermission.value = permission
    showMemberPermissionPicker.value = false
    showNotify({
      type: 'success',
      message: '成员添加权限已更新',
    })
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '更新失败',
    })
  }
}

const onRequireApprovalChange = async (value: boolean) => {
  try {
    await conversationService.updateRequireApproval(props.id, value)
    showNotify({
      type: 'success',
      message: value ? '已开启入群验证' : '已关闭入群验证',
    })
  } catch (error: any) {
    // 如果失败则恢复开关
    groupRequireApproval.value = !value
    showNotify({
      type: 'danger',
      message: error.message || '更新失败',
    })
  }
}

const confirmLeaveGroup = () => {
  showDialog({
    title: '退出群聊',
    message: '确定要退出这个群聊吗？',
    showCancelButton: true,
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await conversationService.leaveGroup(props.id)
      showNotify({
        type: 'success',
        message: '已退出群聊',
      })
      // 返回到聊天列表
      router.push('/chats')
    } catch (error: any) {
      showNotify({
        type: 'danger',
        message: error.message || '退出失败',
      })
    }
  }).catch(() => {
    // 用户取消
  })
}

const confirmTransferOwnership = (newOwnerId: string) => {
  const newOwner = members.value.find(m => m.userId === newOwnerId)
  if (!newOwner) return

  showDialog({
    title: '转让群主',
    message: `确定要将群主转让给 ${newOwner.username} 吗？转让后您将成为管理员。`,
    showCancelButton: true,
    confirmButtonText: '转让',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await conversationService.transferOwnership(props.id, newOwnerId)
      showNotify({
        type: 'success',
        message: '群主已转让',
      })
      showTransferOwnerDialog.value = false
      // 重新加载成员以反映新角色
      await loadGroupMembers()
    } catch (error: any) {
      showNotify({
        type: 'danger',
        message: error.message || '转让失败',
      })
    }
  }).catch(() => {
    // 用户取消
  })
}

const confirmDisbandGroup = () => {
  showDialog({
    title: '解散群聊',
    message: '确定要解散这个群聊吗？解散后所有成员将无法查看此群聊，此操作不可撤销。',
    showCancelButton: true,
    confirmButtonText: '解散',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await conversationService.disbandGroup(props.id)
      showNotify({
        type: 'success',
        message: '群聊已解散',
      })
      // 返回到聊天列表
      router.push('/chats')
    } catch (error: any) {
      showNotify({
        type: 'danger',
        message: error.message || '解散失败',
      })
    }
  }).catch(() => {
    // 用户取消
  })
}

const confirmDeleteConversation = () => {
  showDialog({
    title: '删除会话',
    message: '确定要删除此会话吗？删除后将无法查看此群聊的消息记录，此操作不可撤销。',
    showCancelButton: true,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      await chatStore.removeConversation(props.id)
      showNotify({
        type: 'success',
        message: '会话已删除',
      })
      // 返回到聊天列表
      router.push('/chats')
    } catch (error: any) {
      showNotify({
        type: 'danger',
        message: error.message || '删除失败',
      })
    }
  }).catch(() => {
    // 用户取消
  })
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.group-settings-view {
  min-height: 100dvh;
  background-color: var(--chat-background, #f7f8fa);
}

.settings-content {
  padding-top: 46px;
}

.section {
  margin-bottom: 12px;
  background-color: var(--chat-card-bg, #fff);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  font-weight: 500;
  border-bottom: 1px solid var(--van-border-color);
}

.loading-indicator {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.members-list {
  padding: 0 16px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--van-border-color);
}

.member-item:last-child {
  border-bottom: none;
}

.member-info {
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
}

.member-name {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.member-email {
  font-size: 14px;
  color: var(--van-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-actions {
  padding: 0 8px;
  cursor: pointer;
  color: var(--van-text-color-2);
}

.add-member-dialog {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--van-border-color);
  font-size: 16px;
  font-weight: 500;
}

.friends-list {
  flex: 1;
  overflow-y: auto;
}

.friend-avatar {
  margin-right: 12px;
}

.group-avatar {
  margin-right: 12px;
}

.avatar-upload-dialog {
  padding: 16px;
}

.upload-progress {
  margin-top: 16px;
}

.danger-text {
  color: #ee0a24;
}

.transfer-owner-dialog {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.transfer-members-list {
  flex: 1;
  overflow-y: auto;
}

.member-avatar {
  margin-right: 12px;
}
</style>
