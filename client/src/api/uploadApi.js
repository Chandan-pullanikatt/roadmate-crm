import api from './axios';
import axios from 'axios';

export const uploadApi = {
  /**
   * Get presigned URL from our backend
   */
  getPresignedUpload: (data) => api.post('/upload/presign', data),

  /**
   * Upload file directly to R2 using the presigned URL
   */
  uploadFileDirect: async (uploadUrl, file, onProgress) => {
    return axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
  },

  /**
   * Get secure download URL for a file
   */
  getPresignedDownload: (key) => api.get(`/upload/url/${key}`),

  /**
   * Delete file from R2
   */
  deleteFile: (key) => api.delete(`/upload/${key}`),
};

export default uploadApi;
