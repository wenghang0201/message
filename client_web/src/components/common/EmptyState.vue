<template>
  <div class="empty-state">
    <van-empty
      :image="image"
      :description="description"
    >
      <slot></slot>
    </van-empty>
  </div>
</template>

<script setup lang="ts">
interface Props {
  image?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  image: 'default',
  description: '暂无数据',
})
</script>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 20px;
}
</style>
