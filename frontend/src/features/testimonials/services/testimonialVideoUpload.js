/**
 * Chunked video upload helpers for testimonial result videos.
 * Each chunk stays under Vercel's ~4.5 MB serverless request-body limit.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { normalizeVideoUploadFile } from '../utils/normalizeVideoUploadFile.js';
import { parseCapacitorHttpJson } from '../utils/testimonialMediaUrl.js';

const CHUNK_BINARY_SIZE = 2 * 1024 * 1024; // 2 MB per chunk
const CHUNK_HTTP_CONNECT_MS = 30000;
const CHUNK_HTTP_READ_MS = 120000;
const BASE64_CHAR_CHUNK = 0x8000;

function testimonialsBase() {
  return `${getApiBaseUrl()}/api/testimonials`;
}

/**
 * Convert raw bytes to a data-URL without FileReader (more reliable on Android WebView).
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToDataUrl(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHAR_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHAR_CHUNK));
  }
  return `data:application/octet-stream;base64,${btoa(binary)}`;
}

/**
 * @param {Blob} blob
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
async function readBlobAsBase64(blob, timeoutMs = 30000) {
  if (blob && typeof blob.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    if (buffer && buffer.byteLength > 0) return arrayBufferToDataUrl(buffer);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => {
      try { reader.abort(); } catch { /* ignore */ }
      reject(new Error('Reading video data took too long. Please try a shorter MP4 file.'));
    }, timeoutMs);
    reader.onload = () => {
      clearTimeout(timer);
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to read video data. Please try again.'));
    };
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
  const normalized = await normalizeVideoUploadFile(file);
  if (!normalized.size) {
    throw new Error('Selected video is empty. Please choose another file.');
  }

  const totalChunks = Math.max(1, Math.ceil(normalized.size / CHUNK_BINARY_SIZE));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_BINARY_SIZE;
    const chunkBlob = normalized.slice(start, start + CHUNK_BINARY_SIZE);
    const chunkBase64 = await readBlobAsBase64(chunkBlob);

    const res = await CapacitorHttp.post({
      url: `${testimonialsBase()}/upload-video-chunk`,
      headers: { 'Content-Type': 'application/json' },
      connectTimeout: CHUNK_HTTP_CONNECT_MS,
      readTimeout: CHUNK_HTTP_READ_MS,
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

    const result = parseCapacitorHttpJson(res.data);
    if (res.status < 200 || res.status >= 300 || !result?.success) {
      throw new Error(
        result?.message
        || `Failed to upload video (part ${chunkIndex + 1} of ${totalChunks}). Please try again.`,
      );
    }
  }

  return uploadInfo.path;
}
