/**
 * 创建文件输入元素并触发文件选择
 */
export function selectFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      resolve(file || null)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * 选择图片文件
 */
export async function selectImage(): Promise<File | null> {
  const file = await selectFile('image/jpeg,image/png,image/webp,image/gif')
  if (!file) return null

  // 验证文件类型和大小
  if (!isValidImage(file)) {
    const errorMsg = file.size > 10 * 1024 * 1024
      ? '图片大小不能超过 10MB'
      : '不支持的图片格式，请选择 JPEG、PNG、WebP 或 GIF 格式'
    alert(errorMsg)
    return null
  }

  return file
}

/**
 * 选择视频文件
 */
export async function selectVideo(): Promise<File | null> {
  const file = await selectFile('video/mp4,video/webm,video/ogg')
  if (!file) return null

  // 验证文件类型和大小
  if (!isValidVideo(file)) {
    const errorMsg = file.size > 50 * 1024 * 1024
      ? '视频大小不能超过 50MB'
      : '不支持的视频格式，请选择 MP4、WebM 或 OGG 格式'
    alert(errorMsg)
    return null
  }

  return file
}

/**
 * 选择任意文件
 */
export async function selectAnyFile(): Promise<File | null> {
  return selectFile('*/*')
}

/**
 * 从视频文件创建缩略图
 */
export function createVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const blobUrl = URL.createObjectURL(file)

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      video.currentTime = 1 // 在第 1 秒处捕获帧
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const thumbnail = canvas.toDataURL('image/jpeg')
        // 清理 Blob URL
        URL.revokeObjectURL(blobUrl)
        resolve(thumbnail)
      } else {
        URL.revokeObjectURL(blobUrl)
        reject(new Error('Failed to get canvas context'))
      }
    }
    video.onerror = (err) => {
      URL.revokeObjectURL(blobUrl)
      reject(err)
    }
    video.src = blobUrl
  })
}

/**
 * 格式化文件大小为人类可读格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 验证图片文件
 */
export function isValidImage(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const maxSize = 10 * 1024 * 1024 // 10MB

  return validTypes.includes(file.type) && file.size <= maxSize
}

/**
 * 验证视频文件
 */
export function isValidVideo(file: File): boolean {
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg']
  const maxSize = 50 * 1024 * 1024 // 50MB

  return validTypes.includes(file.type) && file.size <= maxSize
}
