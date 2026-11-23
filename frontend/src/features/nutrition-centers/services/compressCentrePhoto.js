/**
 * Shrink a centre photo to a JPEG data URL the register API will accept.
 * Limit matches CENTRE_PHOTO_DATA_URL_MAX_CHARS on the server.
 */
const MAX_DATA_URL_CHARS = 180000;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo'));
    };
    img.src = url;
  });
}

function render(img, maxDim, quality) {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Could not read that photo');
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function compressCentrePhoto(file) {
  if (!file) throw new Error('No photo selected');
  if (file.type && String(file.type).startsWith('video/')) {
    throw new Error('Choose a photo, not a video');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Photo must be under 12 MB');
  }

  const img = await loadImage(file);
  let maxDim = 1280;
  let quality = 0.82;
  let dataUrl = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    dataUrl = render(img, maxDim, quality);
    if (dataUrl.startsWith('data:image/jpeg;base64,/9j/') && dataUrl.length <= MAX_DATA_URL_CHARS) {
      return dataUrl;
    }
    if (quality > 0.5) {
      quality = Math.round((quality - 0.1) * 100) / 100;
    } else {
      quality = 0.62;
      maxDim = Math.round(maxDim * 0.75);
    }
  }
  throw new Error('That photo is still too large. Try another one.');
}
