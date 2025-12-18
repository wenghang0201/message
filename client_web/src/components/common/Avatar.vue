<template>
  <div
    class="avatar"
    :style="{
      width: size + 'px',
      height: size + 'px',
      fontSize: size * 0.4 + 'px'
    }"
  >
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="avatar-image"
      @error="handleError"
    />
    <div v-else class="avatar-placeholder">
      {{ placeholder }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  src?: string
  alt?: string
  name?: string
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  alt: '头像',
  name: '',
  size: 40,
})

const imageError = ref(false)

const placeholder = computed(() => {
  if (!props.name) return '?'
  return props.name.charAt(0).toUpperCase()
})

const handleError = () => {
  imageError.value = true
}
</script>

<style scoped>
.avatar {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: #e0e0e0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  color: #fff;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
