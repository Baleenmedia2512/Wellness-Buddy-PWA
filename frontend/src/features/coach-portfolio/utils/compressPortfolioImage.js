/**
 * Compress any orientation photo for portfolio form (JPG/PNG/WEBP → JPEG data URL).
 */
const MAX_DIM = 1280;
const TARGET_BYTES = 120 * 1024;

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
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

/**
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export async function compressPortfolioImage(file) {
  if (!file) throw new Error('No image selected');
  const type = String(file.type || '').toLowerCase();
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
    throw new Error('Use JPG, PNG, or WEBP images only');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Image must be under 12 MB before compress');
  }

  const img = await loadImage(file);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > MAX_DIM || h > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > TARGET_BYTES * 1.37 && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}
