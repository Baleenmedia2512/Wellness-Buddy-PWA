/**
 * Chunked video upload helpers for testimonial result videos.
 * Each chunk stays under Vercel's ~4.5 MB serverless request-body limit.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

const CHUNK_BINARY_SIZE = 2 * 1024 * 1024; // 2 MB per chunk

function testimonialsBase() {
  return `${getApiBaseUrl()}/api/testimonials`;
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function readBlobAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read video data. Please try again.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a video file in chunks via the backend API (works on web + Capacitor native).
 * @param {File} file
 * @param {{ path: string, sessionId: string }} uploadInfo
 * @param {'health'|'business'} slot
 * @param {number} userId
 * @returns {Promise<string>} final storage path
 */
export async function uploadTestimonialVideoInChunks(file, uploadInfo, slot, userId) {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_BINARY_SIZE));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_BINARY_SIZE;
    const chunkBlob = file.slice(start, start + CHUNK_BINARY_SIZE);
    const chunkBase64 = await readBlobAsBase64(chunkBlob);

    const res = await CapacitorHttp.post({
      url: `${testimonialsBase()}/upload-video-chunk`,
      headers: { 'Content-Type': 'application/json' },
      data: {
        userId,
        sessionId: uploadInfo.sessionId,
        slot,
        chunkIndex,
        totalChunks,
        chunkBase64,
        finalPath: uploadInfo.path,
      },
    });

    const result = res.data;
    if (res.status < 200 || res.status >= 300 || !result?.success) {
      throw new Error(
        result?.message
        || `Failed to upload video (part ${chunkIndex + 1} of ${totalChunks}). Please try again.`,
      );
    }
  }

  return uploadInfo.path;
}
