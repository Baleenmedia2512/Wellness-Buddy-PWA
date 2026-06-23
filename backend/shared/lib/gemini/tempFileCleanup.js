/**
 * backend/shared/lib/gemini/tempFileCleanup.js
 * ---------------------------------------------------------------------------
 * Guarantee that formidable temporary files are always deleted, even when
 * Gemini calls fail, responses fail to parse, or the request is cancelled.
 *
 * Usage:
 *   import { withTempFileCleanup } from '../../shared/lib/gemini/tempFileCleanup.js';
 *
 *   const [fields, files] = await parseForm(req);
 *   return withTempFileCleanup(files, async () => {
 *     // ... use files safely ...
 *   });
 * ---------------------------------------------------------------------------
 */

import fs from 'fs';
import logger from '../logger.js';

/**
 * Collect all temp-file paths from a formidable `files` map.
 * Handles both formidable v2 (array per field) and v3 (single object per field).
 *
 * @param {Record<string, import('formidable').File | import('formidable').File[]>} files
 * @returns {string[]}
 */
function collectFilePaths(files) {
  const paths = [];
  if (!files || typeof files !== 'object') return paths;

  for (const value of Object.values(files)) {
    if (Array.isArray(value)) {
      for (const f of value) {
        if (f?.filepath) paths.push(f.filepath);
      }
    } else if (value?.filepath) {
      paths.push(value.filepath);
    }
  }
  return paths;
}

/**
 * Delete a single file path, swallowing errors (file may already be gone).
 * @param {string} filePath
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    logger.warn('tempFileCleanup: failed to delete temp file', { filePath, error: err.message });
  }
}

/**
 * Run `fn` and guarantee that all temp files in `files` are deleted afterwards,
 * whether `fn` resolves or rejects.
 *
 * @template T
 * @param {Record<string, import('formidable').File | import('formidable').File[]>} files
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTempFileCleanup(files, fn) {
  const paths = collectFilePaths(files);
  try {
    return await fn();
  } finally {
    for (const p of paths) {
      deleteFile(p);
    }
  }
}

/**
 * Imperatively delete all temp files in a formidable `files` map.
 * Use this when `withTempFileCleanup` cannot be used (e.g. early-exit paths).
 *
 * @param {Record<string, import('formidable').File | import('formidable').File[]>} files
 */
export function cleanupFiles(files) {
  for (const p of collectFilePaths(files)) {
    deleteFile(p);
  }
}
