/**
 * Normalize a gallery/camera File for upload on Capacitor Android.
 * content:// URIs often report size 0 while still being readable via arrayBuffer/fetch.
 * Always copy into an in-memory File so later slice()/FileReader calls are reliable.
 *
 * @param {File} file
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<File>}
 */
export async function normalizeVideoUploadFile(file, { timeoutMs = 30000 } = {}) {
  if (!file) {
    throw new Error('No video file selected.');
  }

  const name = file.name || 'video.mp4';
  const type = file.type || 'video/mp4';
  const buffer = await readFileBufferWithTimeout(file, timeoutMs);
  if (!buffer || buffer.byteLength === 0) {
    throw new Error(
      'Could not read the selected video on this device. Save it as MP4 or choose another file.',
    );
  }

  return new File([buffer], name, { type: type || 'video/mp4' });
}

/**
 * @param {File} file
 * @param {number} timeoutMs
 * @returns {Promise<ArrayBuffer>}
 */
async function readFileBufferWithTimeout(file, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Reading the video took too long. Please try a shorter MP4 file.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([readFileBuffer(file), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
async function readFileBuffer(file) {
  if (file && typeof file.arrayBuffer === 'function') {
    try {
      const buffer = await file.arrayBuffer();
      if (buffer && buffer.byteLength > 0) return buffer;
    } catch {
      // Fall through to FileReader / blob fetch.
    }
  }

  if (typeof FileReader !== 'undefined') {
    try {
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        const timer = setTimeout(() => {
          try { reader.abort(); } catch { /* ignore */ }
          reject(new Error('Reading the video took too long. Please try a shorter MP4 file.'));
        }, 25000);
        reader.onload = () => {
          clearTimeout(timer);
          resolve(reader.result);
        };
        reader.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Failed to read video data. Please try again.'));
        };
        reader.readAsArrayBuffer(file);
      });
      if (buffer && buffer.byteLength > 0) return buffer;
    } catch (err) {
      if (err instanceof Error && /took too long|Failed to read video/.test(err.message)) throw err;
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const response = await fetch(objectUrl);
    const blob = await response.blob();
    if (blob.size > 0) return blob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  throw new Error(
    'Could not read the selected video on this device. Save it as MP4 or choose another file.',
  );
}
