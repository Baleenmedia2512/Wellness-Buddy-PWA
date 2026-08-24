/**
 * Compress Transformation before/after photos for upload.
 * Android camera JPEGs are often landscape pixels with EXIF orientation 6/8.
 * Portrait is decided AFTER applying that orientation.
 *
 * iPhone / WKWebView already applies EXIF on HTMLImageElement, so img width/height
 * are display pixels. Re-applying EXIF 6/8 would swap a portrait photo back to
 * landscape and wrongly reject it.
 */

const TARGET_BYTES = 900 * 1024;
const MAX_DIM = 1200;
const LOAD_TIMEOUT_MS = 20000;

/**
 * Display size after EXIF orientation (5–8 swap width/height).
 * @param {number} width
 * @param {number} height
 * @param {number} orientation
 */
export function displaySizeAfterOrientation(width, height, orientation) {
  if (orientation >= 5 && orientation <= 8) {
    return { width: height, height: width };
  }
  return { width, height };
}

export function isPortraitAfterOrientation(width, height, orientation) {
  const size = displaySizeAfterOrientation(width, height, orientation);
  return size.height > size.width;
}

/**
 * True when the browser already honoured EXIF 5–8 on the Image (Safari/iOS).
 * Encoded JPEG is landscape; loaded image is already portrait.
 * @param {number} imgWidth
 * @param {number} imgHeight
 * @param {number} [encodedWidth]
 * @param {number} [encodedHeight]
 * @param {number} orientation
 */
export function browserHonoredExifOrientation(
  imgWidth,
  imgHeight,
  encodedWidth,
  encodedHeight,
  orientation,
) {
  if (orientation < 5 || orientation > 8) return false;
  if (!encodedWidth || !encodedHeight) return imgHeight > imgWidth;
  return encodedWidth > encodedHeight && imgHeight > imgWidth;
}

/**
 * Size to use for the portrait check and canvas, plus whether to bake EXIF.
 * @param {number} imgWidth
 * @param {number} imgHeight
 * @param {number} [encodedWidth]
 * @param {number} [encodedHeight]
 * @param {number} orientation
 */
export function resolveOrientedImageSize(
  imgWidth,
  imgHeight,
  encodedWidth,
  encodedHeight,
  orientation,
) {
  if (browserHonoredExifOrientation(imgWidth, imgHeight, encodedWidth, encodedHeight, orientation)) {
    return { width: imgWidth, height: imgHeight, applyExif: false };
  }
  const srcW = encodedWidth || imgWidth;
  const srcH = encodedHeight || imgHeight;
  const display = displaySizeAfterOrientation(srcW, srcH, orientation);
  return {
    width: display.width,
    height: display.height,
    applyExif: orientation >= 2 && orientation <= 8,
    srcW,
    srcH,
  };
}

/**
 * Read JPEG EXIF Orientation (tag 0x0112). Returns 1–8, default 1.
 * @param {ArrayBuffer} buffer
 * @returns {number}
 */
export function readJpegOrientation(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return 1;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if ((marker & 0xFF00) !== 0xFF00) break;
      if (marker === 0xFFDA) break;
      if (offset + 2 > view.byteLength) break;
      const size = view.getUint16(offset, false);
      if (size < 2) break;

      if (marker === 0xFFE1 && offset + 8 <= view.byteLength) {
        const exif = String.fromCharCode(
          view.getUint8(offset + 2),
          view.getUint8(offset + 3),
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
        );
        if (exif === 'Exif') {
          const tiffOffset = offset + 8;
          return readOrientationFromTiff(view, tiffOffset) || 1;
        }
      }
      offset += size;
    }
  } catch {
    return 1;
  }
  return 1;
}

/**
 * Encoded JPEG pixel size from SOF (before EXIF). Null if not JPEG / unreadable.
 * @param {ArrayBuffer} buffer
 * @returns {{ width: number, height: number } | null}
 */
export function readJpegSize(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return null;

    let offset = 2;
    while (offset + 8 <= view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if ((marker & 0xFF00) !== 0xFF00) break;
      if (marker === 0xFFDA) break;
      if (offset + 2 > view.byteLength) break;
      const size = view.getUint16(offset, false);
      if (size < 2) break;

      const isSof =
        (marker >= 0xFFC0 && marker <= 0xFFC3)
        || (marker >= 0xFFC5 && marker <= 0xFFC7)
        || (marker >= 0xFFC9 && marker <= 0xFFCB)
        || (marker >= 0xFFCD && marker <= 0xFFCF);
      if (isSof && size >= 7 && offset + 6 <= view.byteLength) {
        const height = view.getUint16(offset + 3, false);
        const width = view.getUint16(offset + 5, false);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }
      offset += size;
    }
  } catch {
    return null;
  }
  return null;
}

function readOrientationFromTiff(view, tiffOffset) {
  if (tiffOffset + 8 > view.byteLength) return 1;
  const little = view.getUint16(tiffOffset, false) === 0x4949;
  const tagCount = view.getUint16(tiffOffset + 8, little);
  let dirOffset = tiffOffset + 10;
  for (let i = 0; i < tagCount; i += 1) {
    const entry = dirOffset + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    if (tag === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function transformCanvasForOrientation(ctx, width, height, orientation) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break;
  }
}

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
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image. Please try a different photo.'));
        reader.readAsArrayBuffer(file);
      });
      if (buffer && buffer.byteLength > 0) return buffer;
    } catch (err) {
      if (err instanceof Error && /Failed to read image/.test(err.message)) throw err;
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

  throw new Error('Could not read that photo on this device. Please try Camera or another gallery image.');
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Reading the photo took too long. Please try a smaller JPG photo.'));
    }, LOAD_TIMEOUT_MS);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('This photo format is not supported. Please use a JPG photo from Camera or Gallery.'));
    };
    img.src = url;
  });
}

/**
 * @param {File} file
 * @returns {Promise<{ base64: string, preview: string }>}
 */
export async function compressImage(file) {
  if (!file) {
    throw new Error('No photo selected.');
  }

  const buffer = await readFileBuffer(file);
  const orientation = readJpegOrientation(buffer);
  const blob = new Blob([buffer], { type: file.type || 'image/jpeg' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = await loadImageFromUrl(objectUrl);
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const encoded = readJpegSize(buffer);
    const resolved = resolveOrientedImageSize(
      imgW,
      imgH,
      encoded?.width,
      encoded?.height,
      orientation,
    );
    if (resolved.height <= resolved.width) {
      throw new Error('Please upload a portrait photo (vertical orientation). Landscape photos are not allowed.');
    }

    const drawOrientation = resolved.applyExif ? orientation : 1;
    let drawW = resolved.applyExif ? resolved.srcW : resolved.width;
    let drawH = resolved.applyExif ? resolved.srcH : resolved.height;
    if (drawW > MAX_DIM || drawH > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / drawW, MAX_DIM / drawH);
      drawW = Math.round(drawW * ratio);
      drawH = Math.round(drawH * ratio);
    }

    const display = displaySizeAfterOrientation(drawW, drawH, drawOrientation);
    const canvas = document.createElement('canvas');
    canvas.width = display.width;
    canvas.height = display.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to prepare photo. Please try again.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    transformCanvasForOrientation(ctx, drawW, drawH, drawOrientation);
    ctx.drawImage(img, 0, 0, drawW, drawH);

    const maxBase64Len = Math.ceil(TARGET_BYTES / 0.75);
    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > maxBase64Len && quality > 0.15) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    const base64 = dataUrl.split(',')[1];
    if (!base64) {
      throw new Error('Failed to prepare photo. Please try a different image.');
    }
    return { base64, preview: dataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
