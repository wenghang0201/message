import axios from 'axios';
import { UploadResponse } from '@/types/api';

const RESOURCE_API_URL = import.meta.env.VITE_RESOURCE_API_URL || 'http://localhost:9001';

class UploadService {
  /**
   * Upload a file to the resource server
   */
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const formData = new FormData();
    formData.append('files', file);

    try {
      const response = await axios.post<UploadResponse>(
        `${RESOURCE_API_URL}/resource`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress(percentCompleted);
            }
          },
        }
      );

      if (response.data.result === 1) {
        // 返回上传文件的完整 URL
        return `${response.data.serverAddress}${response.data.assetsUrl}`;
      } else {
        throw new Error('上傳失敗');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '上傳失敗');
    }
  }

  /**
   * Upload a blob (for captured photos/videos/voice)
   */
  async uploadBlob(
    blob: Blob,
    filename: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // 将 blob 转换为 File
    const file = new File([blob], filename, { type: blob.type });
    return this.uploadFile(file, onProgress);
  }

  /**
   * Upload a data URL (base64)
   */
  async uploadDataURL(
    dataUrl: string,
    filename: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // 将数据 URL 转换为 blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return this.uploadBlob(blob, filename, onProgress);
  }
}

export default new UploadService();
