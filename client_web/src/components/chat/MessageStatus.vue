<template>
  <span class="message-status" :class="`status-${status}`">
    <van-icon v-if="status === 'sending'" name="clock-o" size="14" />
    <van-icon v-else-if="status === 'sent'" name="success" size="14" />
    <div v-else-if="status === 'delivered'" class="double-check">
      <van-icon name="success" size="14" />
      <van-icon name="success" size="14" />
    </div>
    <div v-else-if="status === 'read'" class="double-check read">
      <van-icon name="success" size="14" />
      <van-icon name="success" size="14" />
    </div>
    <van-icon v-else-if="status === 'failed'" name="warning-o" size="14" color="#ee0a24" />
  </span>
</template>

<script setup lang="ts">
import type { MessageStatus } from '@/types/message'

interface Props {
  status: MessageStatus
}

defineProps<Props>()
</script>

<style scoped>
.message-status {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  color: var(--chat-text-secondary, #969799);
}

.status-sending {
  color: var(--chat-text-secondary, #969799);
}

.status-sent {
  color: var(--chat-text-secondary, #969799);
}

.status-delivered {
  color: var(--chat-text-secondary, #969799);
}

.status-read .read {
  color: var(--chat-primary-color, #07c160);
}

.status-failed {
  color: var(--chat-error, #ee0a24);
}

/* Double checkmark styling */
.double-check {
  display: inline-flex;
  position: relative;
  width: 18px;
  height: 14px;
}

.double-check :deep(.van-icon) {
  position: absolute;
  font-size: 14px;
}

.double-check :deep(.van-icon:first-child) {
  left: 0;
}

.double-check :deep(.van-icon:last-child) {
  left: 4px;
}

.double-check.read :deep(.van-icon) {
  color: var(--chat-primary-color, #07c160);
}
</style>
