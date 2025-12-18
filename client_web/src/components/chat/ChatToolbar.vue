<template>
  <van-action-sheet
    v-model:show="visible"
    :actions="actions"
    cancel-text="取消"
    close-on-click-action
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ActionSheetAction } from 'vant'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:show': [value: boolean]
  'select-image': []
  'select-video': []
  'take-photo-video': []
}>()

const visible = ref(props.show)

watch(() => props.show, (newValue) => {
  visible.value = newValue
})

watch(visible, (newValue) => {
  emit('update:show', newValue)
})

const actions: ActionSheetAction[] = [
  {
    name: '图片',
    subname: '从相册选择',
    icon: 'photo-o',
    callback: () => emit('select-image'),
  },
  {
    name: '视频',
    subname: '选择视频文件',
    icon: 'video-o',
    callback: () => emit('select-video'),
  },
  {
    name: '相机',
    subname: '拍摄照片或视频',
    icon: 'photograph',
    callback: () => emit('take-photo-video'),
  },
]
</script>

<style scoped>
</style>
